/**
 * Stage 5 — Embed chunks and load them into ChromaDB.
 *
 * Run: npx tsx scripts/rag/index.ts
 *
 * Embeddings are computed here with OpenAI text-embedding-3-large and passed to
 * Chroma explicitly. That is deliberate: Chroma's own default embedding function
 * is an English model, which retrieves poorly over Vietnamese legal text, and
 * relying on it also requires an extra @chroma-core package the project does not
 * install. Supplying vectors ourselves sidesteps both problems — but it means
 * queries must embed with the same model, so src/backend/rag.ts uses
 * `queryEmbeddings`, never `queryTexts`.
 *
 * The collection is recreated on every run. At this corpus size re-embedding
 * costs a few cents and is worth avoiding stale-chunk bugs.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import { ChromaClient } from 'chromadb'
import { EMBEDDING_MODEL, embedTexts } from '../../src/backend/embeddings'
import { SCHOOLS } from '../../src/shared/schools'
import type { Chunk } from './types'

const CHUNKS_PATH = path.join(process.cwd(), '.cache', 'rag', 'chunks.json')
export const COLLECTION_NAME = 'green_stem_corpus'

const EMBED_BATCH = 96
const ADD_BATCH = 100

/** Chroma rejects null metadata values, so drop those keys entirely. */
function cleanMetadata(meta: Chunk['metadata']): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (value !== null && value !== undefined && value !== '') out[key] = value
  }
  return out
}

async function main() {
  console.log('Stage 5 — embed + index')

  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error('No chunks found. Run scripts/rag/chunk.ts first.')
    process.exit(1)
  }
  const chunks = JSON.parse(fs.readFileSync(CHUNKS_PATH, 'utf8')) as Chunk[]
  if (chunks.length === 0) {
    console.error('chunks.json is empty.')
    process.exit(1)
  }

  const chromaUrl = process.env.CHROMA_URL ?? 'http://localhost:8000'
  const client = new ChromaClient({ path: chromaUrl })
  try {
    await client.heartbeat()
  } catch {
    console.error(`Cannot reach ChromaDB at ${chromaUrl}. Start it with: docker compose up chromadb`)
    process.exit(1)
  }

  console.log(`  ${chunks.length} chunks | ${EMBEDDING_MODEL} | chroma ${chromaUrl}`)

  console.log('  embedding...')
  const embeddings: number[][] = []
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH)
    embeddings.push(...(await embedTexts(batch.map((c) => c.text))))
    process.stdout.write(`\r    ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length}`)
  }
  console.log(`\n    ${embeddings[0].length} dimensions`)

  try {
    await client.deleteCollection({ name: COLLECTION_NAME })
    console.log('  dropped existing collection')
  } catch {
    // Nothing to drop on a first run.
  }
  const collection = await client.createCollection({
    name: COLLECTION_NAME,
    metadata: {
      description: 'Green STEM Compass — tuyển sinh corpus',
      embedding_model: EMBEDDING_MODEL,
      indexed_at: new Date().toISOString(),
    },
  })

  console.log('  indexing...')
  for (let i = 0; i < chunks.length; i += ADD_BATCH) {
    const batch = chunks.slice(i, i + ADD_BATCH)
    await collection.add({
      ids: batch.map((c) => c.id),
      documents: batch.map((c) => c.text),
      embeddings: embeddings.slice(i, i + ADD_BATCH),
      metadatas: batch.map((c) => cleanMetadata(c.metadata)),
    })
    process.stdout.write(`\r    ${Math.min(i + ADD_BATCH, chunks.length)}/${chunks.length}`)
  }

  const count = await collection.count()
  const schools = [...new Set(chunks.map((c) => c.metadata.school).filter(Boolean))].sort()
  console.log(`\n\n  indexed ${count} chunks into "${COLLECTION_NAME}"`)
  console.log(`  schools: ${schools.length} — ${schools.join(', ')}`)

  // The indexed codes come from data/manifest.json (model-generated, then
  // reviewed); the query-time codes come from the hand-written registry. They
  // drift silently — a school in the index but not the registry is never
  // filtered for, and one in the registry but not the index filters to nothing.
  const registered = new Set(SCHOOLS.map((s) => s.code))
  const missingFromRegistry = schools.filter((s) => s && !registered.has(s))
  const missingFromIndex = [...registered].filter((c) => !schools.includes(c))

  if (missingFromRegistry.length) {
    console.log(
      `\n  WARNING — indexed but absent from src/shared/schools.ts: ${missingFromRegistry.join(', ')}` +
        `\n            questions naming these schools cannot be filtered to them.`
    )
  }
  if (missingFromIndex.length) {
    console.log(
      `\n  NOTE — in the registry but no indexed documents: ${missingFromIndex.join(', ')}`
    )
  }
}

main().catch((err) => {
  console.error('index failed:', err)
  process.exit(1)
})
