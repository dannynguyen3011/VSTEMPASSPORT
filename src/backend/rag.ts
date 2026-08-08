/**
 * RAG Chatbot Pipeline — ChromaDB + OpenRouter (LLM + embeddings)
 * BA §2.5 — Anti-hallucination: citation required, no out-of-context generation
 */
import { ChromaClient, Collection } from 'chromadb'
import { embedTexts } from './embeddings'
import { getOpenRouterClient } from './openrouter'
import { SYSTEM_PROMPT_SCOPE_LINE } from '@/shared/config/scope'
import type { ChatResponse } from '@/shared/schemas/citation'

const TOP_K = 3

let _chroma: ChromaClient | null = null
let _collection: Collection | null = null

function getChromaClient(): ChromaClient {
  if (!_chroma) {
    _chroma = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000',
    })
  }
  return _chroma
}

async function getCollection(): Promise<Collection | null> {
  if (_collection) return _collection
  try {
    const client = getChromaClient()
    const collectionName = process.env.RAG_COLLECTION_NAME || 'green_stem_corpus'
    _collection = await client.getOrCreateCollection({ name: collectionName })
    return _collection
  } catch {
    return null
  }
}

export interface RagChunk {
  content: string
  source: string
  page: string
  date: string
  distance: number
}

function getSimilarityThreshold(): number {
  return Number(process.env.RAG_SIMILARITY_THRESHOLD || '0.45')
}

export async function retrievePassages(question: string): Promise<RagChunk[]> {
  try {
    const collection = await getCollection()
    if (!collection) return []

    const [queryEmbedding] = await embedTexts([question])
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: TOP_K,
      include: ['documents', 'metadatas', 'distances'],
    })

    const chunks: RagChunk[] = []
    const docs = results.documents?.[0] ?? []
    const metas = results.metadatas?.[0] ?? []
    const distances = results.distances?.[0] ?? []
    const threshold = getSimilarityThreshold()

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      const meta = (metas[i] ?? {}) as Record<string, string>
      const distance = distances[i] ?? Infinity
      if (doc && distance <= threshold) {
        chunks.push({
          content: doc,
          source: meta.source ?? 'Tài liệu không xác định',
          page: meta.page ?? '?',
          date: meta.date ?? '?',
          distance,
        })
      }
    }
    return chunks
  } catch {
    return []
  }
}

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn tuyển sinh của Green STEM Compass — nền tảng hỗ trợ học sinh STEM Việt Nam.

QUY TẮC BẮT BUỘC:
1. Chỉ trả lời dựa trên CONTEXT được cung cấp.
2. Mọi thông tin quy chế PHẢI kèm citation theo format: "Theo [tên tài liệu], trang [X], ban hành [ngày]."
3. Nếu không tìm thấy thông tin trong context: Trả lời đúng cụm: "Tôi không tìm thấy thông tin chính thống về câu hỏi này. Vui lòng xác nhận trực tiếp với nhà trường."
4. KHÔNG suy luận, ước đoán, hoặc bịa đặt thông tin tuyển sinh.
5. ${SYSTEM_PROMPT_SCOPE_LINE}
6. Disclaimer cuối mỗi câu trả lời: " Dữ liệu cập nhật đến [DATA_DATE]. Vui lòng xác nhận với trường trước khi nộp hồ sơ chính thức."
7. Ngôn ngữ: tiếng Việt, thân thiện với học sinh THPT.`

const NOT_FOUND_ANSWER =
  'Tôi không tìm thấy thông tin chính thống về câu hỏi này. Vui lòng xác nhận trực tiếp với nhà trường.'

function getLlmModel(): string {
  const model = process.env.OPENROUTER_LLM_MODEL
  if (!model) {
    throw new Error(
      'OPENROUTER_LLM_MODEL is not set — pick a current model from https://openrouter.ai/collections/free-models (or a paid model) and set it in .env.local.'
    )
  }
  return model
}

export async function ragChat(question: string): Promise<ChatResponse> {
  const passages = await retrievePassages(question)

  if (passages.length === 0) {
    return { answer: NOT_FOUND_ANSWER, citations: [] }
  }

  const context = passages
    .map((p, i) => `[${i + 1}] ${p.source}, tr.${p.page}: ${p.content}`)
    .join('\n\n---\n\n')

  const client = getOpenRouterClient()

  const completion = await client.chat.completions.create({
    model: getLlmModel(),
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT.replace('[DATA_DATE]', passages[0]?.date ?? '?') },
      { role: 'user', content: `CONTEXT:\n${context}\n\nCÂU HỎI: ${question}` },
    ],
  })

  const answer = completion.choices[0]?.message?.content ?? ''

  return {
    answer,
    citations: passages.map((p) => ({
      document: p.source,
      page: p.page,
      published_date: p.date,
      excerpt: p.content.slice(0, 150) + '...',
    })),
  }
}
