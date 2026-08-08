/**
 * RAG Corpus Ingest Script — BA §2.5.1 & §3.4
 *
 * Reads PDF files from a corpus directory, parses them page-by-page (so
 * citations carry real page numbers), chunks each page's text, embeds via
 * OpenRouter (BAAI/bge-m3 by default), and uploads to ChromaDB.
 *
 * Run: npx tsx scripts/ingest-rag.ts [--corpus-dir <path>] [--collection <name>]
 *
 * Expected corpus structure (production defaults):
 *   corpus/
 *     thong-tu-06-2026.pdf         (Thông tư 06/2026/TT-BGDĐT)
 *     vinuni-de-an-tuyen-sinh-2026.pdf
 *     hust-de-an-tuyen-sinh-2026.pdf
 *     usth-de-an-tuyen-sinh-2026.pdf
 *     vju-de-an-tuyen-sinh-2026.pdf
 *     fpt-de-an-tuyen-sinh-2026.pdf
 *     swinburne-de-an-tuyen-sinh-2026.pdf
 *
 * For pipeline testing before the real corpus is available, use the
 * synthetic fixtures instead:
 *   npx tsx scripts/ingest-rag.ts --corpus-dir test/fixtures/rag-corpus --collection green_stem_corpus_fixtures
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import fs from 'fs'
import path from 'path'
import { ChromaClient } from 'chromadb'
import { PDFParse } from 'pdf-parse'
import { embedTexts } from '../src/backend/embeddings'

const DEFAULT_COLLECTION_NAME = 'green_stem_corpus'
const DEFAULT_CORPUS_DIR = path.join(process.cwd(), 'corpus')
const CHUNK_SIZE = 800 // chars per chunk
const CHUNK_OVERLAP = 100
const BATCH_SIZE = 50

interface Chunk {
  text: string
  page: number // real page number (1-indexed), not estimated
}

function parseArgs(): { corpusDir: string; collectionName: string } {
  const args = process.argv.slice(2)
  let corpusDir = DEFAULT_CORPUS_DIR
  let collectionName = DEFAULT_COLLECTION_NAME
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--corpus-dir' && args[i + 1]) {
      corpusDir = path.resolve(args[i + 1])
      i++
    } else if (args[i] === '--collection' && args[i + 1]) {
      collectionName = args[i + 1]
      i++
    }
  }
  return { corpusDir, collectionName }
}

function chunkPageText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + size, text.length)
    chunks.push(text.slice(start, end))
    start += size - overlap
  }
  return chunks
}

/** Chunks each page independently so every chunk carries its real source page. */
function chunkPages(pages: string[], size: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = []
  pages.forEach((pageText, idx) => {
    if (!pageText.trim()) return
    for (const text of chunkPageText(pageText, size, overlap)) {
      chunks.push({ text, page: idx + 1 })
    }
  })
  return chunks
}

/**
 * Parses a PDF into an array of per-page text (index 0 = page 1), preserving
 * real page boundaries instead of flattening the whole document into one
 * string.
 */
async function parsePdfByPage(filePath: string): Promise<string[]> {
  const buffer = fs.readFileSync(filePath)
  const parser = new PDFParse({ data: buffer })
  try {
    const info = await parser.getInfo()
    const pages: string[] = []
    for (let page = 1; page <= info.total; page++) {
      const result = await parser.getText({ partial: [page] })
      // pdf-parse appends its own "-- N of M --" page marker to each
      // page's text when using `partial` — strip it so it doesn't pollute
      // chunk content passed to the LLM.
      pages.push(result.text.replace(/\n*-- \d+ of \d+ --\n*$/, '').trimEnd())
    }
    return pages
  } finally {
    await parser.destroy()
  }
}

