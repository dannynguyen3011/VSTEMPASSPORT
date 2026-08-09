/**
 * Stage 1 — Extract raw text from every source document in data/.
 *
 * Run: npx tsx scripts/rag/extract.ts
 *
 * Three adapters by format:
 *   - PDF with a text layer -> per-page text with real page numbers
 *   - PDF that is a pure scan -> flagged needsOcr, left for scripts/rag/ocr.ts
 *   - DOCX -> raw text (no pagination; citations use the section path instead)
 *
 * Spreadsheets are deliberately excluded: KhoCoHoi_TheoDoi_TheoThang.xlsx is
 * structured opportunity data that belongs in the `opportunities` table, not in
 * a vector store.
 *
 * Deduping is by SHA-256 of the bytes, not by filename — the corpus ships two
 * exact duplicate pairs that differ only by a "(1)" suffix.
 */
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import type { ExtractedDoc, ExtractedPage } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const OUT_DIR = path.join(process.cwd(), '.cache', 'rag', 'text')

/**
 * Below this many characters per page, a PDF has no usable text layer.
 * Scans in this corpus yield ~14-15 chars/page — just a "-- 1 of 17 --"
 * watermark — while real documents yield 900-3000.
 */
const MIN_CHARS_PER_PAGE = 120

const SKIP_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** Stable, filesystem-safe cache filename derived from the content hash. */
function cacheName(relPath: string, hash: string): string {
  const base = path
    .basename(relPath, path.extname(relPath))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60)
  return `${base}-${hash.slice(0, 8)}.json`
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue // .DS_Store and friends
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

async function extractPdf(
  buf: Buffer
): Promise<{ pages: ExtractedPage[]; pageCount: number; isScan: boolean }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const result = await parser.getText()
    const raw = result.pages ?? []
    const pageCount = raw.length

    const pages: ExtractedPage[] = raw.map((p: { num?: number; text?: string }, i: number) => ({
      num: p.num ?? i + 1,
      text: (p.text ?? '').trim(),
    }))

    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0)
    const isScan = pageCount > 0 && totalChars / pageCount < MIN_CHARS_PER_PAGE

    // Drop the watermark noise so a half-finished OCR run can't be mistaken
    // for real content downstream.
    return { pages: isScan ? [] : pages, pageCount, isScan }
  } finally {
    await parser.destroy()
  }
}

async function extractDocx(filePath: string): Promise<ExtractedPage[]> {
  const { value } = await mammoth.extractRawText({ path: filePath })
  const text = value.trim()
  return text ? [{ num: null, text }] : []
}

async function main() {
  console.log('Stage 1 — extract')

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`data/ not found at ${DATA_DIR}`)
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const files = walk(DATA_DIR).sort()
  const seen = new Map<string, string>() // sha256 -> first file that had it
  const skipped: string[] = []
  const duplicates: string[] = []
  const needOcr: ExtractedDoc[] = []
  let written = 0

  for (const full of files) {
    const rel = path.relative(DATA_DIR, full)
    const ext = path.extname(full).toLowerCase()

    if (SKIP_EXTENSIONS.has(ext)) {
      skipped.push(`${rel} — spreadsheet, belongs in the opportunities table`)
      continue
    }
    if (ext !== '.pdf' && ext !== '.docx') {
      skipped.push(`${rel} — unsupported format ${ext || '(none)'}`)
      continue
    }

    const buf = fs.readFileSync(full)
    const hash = sha256(buf)
    const firstSeen = seen.get(hash)
    if (firstSeen) {
      duplicates.push(`${rel} == ${firstSeen}`)
      continue
    }
    seen.set(hash, rel)

    let doc: ExtractedDoc
    try {
      if (ext === '.pdf') {
        const { pages, pageCount, isScan } = await extractPdf(buf)
        doc = {
          file: rel,
          sha256: hash,
          format: isScan ? 'pdf_scan' : 'pdf_text',
          needsOcr: isScan,
          pageCount,
          pages,
          extractedAt: new Date().toISOString(),
        }
      } else {
        const pages = await extractDocx(full)
        doc = {
          file: rel,
          sha256: hash,
          format: 'docx',
          needsOcr: pages.length === 0,
          pageCount: 1,
          pages,
          extractedAt: new Date().toISOString(),
        }
      }
    } catch (err) {
      console.error(`  FAIL  ${rel} — ${(err as Error).message}`)
      continue
    }

    fs.writeFileSync(
      path.join(OUT_DIR, cacheName(rel, hash)),
      JSON.stringify(doc, null, 2)
    )
    written++
    if (doc.needsOcr) needOcr.push(doc)

    const chars = doc.pages.reduce((s, p) => s + p.text.length, 0)
    const status = doc.needsOcr ? 'NEEDS OCR' : `${chars} chars`
    console.log(`  ${doc.format.padEnd(9)} ${status.padStart(11)}  ${rel}`)
  }

  const ocrPages = needOcr.reduce((s, d) => s + d.pageCount, 0)

  console.log(`\n  written:    ${written} documents -> ${path.relative(process.cwd(), OUT_DIR)}`)
  console.log(`  ready:      ${written - needOcr.length}`)
  console.log(`  needs OCR:  ${needOcr.length} documents / ${ocrPages} pages`)

  if (duplicates.length) {
    console.log(`\n  deduped (${duplicates.length}):`)
    for (const d of duplicates) console.log(`    ${d}`)
  }
  if (skipped.length) {
    console.log(`\n  skipped (${skipped.length}):`)
    for (const s of skipped) console.log(`    ${s}`)
  }
  if (needOcr.length) {
    console.log(`\n  Next: npx tsx scripts/rag/ocr.ts   (${ocrPages} pages via Claude vision)`)
  }
}

main().catch((err) => {
  console.error('extract failed:', err)
  process.exit(1)
})
