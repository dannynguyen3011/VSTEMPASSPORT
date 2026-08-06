/**
 * RAG Chatbot Pipeline — ChromaDB + Claude API
 * BA §2.5 — Anti-hallucination: citation required, no out-of-context generation
 */
import Anthropic from '@anthropic-ai/sdk'
import { ChromaClient, Collection } from 'chromadb'

const COLLECTION_NAME = 'green_stem_corpus'
const TOP_K = 3

let _chroma: ChromaClient | null = null
let _collection: Collection | null = null

function getChromaClient(): ChromaClient {
  if (!_chroma) {
    _chroma = new ChromaClient({
      path: process.env.CHROMA_URL ?? 'http://localhost:8000',
    })
  }
  return _chroma
}

async function getCollection(): Promise<Collection | null> {
  if (_collection) return _collection
  try {
    const client = getChromaClient()
    _collection = await client.getOrCreateCollection({ name: COLLECTION_NAME })
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
}

/**
 * Retrieve top-K relevant passages from ChromaDB for a given question.
 * Returns empty array if ChromaDB is unavailable (fallback gracefully).
 */
export async function retrievePassages(question: string): Promise<RagChunk[]> {
  try {
    const collection = await getCollection()
    if (!collection) return []

    const results = await collection.query({
      queryTexts: [question],
      nResults: TOP_K,
    })

    const chunks: RagChunk[] = []
    const docs = results.documents?.[0] ?? []
    const metas = results.metadatas?.[0] ?? []

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      const meta = (metas[i] ?? {}) as Record<string, string>
      if (doc) {
        chunks.push({
          content: doc,
          source: meta.source ?? 'Tài liệu không xác định',
          page: meta.page ?? '?',
          date: meta.date ?? '?',
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
5. Hiện tại hệ thống chỉ hỗ trợ Big 6: VinUni, HUST, USTH, VJU, Fulbright, Swinburne. Nếu hỏi về trường khác, nêu rõ giới hạn này.
6. Disclaimer cuối mỗi câu trả lời: "⚠️ Dữ liệu cập nhật đến [DATA_DATE]. Vui lòng xác nhận với trường trước khi nộp hồ sơ chính thức."
7. Ngôn ngữ: tiếng Việt, thân thiện với học sinh THPT.`

/**
 * Stream a RAG response via the Claude API.
 * Caller is responsible for piping the stream to the HTTP response.
 */
export async function ragChatStream(question: string): Promise<ReadableStream<Uint8Array>> {
  const passages = await retrievePassages(question)

  const encoder = new TextEncoder()

  // No context found → anti-hallucination fallback
  if (passages.length === 0) {
    const fallback =
      'Tôi không tìm thấy thông tin chính thống về câu hỏi này. Vui lòng xác nhận trực tiếp với nhà trường.\n\n⚠️ Lưu ý: Hệ thống hiện chỉ hỗ trợ Big 6 (VinUni, HUST, USTH, VJU, Fulbright, Swinburne).'
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(fallback))
        controller.close()
      },
    })
  }

  const context = passages
    .map(
      (p, i) =>
        `[${i + 1}] Tài liệu: ${p.source}, Trang: ${p.page}, Ngày: ${p.date}\n${p.content}`
    )
    .join('\n\n---\n\n')

  const dataDate = passages[0]?.date ?? 'không xác định'
  const systemPrompt = SYSTEM_PROMPT.replace('[DATA_DATE]', dataDate)

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const anthropicStream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `CONTEXT:\n${context}\n\nCÂU HỎI: ${question}`,
      },
    ],
  })

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            '\n\n[Lỗi hệ thống] Không thể kết nối đến AI engine. Vui lòng thử lại sau.'
          )
        )
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Non-streaming RAG call (used for testing / admin tools)
 */
export async function ragChat(question: string): Promise<{
  answer: string
  citations: { source: string; page: string; date: string; excerpt: string }[]
}> {
  const passages = await retrievePassages(question)

  if (passages.length === 0) {
    return {
      answer:
        'Tôi không tìm thấy thông tin chính thống về câu hỏi này. Vui lòng xác nhận trực tiếp với nhà trường.',
      citations: [],
    }
  }

  const context = passages
    .map((p, i) => `[${i + 1}] ${p.source}, tr.${p.page}: ${p.content}`)
    .join('\n\n---\n\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT.replace('[DATA_DATE]', passages[0]?.date ?? '?'),
    messages: [
      {
        role: 'user',
        content: `CONTEXT:\n${context}\n\nCÂU HỎI: ${question}`,
      },
    ],
  })

  const answer =
    response.content[0]?.type === 'text' ? response.content[0].text : ''

  return {
    answer,
    citations: passages.map((p) => ({
      source: p.source,
      page: p.page,
      date: p.date,
      excerpt: p.content.slice(0, 150) + '...',
    })),
  }
}
