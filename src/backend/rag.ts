/**
 * RAG Chatbot Pipeline — ChromaDB + Claude API
 * BA §2.5 — Anti-hallucination: citation required, no out-of-context generation
 *
 * Both retrieval and answering run on OpenAI (see src/backend/openai.ts).
 * Anthropic is still used by the offline ingest scripts under scripts/rag/, but
 * is no longer on the request path.
 *
 * Retrieval design (see scripts/rag/ for the ingest side):
 *
 *  - Vectors are computed with OpenAI text-embedding-3-large via
 *    src/backend/embeddings.ts, the same module the ingest script uses. Chroma
 *    is queried with `queryEmbeddings`; `queryTexts` would make Chroma embed the
 *    query with its own English default model, producing vectors that are not
 *    comparable with the indexed ones.
 *
 *  - When the question names a school, retrieval is filtered to that school's
 *    documents first. Without the filter a question about HUST competes against
 *    chunks from every other school in the corpus.
 *
 *  - Passages beyond MAX_DISTANCE are dropped. Chroma always returns its
 *    nearest N regardless of how far away they are, so without a threshold the
 *    "no context found" branch below could never fire once the corpus is
 *    populated, and Claude would be handed irrelevant text for every
 *    off-topic question.
 */
import { ChromaClient, Collection } from 'chromadb'
import { embedQuery } from './embeddings'
import { CHAT_MODEL, getOpenAI } from './openai'
import { detectSchools } from '@/shared/schools'

const COLLECTION_NAME = 'green_stem_corpus'
const TOP_K = 8

/**
 * Maximum acceptable vector distance. Calibrated against this corpus:
 * on-topic questions land at 0.62–0.90, clearly off-topic ones at 1.21–1.47.
 * 1.05 sits in the empty band between them.
 */
const MAX_DISTANCE = 1.05

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
    // getCollection, not getOrCreateCollection: an empty auto-created collection
    // would silently look like "no results" instead of "corpus not indexed".
    _collection = await client.getCollection({ name: COLLECTION_NAME })
    return _collection
  } catch {
    console.error(
      `[rag] collection "${COLLECTION_NAME}" not found — run: npx tsx scripts/rag/index.ts`
    )
    return null
  }
}

export interface RagChunk {
  content: string
  source: string
  page: string
  date: string
  school: string | null
  docNumber: string | null
  sectionPath: string | null
  distance: number
}

/** Human-readable citation, degrading gracefully when fields are missing. */
export function formatCitation(chunk: RagChunk): string {
  const parts = [`Theo ${chunk.source}`]
  if (chunk.docNumber) parts.push(`số ${chunk.docNumber}`)
  if (chunk.page && chunk.page !== '?') parts.push(`trang ${chunk.page}`)
  if (chunk.date && chunk.date !== '?') parts.push(`ban hành ${chunk.date}`)
  return parts.join(', ')
}

/**
 * Retrieve the most relevant passages for a question.
 * Returns an empty array when nothing clears MAX_DISTANCE, or when ChromaDB is
 * unreachable — callers treat both as "no grounded answer available".
 */
export async function retrievePassages(question: string): Promise<RagChunk[]> {
  try {
    const collection = await getCollection()
    if (!collection) return []

    const schools = detectSchools(question)
    const queryEmbeddings = [await embedQuery(question)]
    const where = schools.length > 0 ? { school: { $in: schools } } : undefined

    let results = await collection.query({ queryEmbeddings, nResults: TOP_K, where })

    // A named school with no indexed documents yields nothing. Retry unfiltered
    // so a general answer is still possible rather than a flat "not found".
    const gotNothing = (results.documents?.[0] ?? []).length === 0
    if (gotNothing && where) {
      results = await collection.query({ queryEmbeddings, nResults: TOP_K })
    }

    const docs = results.documents?.[0] ?? []
    const metas = results.metadatas?.[0] ?? []
    const distances = results.distances?.[0] ?? []

    const chunks: RagChunk[] = []
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      const distance = distances[i] ?? Number.POSITIVE_INFINITY
      if (!doc || distance > MAX_DISTANCE) continue

      const meta = (metas[i] ?? {}) as Record<string, string | number>
      chunks.push({
        content: doc,
        source: String(meta.title ?? 'Tài liệu không xác định'),
        page: meta.page != null ? String(meta.page) : '?',
        date: meta.issueDate != null ? String(meta.issueDate) : '?',
        school: meta.school != null ? String(meta.school) : null,
        docNumber: meta.docNumber != null ? String(meta.docNumber) : null,
        sectionPath: meta.sectionPath != null ? String(meta.sectionPath) : null,
        distance,
      })
    }
    return chunks
  } catch (err) {
    console.error('[rag] retrieval failed:', err)
    return []
  }
}

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn tuyển sinh của Green STEM Compass — nền tảng hỗ trợ học sinh STEM Việt Nam.

