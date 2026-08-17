/**
 * Shared embedding client — OpenAI text-embedding-3-large.
 *
 * Both the ingest pipeline (scripts/rag/index.ts) and query time
 * (src/backend/rag.ts) import from here. They must use the same model: vectors
 * from two different models are not comparable, and mixing them fails silently
 * as bad retrieval rather than as an error.
 *
 * Vectors are stored in MongoDB Atlas and searched with $vectorSearch, so the
 * same model must be used on both sides: vectors from two different models are
 * not comparable, and mixing them fails silently as poor retrieval rather than
 * as an error.
 */

export const EMBEDDING_MODEL = 'text-embedding-3-large'
export const EMBEDDING_DIMENSIONS = 3072

/** Max inputs per request. The API allows more; this keeps payloads reasonable. */
const MAX_BATCH = 96

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const out: number[][] = []
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH)
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    })
    if (!response.ok) {
      throw new Error(
        `OpenAI embeddings ${response.status}: ${(await response.text()).slice(0, 300)}`
      )
    }
    const data = (await response.json()) as { data: { index: number; embedding: number[] }[] }
    // Restore request ordering — the API does not guarantee it.
    out.push(...[...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding))
  }
  return out
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text])
  return vector
}
