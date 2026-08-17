/**
 * RAG Chatbot Pipeline — MongoDB Atlas Vector Search + OpenAI
 * BA §2.5 — Anti-hallucination: citation required, no out-of-context generation
 *
 * The corpus lives in the same Atlas cluster as the app's other data (the
 * `ragchunks` collection, written by scripts/rag/index.ts), so the whole team
 * and every deployment share one copy. Anthropic is still used by the offline
 * ingest scripts, but is not on the request path.
 *
 * Retrieval design:
 *
 *  - Query vectors come from src/backend/embeddings.ts, the same module the
 *    ingest script uses. Both sides must use the same embedding model —
 *    vectors from two models are not comparable, and mixing them fails silently
 *    as poor retrieval rather than as an error.
 *
 *  - When the question names a school, retrieval is filtered to that school's
 *    documents first. Without the filter a question about HUST competes against
 *    chunks from every other school in the corpus.
 *
 *  - Passages below MIN_SCORE are dropped. $vectorSearch returns its nearest N
 *    regardless of how unrelated they are, so without a floor the "no context
 *    found" branch below could never fire once the corpus is populated, and the
 *    model would be handed irrelevant text for every off-topic question.
 */
import { connectDB } from './db/mongoose'
import { RagChunk } from './db/models/RagChunk'
import { embedQuery } from './embeddings'
import { CHAT_MODEL, getOpenAI } from './openai'
import { detectSchools } from '@/shared/schools'

const VECTOR_INDEX_NAME = 'rag_vector_index'
const TOP_K = 8

/**
 * How many candidates Atlas considers before returning TOP_K. Atlas recommends
 * roughly 10-20x the limit; too low and the approximate search misses good
 * matches, too high and it costs latency for no gain.
 */
const NUM_CANDIDATES = TOP_K * 20

/**
 * Minimum cosine similarity for an unfiltered search. $vectorSearch scores in
 * [0,1], higher being more similar. Measured on this corpus, taking the weakest
 * of the top 8 hits per question:
 *
 *   on-topic    0.767 – 0.848
 *   off-topic   0.624 – 0.697   ("cách nấu phở", "giá Bitcoin", …)
 *
 * 0.73 sits in the empty band between them. This cannot be derived from the
 * distance threshold the corpus was previously tuned against: converting that
 * boundary arithmetically gives 0.475, which every off-topic question above
 * clears comfortably — the fallback would never fire.
 */
const MIN_SCORE_BROAD = 0.73

/**
 * Minimum similarity when a school filter is in play — deliberately much lower.
 *
 * Similarity scales with how much the query says, not only with how relevant
 * the hits are. Bare school names, which students really do type, score far
 * below full questions even though the passages returned are correct:
 *
 *   "hust"                        0.545 – 0.558
 *   "vinuni"                      0.664 – 0.685
 *   "vinuni tuyển sinh"           0.783 – 0.806
 *   "VinUni tuyển sinh thế nào?"  0.796 – 0.832
 *
 * Under MIN_SCORE_BROAD every one-word query returned nothing. Once the filter
 * has restricted results to the named school, precision is already handled by
 * metadata, so the semantic floor only needs to catch genuine nonsense. An
 * off-topic question names no school, matches no alias, and so is still judged
 * by the strict threshold above.
 */
const MIN_SCORE_FILTERED = 0.5

export interface RagChunk {
  content: string
  source: string
  page: string
  date: string
  school: string | null
  docNumber: string | null
  sectionPath: string | null
  /** Cosine similarity in [0,1]; higher is more relevant. */
  score: number
}

/** Shape returned by the $vectorSearch pipeline below. */
interface VectorHit {
  text: string
  title?: string
  page?: number | null
  issue_date?: string | null
  school?: string | null
  doc_number?: string | null
  section_path?: string | null
  score: number
}

/** Human-readable citation, degrading gracefully when fields are missing. */
export function formatCitation(chunk: RagChunk): string {
  const parts = [`Theo ${chunk.source}`]
  if (chunk.docNumber) parts.push(`số ${chunk.docNumber}`)
  if (chunk.page && chunk.page !== '?') parts.push(`trang ${chunk.page}`)
  if (chunk.date && chunk.date !== '?') parts.push(`ban hành ${chunk.date}`)
  return parts.join(', ')
}

async function runVectorSearch(
  queryVector: number[],
  schools: string[]
): Promise<VectorHit[]> {
  return RagChunk.aggregate<VectorHit>([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector,
        numCandidates: NUM_CANDIDATES,
        limit: TOP_K,
        ...(schools.length > 0 ? { filter: { school: { $in: schools } } } : {}),
      },
    },
    {
      $project: {
        _id: 0,
        text: 1,
        title: 1,
        page: 1,
        issue_date: 1,
        school: 1,
        doc_number: 1,
        section_path: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ])
}

/**
 * Retrieve the most relevant passages for a question.
 * Returns an empty array when nothing clears MIN_SCORE, or when the corpus is
 * unreachable — callers treat both as "no grounded answer available".
 */
export async function retrievePassages(question: string): Promise<RagChunk[]> {
  try {
    await connectDB()

    const schools = detectSchools(question)
    const queryVector = await embedQuery(question)

    let hits = await runVectorSearch(queryVector, schools)
    let filtered = schools.length > 0

    // A named school with no indexed documents yields nothing. Retry unfiltered
    // so a general answer is still possible rather than a flat "not found".
    if (hits.length === 0 && filtered) {
      hits = await runVectorSearch(queryVector, [])
      filtered = false
    }

    const floor = filtered ? MIN_SCORE_FILTERED : MIN_SCORE_BROAD

    return hits
      .filter((h) => h.text && h.score >= floor)
      .map((h) => ({
        content: h.text,
        source: h.title ?? 'Tài liệu không xác định',
        page: h.page != null ? String(h.page) : '?',
        date: h.issue_date ?? '?',
        school: h.school ?? null,
        docNumber: h.doc_number ?? null,
        sectionPath: h.section_path ?? null,
        score: h.score,
      }))
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