QUY TẮC BẮT BUỘC:
1. Chỉ trả lời dựa trên CONTEXT được cung cấp.
2. Mọi thông tin quy chế PHẢI kèm citation. Dùng đúng chuỗi CITATION đã cho sẵn ở đầu mỗi đoạn context — không tự thêm số trang, số hiệu hay ngày ban hành nào không có trong đó.
3. Nếu context không đủ để trả lời: nói rõ phần nào chưa có thông tin, và khuyên học sinh xác nhận trực tiếp với nhà trường. Không suy đoán để lấp chỗ trống.
4. KHÔNG suy luận, ước đoán, hoặc bịa đặt thông tin tuyển sinh.
5. Nếu học sinh hỏi về một trường không có trong context, nói rõ hệ thống chưa có tài liệu của trường đó.
6. Ngôn ngữ: tiếng Việt, thân thiện với học sinh THPT. Trả lời gọn, đi thẳng vào ý chính.`

const DISCLAIMER =
  '\n\n⚠️ Vui lòng xác nhận với trường trước khi nộp hồ sơ chính thức.'

/** Answer budget. Reasoning models consume part of this before any visible text. */
const MAX_ANSWER_TOKENS = 4096

/** The bracketed context prefix chunk.ts prepends, e.g. "[Đề án … › Điều 5]". */
const CHUNK_PREFIX = /^\[[^\]]*\]\s*/

function buildContext(passages: RagChunk[]): string {
  return passages
    .map((p, i) => {
      // Strip the prefix before the model sees it. It exists to give the
      // embedding something to match a school name against, and has no job at
      // inference time — but left in, it reads as a second, competing citation
      // and the model quotes it instead of the CITATION line, sometimes
      // surfacing a garbled section heading as if it were a source.
      const body = p.content.replace(CHUNK_PREFIX, '')
      return `[${i + 1}] CITATION: ${formatCitation(p)}\n${body}`
    })
    .join('\n\n---\n\n')
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

function buildMessages(question: string, passages: RagChunk[], history: ChatTurn[]) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    {
      role: 'user' as const,
      content: `CONTEXT:\n${buildContext(passages)}\n\nCÂU HỎI: ${question}`,
    },
  ]
}

const NO_CONTEXT_MESSAGE =
  'Tôi không tìm thấy thông tin chính thống về câu hỏi này trong kho tài liệu hiện có. ' +
  'Vui lòng xác nhận trực tiếp với nhà trường, hoặc thử hỏi cụ thể hơn về một trường và một nội dung tuyển sinh.'

/** Citation card shape consumed by the chatbot UI (src/types Citation). */
export interface RagCitation {
  document: string
  page: string
  published_date: string
  excerpt: string
}

function toCitations(passages: RagChunk[]): RagCitation[] {
  return passages.map((p) => ({
    document: p.docNumber ? `${p.source} (số ${p.docNumber})` : p.source,
    page: p.page,
    published_date: p.date,
    excerpt: p.content.replace(CHUNK_PREFIX, '').slice(0, 200).trim() + '…',
  }))
}

/**
 * Stream a RAG response via the Claude API.
 *
 * Returns the citations alongside the stream so the caller can surface them
 * before the body finishes: they are known at retrieval time, and the UI shows
 * them as cards rather than parsing them back out of the prose.
 */
export async function ragChatStream(
  question: string,
  history: ChatTurn[] = []
): Promise<{ stream: ReadableStream<Uint8Array>; citations: RagCitation[] }> {
  const passages = await retrievePassages(question)
  const encoder = new TextEncoder()

  // No context found → anti-hallucination fallback, without calling the model.
  if (passages.length === 0) {
    return {
      citations: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(NO_CONTEXT_MESSAGE))
          controller.close()
        },
      }),
    }
  }

  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    // max_completion_tokens, not max_tokens: the gpt-5 family rejects the
    // latter, and every current model accepts the former. Reasoning models
    // spend part of this budget before emitting any visible text, so it has to
    // be generous or the answer comes back empty.
    max_completion_tokens: MAX_ANSWER_TOKENS,
    stream: true,
    messages: buildMessages(question, passages, history),
  })

  // Set once the consumer goes away, so we stop pulling from OpenAI instead of
  // paying for tokens nobody will read.
  let aborted = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /**
       * Enqueue only while the consumer is still attached. A client that closes
       * the connection mid-answer — navigating away, closing the tab — puts the
       * controller in a closed state, and enqueueing then throws. Without this
       * guard the throw lands in the catch below, which enqueues its error
       * message into the same closed controller and throws again.
       */
      const write = (text: string): boolean => {
        if (aborted) return false
        try {
          controller.enqueue(encoder.encode(text))
          return true
        } catch {
          aborted = true
          return false
        }
      }

      try {
        for await (const chunk of completion) {
          if (aborted) break
          const delta = chunk.choices[0]?.delta?.content
          if (delta && !write(delta)) break
        }
        write(DISCLAIMER)
      } catch (err) {
        if (!aborted) {
          console.error('[rag] stream failed:', err)
          write('\n\n[Lỗi hệ thống] Không thể kết nối đến AI engine. Vui lòng thử lại sau.')
        }
      } finally {
        completion.controller.abort()
        if (!aborted) {
          try {
            controller.close()
          } catch {
            // Already closed by the consumer — nothing to do.
          }
        }
      }
    },

    cancel() {
      // The consumer detached. Stop the upstream request; the loop above sees
      // `aborted` and exits rather than running the generation to completion.
      aborted = true
      completion.controller.abort()
    },
  })

  return { stream, citations: toCitations(passages) }
}

/**
 * Non-streaming RAG call (used for testing / admin tools)
 */
export async function ragChat(
  question: string,
  history: ChatTurn[] = []
): Promise<{
  answer: string
  citations: { source: string; page: string; date: string; excerpt: string }[]
}> {
  const passages = await retrievePassages(question)

  if (passages.length === 0) {
    return { answer: NO_CONTEXT_MESSAGE, citations: [] }
  }

  const response = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    max_completion_tokens: MAX_ANSWER_TOKENS,
    messages: buildMessages(question, passages, history),
  })

  const answer = response.choices[0]?.message?.content ?? ''

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
