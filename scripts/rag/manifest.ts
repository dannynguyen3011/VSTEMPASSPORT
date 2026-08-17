/**
 * Stage 3 — Bootstrap data/manifest.json from the extracted text.
 *
 * Run: npx tsx scripts/rag/manifest.ts
 *
 * Every citation the chatbot emits is built from this file, so the goal here is
 * a good first draft that a human then reviews — not an authoritative result.
 * Claude reads the opening of each document (where Vietnamese official
 * documents carry the issuing body, document number and date) and fills in the
 * fields. Entries you have checked get `reviewed: true` and are never
 * overwritten by a re-run.
 *
 * Documents still awaiting OCR get a placeholder entry so the manifest always
 * lists the full corpus. Re-run this after scripts/rag/ocr.ts to fill them in.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { ExtractedDoc, ManifestEntry } from './types'

const TEXT_DIR = path.join(process.cwd(), '.cache', 'rag', 'text')
const MANIFEST_PATH = path.join(process.cwd(), 'data', 'manifest.json')

/** Characters of opening text sent to the model. The letterhead is always here. */
const HEAD_CHARS = 4000
const CONCURRENCY = 4

const MetadataSchema = z.object({
  docType: z
    .enum(['van_ban_phap_quy', 'de_an_tuyen_sinh', 'chuong_trinh_stem', 'unknown'])
    .describe(
      'van_ban_phap_quy for Nghị định/Thông tư/Quyết định issued by a state body; ' +
        'de_an_tuyen_sinh for a university admission scheme; ' +
        'chuong_trinh_stem for STEM programme documents; unknown if unclear.'
    ),
  school: z
    .string()
    .nullable()
    .describe(
      'Short uppercase ASCII code for the university, no diacritics, e.g. VINUNI, ' +
        'HUST, USTH, VJU, BUV, UEH, HCMUT, PTIT. Null for documents issued by a ' +
        'ministry or department rather than a single university.'
    ),
  title: z
    .string()
    .describe('Vietnamese title for citations, e.g. "Đề án tuyển sinh USTH 2026".'),
  authority: z
    .string()
    .nullable()
    .describe('Issuing body exactly as written, e.g. "Bộ Giáo dục và Đào tạo".'),
  docNumber: z
    .string()
    .nullable()
    .describe('Official number as printed, e.g. "2466/QĐ-ĐHBK". Null if absent.'),
  issueDate: z
    .string()
    .nullable()
    .describe(
      'Issue date as YYYY-MM-DD, taken from the document text only. ' +
        'Null if the text does not state it — never infer it from context.'
    ),
})

const SYSTEM_PROMPT = `Bạn trích xuất metadata thư mục từ văn bản hành chính và giáo dục Việt Nam.

Chỉ dùng thông tin có trong đoạn văn bản được cung cấp. Nếu một trường không xuất hiện, trả về null cho trường đó — tuyệt đối không suy đoán, không lấy từ tên file, không điền năm hiện tại.

Ngày ban hành thường nằm ở dòng "…, ngày __ tháng __ năm __". Số hiệu văn bản nằm ở "Số: …".`

function loadDocs(): ExtractedDoc[] {
  if (!fs.existsSync(TEXT_DIR)) {
    console.error('No extracted text found. Run scripts/rag/extract.ts first.')
    process.exit(1)
  }
  return fs
    .readdirSync(TEXT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(TEXT_DIR, f), 'utf8')) as ExtractedDoc)
    .sort((a, b) => a.file.localeCompare(b.file))
}

function loadExisting(): Map<string, ManifestEntry> {
  if (!fs.existsSync(MANIFEST_PATH)) return new Map()
  const entries = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]
  return new Map(entries.map((e) => [e.sha256, e]))
}

async function extractMetadata(
  client: Anthropic,
  doc: ExtractedDoc
): Promise<ManifestEntry> {
  const head = doc.pages
    .map((p) => p.text)
    .join('\n')
    .slice(0, HEAD_CHARS)

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(MetadataSchema) },
    messages: [
      {
        role: 'user',
        content: `Tên file: ${doc.file}\n\nPhần đầu văn bản:\n\n${head}`,
      },
    ],
  })

  const meta = response.parsed_output
  if (!meta) throw new Error('model returned no parsed output')

  return {
    file: doc.file,
    sha256: doc.sha256,
    docType: meta.docType,
    school: meta.school,
    title: meta.title,
    authority: meta.authority,
    docNumber: meta.docNumber,
    issueDate: meta.issueDate,
    reviewed: false,
  }
}

function placeholder(doc: ExtractedDoc): ManifestEntry {
  return {
    file: doc.file,
    sha256: doc.sha256,
    docType: 'unknown',
    school: null,
    title: path.basename(doc.file, path.extname(doc.file)),
    authority: null,
    docNumber: null,
    issueDate: null,
    reviewed: false,
    notes: 'Awaiting OCR — re-run scripts/rag/manifest.ts after scripts/rag/ocr.ts',
  }
}

/** Run `worker` over `items` with bounded concurrency, preserving input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await worker(items[i])
      }
    })
  )
  return results
}

async function main() {
  console.log('Stage 3 — manifest bootstrap')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in .env.local')
    process.exit(1)
  }

  const client = new Anthropic()
  const docs = loadDocs()
  const existing = loadExisting()

  const pending = docs.filter((d) => d.needsOcr)
  const candidates = docs.filter((d) => !d.needsOcr)
  const toProcess = candidates.filter((d) => !existing.get(d.sha256)?.reviewed)
  const preserved = candidates.length - toProcess.length

  console.log(`  ${candidates.length} with text, ${pending.length} awaiting OCR`)
  if (preserved) console.log(`  ${preserved} reviewed entries preserved`)
  console.log(`  extracting metadata for ${toProcess.length}...\n`)

  let done = 0
  const extracted = await mapLimit(toProcess, CONCURRENCY, async (doc) => {
    try {
      const entry = await extractMetadata(client, doc)
      console.log(
        `  [${++done}/${toProcess.length}] ${(entry.school ?? '—').padEnd(8)} ` +
          `${(entry.issueDate ?? 'no date').padEnd(10)} ${entry.title}`
      )
      return entry
    } catch (err) {
      console.error(`  [${++done}/${toProcess.length}] FAIL ${doc.file} — ${(err as Error).message}`)
      return placeholder(doc)
    }
  })

  const byHash = new Map<string, ManifestEntry>(existing)
  for (const doc of pending) {
    if (!byHash.has(doc.sha256)) byHash.set(doc.sha256, placeholder(doc))
  }
  for (const entry of extracted) byHash.set(entry.sha256, entry)

  const manifest = [...byHash.values()].sort((a, b) => a.file.localeCompare(b.file))
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')

  const missingDate = manifest.filter((e) => !e.issueDate && !e.notes).length
  const schools = new Set(manifest.map((e) => e.school).filter(Boolean))

  console.log(`\n  wrote ${manifest.length} entries -> ${path.relative(process.cwd(), MANIFEST_PATH)}`)
  console.log(`  distinct schools: ${schools.size} — ${[...schools].sort().join(', ')}`)
  if (missingDate) console.log(`  ${missingDate} entries have no issue date (left null, not guessed)`)
  console.log(`\n  Review data/manifest.json and set "reviewed": true on entries you have checked.`)
}

main().catch((err) => {
  console.error('manifest failed:', err)
  process.exit(1)
})
