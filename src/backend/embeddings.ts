import { getOpenRouterClient } from './openrouter'

const EMBEDDING_BATCH_SIZE = 50

function getEmbeddingModel(): string {
  return process.env.OPENROUTER_EMBEDDING_MODEL || 'BAAI/bge-m3'
}

/**
 * Embeds a batch of texts via OpenRouter, preserving input order.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const client = getOpenRouterClient()
  const model = getEmbeddingModel()
  const vectors: number[][] = new Array(texts.length)

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
    const response = await client.embeddings.create({
      model,
      input: batch,
    })
    for (const item of response.data) {
      vectors[i + item.index] = item.embedding as number[]
    }
  }

  return vectors
}
