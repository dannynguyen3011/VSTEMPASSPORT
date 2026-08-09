/**
 * POST /api/chat
 *
 * RAG Chatbot endpoint — Streaming response (BA §2.5)
 * Anti-hallucination: citation required, fallback if no context found.
 *
 * Body: { question: string, history?: { role, content }[] }
 * Response: text/plain stream (Server-Sent Events compatible)
 *
 * Scope is enforced by retrieval, not by a keyword blocklist. The previous
 * implementation rejected any question whose text contained "neu", "uel" or
 * "ueh" as a substring, which blocked legitimate STEM questions — "neural
 * network" contains "neu". Now a question about a school we hold no documents
 * for simply finds no passages, and src/backend/rag.ts returns its
 * "no grounded answer" message. The corpus defines the scope.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/backend/auth'
import { ragChatStream } from '@/backend/rag'
import { SCHOOLS } from '@/shared/schools'

const requestSchema = z.object({
  question: z.string().min(1).max(1000),
  /** Prior turns, oldest first. Trimmed server-side to bound prompt size. */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      })
    )
    .max(20)
    .optional(),
})

/** Keep the last N turns so long sessions do not grow the prompt without bound. */
const MAX_HISTORY_TURNS = 8

// Data freshness disclaimer appended to every response (BA §3.4)
const DATA_FRESHNESS_DATE = process.env.RAG_DATA_FRESHNESS_DATE ?? '2026-04-01'

export async function POST(req: NextRequest) {
  try {
    // Auth required — students only
    await requireAuth(req)

    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Câu hỏi không hợp lệ hoặc quá dài.' },
        { status: 422 }
      )
    }

    const { question, history } = parsed.data
    const recentHistory = (history ?? []).slice(-MAX_HISTORY_TURNS)

    const { stream, citations } = await ragChatStream(question, recentHistory)

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Data-Freshness-Date': DATA_FRESHNESS_DATE,
        // Base64 so Vietnamese text survives the header's latin-1 constraint.
        'X-Citations': Buffer.from(JSON.stringify(citations), 'utf8').toString('base64'),
        'Access-Control-Expose-Headers': 'X-Citations, X-Data-Freshness-Date',
      },
    })
  } catch (e) {
    if (e instanceof Response) return e
    console.error('[chat]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/chat
 * Returns data freshness info and supported schools (AC-C4).
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    supported_schools: SCHOOLS.map((s) => ({ code: s.code, name: s.name })),
    data_freshness_date: DATA_FRESHNESS_DATE,
    disclaimer:
      'Dữ liệu tham chiếu từ văn bản pháp quy chính thống. Vui lòng xác nhận với trường trước khi nộp hồ sơ chính thức.',
  })
}
