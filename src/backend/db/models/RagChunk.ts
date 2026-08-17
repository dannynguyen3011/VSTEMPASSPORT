import mongoose, { Schema } from 'mongoose'

/**
 * One retrievable passage of the admissions corpus, with its embedding.
 *
 * This collection replaces the separate ChromaDB service: Atlas Vector Search
 * indexes `embedding` directly, so the corpus lives in the same cluster as the
 * rest of the app's data and is shared by the whole team and by Vercel without
 * any extra infrastructure.
 *
 * Written by scripts/rag/index.ts, read by src/backend/rag.ts. Vectors come
 * from OpenAI text-embedding-3-large (see src/backend/embeddings.ts) — the
 * query must be embedded with the same model or the distances are meaningless.
 */
export interface RagChunkDoc {
  _id: string
  /** Embedded text: contextual prefix + body. See scripts/rag/chunk.ts. */
  text: string
  embedding: number[]
  /** SHA-256 of the source file, linking back to data/manifest.json. */
  sha256: string
  file: string
  title: string
  doc_type: string
  /** Uppercase school code, or null for ministry-level documents. */
  school: string | null
  authority: string | null
  doc_number: string | null
  /** ISO date from the document body. Null when the document states none. */
  issue_date: string | null
  /** Real PDF page number. Null for DOCX, which has no pagination. */
  page: number | null
  section_path: string
  indexed_at: Date
}

const ragChunkSchema = new Schema<RagChunkDoc>(
  {
    // The deterministic chunk id from scripts/rag/chunk.ts, so re-running the
    // ingest upserts in place instead of duplicating the corpus.
    _id: { type: String, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    sha256: { type: String, required: true, index: true },
    file: { type: String, required: true },
    title: { type: String, required: true },
    doc_type: { type: String, required: true },
    school: { type: String, default: null, index: true },
    authority: { type: String, default: null },
    doc_number: { type: String, default: null },
    issue_date: { type: String, default: null },
    page: { type: Number, default: null },
    section_path: { type: String, default: '' },
    indexed_at: { type: Date, default: Date.now },
  },
  { collection: 'ragchunks', versionKey: false }
)

export const RagChunk =
  (mongoose.models.RagChunk as mongoose.Model<RagChunkDoc>) ??
  mongoose.model<RagChunkDoc>('RagChunk', ragChunkSchema)