function extractDocMeta(filename: string): { source: string; date: string } {
  const META: Record<string, { source: string; date: string }> = {
    'thong-tu-06-2026': { source: 'Thông tư 06/2026/TT-BGDĐT', date: '2026-01-01' },
    'vinuni-de-an': { source: 'Đề án tuyển sinh VinUni 2026', date: '2026-01-15' },
    'hust-de-an': { source: 'Đề án tuyển sinh HUST 2026', date: '2026-02-01' },
    'usth-de-an': { source: 'Đề án tuyển sinh USTH 2026', date: '2026-02-01' },
    'vju-de-an': { source: 'Đề án tuyển sinh VJU 2026', date: '2026-02-01' },
    'fpt-de-an': { source: 'Đề án tuyển sinh FPT 2026', date: '2026-02-01' },
    'swinburne-de-an': { source: 'Đề án tuyển sinh Swinburne 2026', date: '2026-02-01' },
  }

  const key = Object.keys(META).find((k) => filename.includes(k))
  return key ? META[key] : { source: filename, date: '2026-01-01' }
}

async function main() {
  const { corpusDir, collectionName } = parseArgs()

  console.log('🔍 RAG Corpus Ingest — Green STEM Compass')
  console.log(`   Corpus dir: ${corpusDir}`)
  console.log(`   Collection: ${collectionName}`)

  if (!fs.existsSync(corpusDir)) {
    console.error(`❌ Corpus directory not found at ${corpusDir}`)
    console.error('   Create it and add PDF files before running ingest.')
    process.exit(1)
  }

  const pdfFiles = fs.readdirSync(corpusDir).filter((f) => f.endsWith('.pdf'))
  if (pdfFiles.length === 0) {
    console.error(`❌ No PDF files found in ${corpusDir}`)
    process.exit(1)
  }

  console.log(`   Found ${pdfFiles.length} PDF(s): ${pdfFiles.join(', ')}`)

  const chroma = new ChromaClient({
    path: process.env.CHROMA_URL ?? 'http://localhost:8000',
  })

  // Delete and recreate collection (full re-ingest)
  try {
    await chroma.deleteCollection({ name: collectionName })
    console.log('   ✓ Old collection deleted')
  } catch {
    console.log('   — No existing collection to delete')
  }

  const collection = await chroma.createCollection({
    name: collectionName,
    metadata: {
      description: 'Green STEM Compass — tuyển sinh corpus',
      'hnsw:space': 'cosine', // bge-m3 embeddings compare via cosine similarity
    },
  })
  console.log('   ✓ New collection created')

  let totalChunks = 0

  for (const filename of pdfFiles) {
    const filePath = path.join(corpusDir, filename)
    const meta = extractDocMeta(filename)

    console.log(`\n   📄 Processing: ${filename}`)
    console.log(`      Source: ${meta.source}`)

    let pages: string[]
    try {
      pages = await parsePdfByPage(filePath)
      console.log(`      Extracted ${pages.length} pages`)
    } catch (err) {
      console.error(`      ❌ Failed to parse PDF: ${err}`)
      continue
    }

    const chunks = chunkPages(pages, CHUNK_SIZE, CHUNK_OVERLAP)
    console.log(`      Split into ${chunks.length} chunks`)

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const ids = batch.map((_, j) => `${filename}-chunk-${i + j}`)
      const metadatas = batch.map((chunk, j) => ({
        source: meta.source,
        page: String(chunk.page),
        date: meta.date,
        filename,
        chunk_index: i + j,
      }))
      const embeddings = await embedTexts(batch.map((c) => c.text))

      await collection.add({
        ids,
        documents: batch.map((c) => c.text),
        embeddings,
        metadatas,
      })
    }

    totalChunks += chunks.length
    console.log(`      ✓ ${chunks.length} chunks uploaded`)
  }

  console.log(`\n✅ Ingest complete! Total: ${totalChunks} chunks across ${pdfFiles.length} documents.`)
  console.log(`   Collection: ${collectionName}`)
  console.log(`   Update RAG_DATA_FRESHNESS_DATE in .env.local to today's date.`)
}

main().catch((err) => {
  console.error('❌ Ingest failed:', err)
  process.exit(1)
})
