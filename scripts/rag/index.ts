/**
 * Stage 5 — Embed chunks and load them into MongoDB Atlas Vector Search.
 *
 * Run: npm run rag:index
 *
 * The corpus lives in the same Atlas cluster as the rest of the app's data, so
 * the whole team and every deployment share one copy. That replaces the earlier
 * ChromaDB service, which had to be hosted separately and left each developer
 * with a private corpus on localhost.
 *
 * Embeddings are computed here with OpenAI text-embedding-3-large. Queries must
 * use the same model — src/backend/rag.ts imports the same embeddings module.
 *
 * Upserts by chunk id, so re-running after adding documents updates in place
 * rather than duplicating. Chunks whose source document has disappeared from
 * the manifest are removed.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { EMBEDDING_MODEL, embedTexts } from '../../src/backend/embeddings'
import { RagChunk } from '../../src/backend/db/models/RagChunk'
import type { Chunk, ManifestEntry } from './types'

const CHUNKS_PATH = path.join(process.cwd(), '.cache', 'rag', 'chunks.json')
const MANIFEST_PATH = path.join(process.cwd(), 'data', 'manifest.json')
const SCHOOLS_PATH = path.join(process.cwd(), 'src', 'shared', 'schools.ts')

export const VECTOR_INDEX_NAME = 'rag_vector_index'
const EMBED_BATCH = 96
const WRITE_BATCH = 100

/**
 * Warn when manifest school codes and the registry in schools.ts disagree.
 * They are maintained in different places — the manifest is model-generated,
 * the registry hand-written — and a mismatch makes metadata filtering match
 * nothing, which degrades retrieval silently rather than raising an error.
 */
function reportSchoolDrift(manifest: ManifestEntry[]) {
  const inManifest = new Set(manifest.map((e) => e.school).filter(Boolean) as string[])
  const source = fs.readFileSync(SCHOOLS_PATH, 'utf8')
  const inRegistry = new Set([...source.matchAll(/code: '([A-Z0-9]+)'/g)].map((m) => m[1]))

  const missingFromRegistry = [...inManifest].filter((c) => !inRegistry.has(c))
  const unusedInRegistry = [...inRegistry].filter((c) => !inManifest.has(c))

  if (missingFromRegistry.length) {
    console.log(`  WARNING — in the manifest but not in schools.ts: ${missingFromRegistry.join(', ')}`)
    console.log('            questions naming these schools will not be filtered')
  }
  if (unusedInRegistry.length) {
    console.log(`  note — in schools.ts with no indexed documents: ${unusedInRegistry.join(', ')}`)
  }
}

/**
 * Create the Atlas Vector Search index if it is absent.
 *
 * `school` and `doc_type` are declared as filter fields so retrieval can narrow
 * to one school before the vector comparison. Index builds are asynchronous —
 * the first query after creation may return nothing until it is queryable.
 */
async function ensureVectorIndex(dimensions: number) {
  const collection = mongoose.connection.db!.collection('ragchunks')

  const existing = (await collection.listSearchIndexes().toArray()) as { name: string; status?: string }[]
  const found = existing.find((i) => i.name === VECTOR_INDEX_NAME)
  if (found) {
    console.log(`  vector index "${VECTOR_INDEX_NAME}" already exists (status: ${found.status ?? 'unknown'})`)
    return
  }

  console.log(`  creating vector index "${VECTOR_INDEX_NAME}" (${dimensions} dimensions)...`)
  await collection.createSearchIndex({
    name: VECTOR_INDEX_NAME,
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: 'embedding', numDimensions: dimensions, similarity: 'cosine' },
        { type: 'filter', path: 'school' },
        { type: 'filter', path: 'doc_type' },
      ],
    },
  })
  console.log('  created — Atlas builds it in the background, usually under a minute')
}

async function main() {
  console.log('Stage 5 — embed + index into MongoDB Atlas')

  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error('No chunks found. Run npm run rag:chunk first.')
    process.exit(1)
  }
  const chunks = JSON.parse(fs.readFileSync(CHUNKS_PATH, 'utf8')) as Chunk[]
  if (chunks.length === 0) {
    console.error('chunks.json is empty.')
    process.exit(1)
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]

  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local')
    process.exit(1)
  }
  await mongoose.connect(uri)
  console.log(`  ${chunks.length} chunks | ${EMBEDDING_MODEL} | db ${mongoose.connection.name}`)

  reportSchoolDrift(manifest)

  console.log('  embedding...')
  const embeddings: number[][] = []
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH)
    embeddings.push(...(await embedTexts(batch.map((c) => c.text))))
    process.stdout.write(`\r    ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length}`)
  }
  const dimensions = embeddings[0].length
  console.log(`\n    ${dimensions} dimensions`)

  console.log('  writing...')
  const now = new Date()
  for (let i = 0; i < chunks.length; i += WRITE_BATCH) {
    const slice = chunks.slice(i, i + WRITE_BATCH)
    await RagChunk.bulkWrite(
      slice.map((chunk, j) => ({
        updateOne: {
          filter: { _id: chunk.id },
          update: {
            $set: {
              text: chunk.text,
              embedding: embeddings[i + j],
              sha256: chunk.metadata.sha256,
              file: chunk.metadata.file,
              title: chunk.metadata.title,
              doc_type: chunk.metadata.docType,
              school: chunk.metadata.school,
              authority: chunk.metadata.authority,
              doc_number: chunk.metadata.docNumber,
              issue_date: chunk.metadata.issueDate,
              page: chunk.metadata.page,
              section_path: chunk.metadata.sectionPath,
              indexed_at: now,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    )
    process.stdout.write(`\r    ${Math.min(i + WRITE_BATCH, chunks.length)}/${chunks.length}`)
  }
  console.log()

  // Drop chunks left over from documents that are no longer in the corpus.
  const stale = await RagChunk.deleteMany({ _id: { $nin: chunks.map((c) => c.id) } })
  if (stale.deletedCount) console.log(`  removed ${stale.deletedCount} stale chunks`)

  await ensureVectorIndex(dimensions)

  const total = await RagChunk.countDocuments()
  const schools = [...new Set(chunks.map((c) => c.metadata.school).filter(Boolean))].sort()
  console.log(`\n  ${total} chunks in "ragchunks"`)
  console.log(`  schools: ${schools.length} — ${schools.join(', ')}`)

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('index failed:', err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
