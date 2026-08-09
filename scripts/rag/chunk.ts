/**
 * Stage 4 — Split documents into retrievable chunks.
 *
 * Run: npx tsx scripts/rag/chunk.ts
 *
 * Two things here matter more than the split itself:
 *
 * 1. Structure-aware boundaries. A fixed character split cuts "Điều 5" in half
 *    and leaves both halves useless. Legal documents split on Chương/Điều;
 *    admission schemes split on numbered headings.
 *
 * 2. A contextual prefix on every chunk. Students ask "HUST cần IELTS bao
 *    nhiêu" while the paragraph that answers it never names the school. Without
 *    the prefix the embedding has nothing to match the school name against.
 *
 * Page numbers are carried through from the real PDF pagination so citations
 * point at a page that actually exists.
 */
import fs from 'fs'
import path from 'path'
import type { Chunk, DocType, ExtractedDoc, ManifestEntry } from './types'

const TEXT_DIR = path.join(process.cwd(), '.cache', 'rag', 'text')
const MANIFEST_PATH = path.join(process.cwd(), 'data', 'manifest.json')
const OUT_PATH = path.join(process.cwd(), '.cache', 'rag', 'chunks.json')

/** Split sections longer than this; keep them whole below it. */
const MAX_CHUNK_CHARS = 1400
const OVERLAP_CHARS = 150
/** Sections shorter than this get folded into the next one — a bare heading retrieves nothing. */
const MIN_SECTION_CHARS = 200

/** "Chương II", "Chương 3" */
const RE_CHUONG = /^[ \t]*(Chương\s+(?:[IVXLCDM]+|\d+))\b[^\n]*/gim
/** "Điều 5." / "Điều 12:" */
const RE_DIEU = /^[ \t]*(Điều\s+\d+)\s*[.:]/gim
/** "4." / "4.2." / "II." at line start, followed by a title */
const RE_NUMBERED = /^[ \t]*((?:\d+(?:\.\d+)*|[IVXLCDM]+)[.)])\s+(\S[^\n]{2,90})$/gim
/** A short all-caps line, the usual heading style in these schemes */
const RE_CAPS = /^[ \t]*([A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĨŨƠƯẠ-Ỹ][A-ZĐÀ-Ỹ0-9\s,./()-]{6,80})$/gm

interface PageSpan {
  num: number | null
  start: number
  end: number
}

interface Section {
  heading: string
  start: number
  end: number
}

/** Join pages into one string while remembering where each page starts. */
function joinPages(doc: ExtractedDoc): { text: string; spans: PageSpan[] } {
  const spans: PageSpan[] = []
  let text = ''
  for (const page of doc.pages) {
    const start = text.length
    text += page.text + '\n\n'
    spans.push({ num: page.num, start, end: text.length })
  }
  return { text, spans }
}

function pageAt(spans: PageSpan[], offset: number): number | null {
  for (const s of spans) if (offset >= s.start && offset < s.end) return s.num
  return spans[spans.length - 1]?.num ?? null
}

/** Collect heading positions for the patterns that suit this document type. */
function findSections(text: string, docType: DocType): Section[] {
  const patterns =
    docType === 'van_ban_phap_quy'
      ? [RE_CHUONG, RE_DIEU, RE_NUMBERED]
      : [RE_NUMBERED, RE_CAPS, RE_DIEU]

  const marks: { pos: number; heading: string }[] = []
  for (const re of patterns) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue
      const heading = m[0].trim().replace(/\s+/g, ' ').slice(0, 100)
      marks.push({ pos: m.index, heading })
    }
  }

  if (marks.length === 0) return [{ heading: '', start: 0, end: text.length }]

  marks.sort((a, b) => a.pos - b.pos)

  // Drop duplicate positions produced by overlapping patterns.
  const unique = marks.filter((m, i) => i === 0 || m.pos !== marks[i - 1].pos)

  const sections: Section[] = []
  if (unique[0].pos > 0) {
    sections.push({ heading: '', start: 0, end: unique[0].pos })
  }
  for (let i = 0; i < unique.length; i++) {
    sections.push({
      heading: unique[i].heading,
      start: unique[i].pos,
      end: i + 1 < unique.length ? unique[i + 1].pos : text.length,
    })
  }

  // Fold away headings with almost no body under them.
  const merged: Section[] = []
  for (const s of sections) {
    const prev = merged[merged.length - 1]
    if (prev && prev.end - prev.start < MIN_SECTION_CHARS) {
      prev.end = s.end
      prev.heading = prev.heading || s.heading
    } else {
      merged.push({ ...s })
    }
  }
  return merged
}

