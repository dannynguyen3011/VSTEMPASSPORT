/**
 * Stage 2 — OCR the scanned PDFs with Claude vision, via the Batch API.
 *
 * Run: npx tsx scripts/rag/ocr.ts
 *
 * Two phases, driven by .cache/rag/ocr-batch.json:
 *   - No state file  -> render every page to JPEG, submit one batch, save the id.
 *   - State file     -> poll the batch; when it ends, merge transcripts back into
 *                       the ExtractedDoc files and clear needsOcr.
 * Safe to re-run: polling is idempotent, and a finished batch is only merged once.
 *
 * The Batch API halves the cost and this is a one-off bulk job with no latency
 * requirement, so there is no reason to use the synchronous endpoint.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { PDFParse } from 'pdf-parse'
import sharp from 'sharp'
import type { ExtractedDoc } from './types'

const TEXT_DIR = path.join(process.cwd(), '.cache', 'rag', 'text')
const STATE_PATH = path.join(process.cwd(), '.cache', 'rag', 'ocr-batch.json')

/**
 * Render width in pixels. A4 portrait at 1700px wide is ~2400px tall, inside
 * Claude's 2576px long-edge limit, and about 195 DPI — enough for Vietnamese
 * diacritics without paying for resolution the model discards.
 */
const RENDER_WIDTH = 1700
const MAX_LONG_EDGE = 2500
const JPEG_QUALITY = 82
const MAX_TOKENS_PER_PAGE = 8000

const OCR_PROMPT = `Đây là ảnh chụp một trang văn bản hành chính hoặc đề án tuyển sinh của Việt Nam.

Hãy chép lại TOÀN BỘ nội dung chữ trên trang, giữ nguyên:
- Tiếng Việt có dấu, đúng chính tả như trong ảnh
- Số hiệu văn bản, ngày tháng, tên riêng, con số (chỉ tiêu, điểm chuẩn, mã ngành)
- Thứ tự và cấu trúc: tiêu đề, mục, Điều, Khoản, gạch đầu dòng

Bảng biểu: chép lại dưới dạng bảng Markdown, giữ đúng từng ô.

Chỉ xuất nội dung của trang. Không thêm lời dẫn, không tóm tắt, không giải thích.
Nếu trang trống hoặc không đọc được, xuất đúng một dòng: [TRANG TRỐNG]`

interface OcrState {
  batchId: string
  submittedAt: string
  /** custom_id -> { sha256, page } so results can be routed back. */
  index: Record<string, { sha256: string; page: number }>
}

function loadDocs(): ExtractedDoc[] {
  if (!fs.existsSync(TEXT_DIR)) {
    console.error('No extracted text found. Run scripts/rag/extract.ts first.')
    process.exit(1)
  }
  return fs
    .readdirSync(TEXT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      path: path.join(TEXT_DIR, f),
      doc: JSON.parse(fs.readFileSync(path.join(TEXT_DIR, f), 'utf8')) as ExtractedDoc,
    }))
    .filter((x) => x.doc.needsOcr)
    .sort((a, b) => a.doc.file.localeCompare(b.doc.file))
    .map((x) => x.doc)
}

function docPathFor(sha256: string): string | null {
  for (const f of fs.readdirSync(TEXT_DIR)) {
    if (!f.endsWith('.json')) continue
    const p = path.join(TEXT_DIR, f)
    const doc = JSON.parse(fs.readFileSync(p, 'utf8')) as ExtractedDoc
    if (doc.sha256 === sha256) return p
  }
  return null
}