/** Split an over-long section, preferring paragraph then sentence boundaries. */
function splitLong(text: string, start: number, end: number): [number, number][] {
  if (end - start <= MAX_CHUNK_CHARS) return [[start, end]]

  const out: [number, number][] = []
  let cursor = start
  while (cursor < end) {
    let stop = Math.min(cursor + MAX_CHUNK_CHARS, end)
    if (stop < end) {
      const window = text.slice(cursor, stop)
      const para = window.lastIndexOf('\n\n')
      const sentence = window.lastIndexOf('. ')
      const cut = para > MAX_CHUNK_CHARS * 0.5 ? para : sentence > MAX_CHUNK_CHARS * 0.5 ? sentence + 1 : -1
      if (cut > 0) stop = cursor + cut
    }
    out.push([cursor, stop])
    if (stop >= end) break
    cursor = Math.max(stop - OVERLAP_CHARS, cursor + 1)
  }
  return out
}

function buildPrefix(entry: ManifestEntry, sectionPath: string): string {
  const parts = [entry.title]
  if (entry.docNumber) parts.push(`số ${entry.docNumber}`)
  if (sectionPath) parts.push(sectionPath)
  return `[${parts.join(' › ')}]`
}

function main() {
  console.log('Stage 4 — chunk')

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('data/manifest.json not found. Run scripts/rag/manifest.ts first.')
    process.exit(1)
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]
  const byHash = new Map(manifest.map((e) => [e.sha256, e]))

  const docs = fs
    .readdirSync(TEXT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(TEXT_DIR, f), 'utf8')) as ExtractedDoc)
    .sort((a, b) => a.file.localeCompare(b.file))

  const chunks: Chunk[] = []
  const pendingOcr: string[] = []
  const unmapped: string[] = []

  for (const doc of docs) {
    if (doc.needsOcr) {
      pendingOcr.push(doc.file)
      continue
    }
    const entry = byHash.get(doc.sha256)
    if (!entry) {
      unmapped.push(doc.file)
      continue
    }

    const { text, spans } = joinPages(doc)
    const sections = findSections(text, entry.docType)
    let made = 0

    for (const section of sections) {
      for (const [start, end] of splitLong(text, section.start, section.end)) {
        const body = text.slice(start, end).trim()
        if (body.length < 60) continue

        const sectionPath = section.heading
        // Per-document counter, so adding documents later leaves existing ids alone.
        chunks.push({
          id: `${doc.sha256.slice(0, 12)}-${String(made).padStart(4, '0')}`,
          text: `${buildPrefix(entry, sectionPath)}\n${body}`,
          metadata: {
            sha256: doc.sha256,
            file: doc.file,
            title: entry.title,
            docType: entry.docType,
            school: entry.school,
            authority: entry.authority,
            docNumber: entry.docNumber,
            issueDate: entry.issueDate,
            page: pageAt(spans, start),
            sectionPath,
          },
        })
        made++
      }
    }
    console.log(`  ${String(made).padStart(4)} chunks  ${entry.school ?? '—'} · ${doc.file}`)
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(chunks, null, 2))

  const avg = chunks.length ? Math.round(chunks.reduce((s, c) => s + c.text.length, 0) / chunks.length) : 0
  console.log(`\n  ${chunks.length} chunks, avg ${avg} chars -> ${path.relative(process.cwd(), OUT_PATH)}`)
  if (pendingOcr.length) {
    console.log(`  skipped ${pendingOcr.length} documents awaiting OCR`)
  }
  if (unmapped.length) {
    console.log(`  WARNING — ${unmapped.length} documents missing from the manifest:`)
    for (const f of unmapped) console.log(`    ${f}`)
  }
}

main()