/** Render one PDF page to a base64 JPEG sized for Claude vision. */
async function renderPage(parser: PDFParse, pageNum: number): Promise<string> {
  const shot = await parser.getScreenshot({
    first: pageNum,
    last: pageNum,
    desiredWidth: RENDER_WIDTH,
  })
  const page = shot.pages?.[0]
  if (!page?.data) throw new Error(`page ${pageNum} produced no image`)

  const jpeg = await sharp(Buffer.from(page.data))
    .resize({
      width: RENDER_WIDTH,
      height: MAX_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()

  return jpeg.toString('base64')
}

async function submit(client: Anthropic, docs: ExtractedDoc[]) {
  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = []
  const index: OcrState['index'] = {}
  let bytes = 0

  for (const doc of docs) {
    const abs = path.join(process.cwd(), 'data', doc.file)
    const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(abs)) })
    try {
      for (let page = 1; page <= doc.pageCount; page++) {
        const b64 = await renderPage(parser, page)
        bytes += b64.length
        const customId = `${doc.sha256.slice(0, 12)}-p${String(page).padStart(3, '0')}`
        index[customId] = { sha256: doc.sha256, page }
        requests.push({
          custom_id: customId,
          params: {
            model: 'claude-opus-5',
            max_tokens: MAX_TOKENS_PER_PAGE,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
                  },
                  { type: 'text', text: OCR_PROMPT },
                ],
              },
            ],
          },
        })
      }
      console.log(`  rendered ${String(doc.pageCount).padStart(3)}p  ${doc.file}`)
    } finally {
      await parser.destroy()
    }
  }

  console.log(`\n  submitting ${requests.length} pages (${(bytes / 1e6).toFixed(1)} MB base64)...`)
  const batch = await client.messages.batches.create({ requests })

  const state: OcrState = {
    batchId: batch.id,
    submittedAt: new Date().toISOString(),
    index,
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))

  console.log(`  batch ${batch.id} — status ${batch.processing_status}`)
  console.log(`\n  Re-run this script to poll and merge results.`)
}

async function collect(client: Anthropic, state: OcrState) {
  const batch = await client.messages.batches.retrieve(state.batchId)
  const counts = batch.request_counts
  console.log(
    `  batch ${state.batchId} — ${batch.processing_status} ` +
      `(ok ${counts.succeeded}, err ${counts.errored}, processing ${counts.processing})`
  )

  if (batch.processing_status !== 'ended') {
    console.log('\n  Still running. Re-run this script later to merge.')
    return
  }

  // Group transcripts by document, then write each document once.
  const byDoc = new Map<string, Map<number, string>>()
  let failed = 0

  for await (const result of await client.messages.batches.results(state.batchId)) {
    const target = state.index[result.custom_id]
    if (!target) continue

    if (result.result.type !== 'succeeded') {
      failed++
      console.error(`  FAIL ${result.custom_id} — ${result.result.type}`)
      continue
    }
    const text = result.result.message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (!byDoc.has(target.sha256)) byDoc.set(target.sha256, new Map())
    byDoc.get(target.sha256)!.set(target.page, text === '[TRANG TRỐNG]' ? '' : text)
  }

  let merged = 0
  for (const [sha256, pages] of byDoc) {
    const docPath = docPathFor(sha256)
    if (!docPath) {
      console.error(`  no cached document for ${sha256.slice(0, 12)} — skipped`)
      continue
    }
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf8')) as ExtractedDoc
    doc.pages = [...pages.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([num, text]) => ({ num, text }))
    doc.needsOcr = false
    doc.extractedAt = new Date().toISOString()
    fs.writeFileSync(docPath, JSON.stringify(doc, null, 2))

    const chars = doc.pages.reduce((s, p) => s + p.text.length, 0)
    console.log(`  merged ${String(chars).padStart(7)} chars  ${doc.file}`)
    merged++
  }

  if (failed) console.log(`\n  ${failed} pages failed — re-run extract.ts + ocr.ts for those documents.`)
  console.log(`\n  merged ${merged} documents.`)
  console.log(`  Next: npx tsx scripts/rag/manifest.ts   (fill in the placeholder entries)`)

  fs.renameSync(STATE_PATH, STATE_PATH.replace('.json', `.${Date.now()}.done.json`))
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in .env.local')
    process.exit(1)
  }
  const client = new Anthropic()

  if (fs.existsSync(STATE_PATH)) {
    console.log('Stage 2 — OCR (collect)')
    await collect(client, JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as OcrState)
    return
  }

  console.log('Stage 2 — OCR (submit)')
  const docs = loadDocs()
  if (docs.length === 0) {
    console.log('  Nothing needs OCR.')
    return
  }
  const pages = docs.reduce((s, d) => s + d.pageCount, 0)
  console.log(`  ${docs.length} documents / ${pages} pages\n`)
  await submit(client, docs)
}

main().catch((err) => {
  console.error('ocr failed:', err)
  process.exit(1)
})
