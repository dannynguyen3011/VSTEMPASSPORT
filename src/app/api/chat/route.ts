/**
 * POST /api/chat
 *
 * RAG Chatbot endpoint — synchronous JSON response (BA §2.5)
 * Anti-hallucination: citation required, fallback if no context found.
 *
 * Body: { question: string }
 * Response: { answer: string, citations: Citation[], data_freshness_date: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/backend/auth'
import { ragChat } from '@/backend/rag'
import { mentionsOtherKnownSchool, OUT_OF_SCOPE_MESSAGE, SUPPORTED_SCHOOL_NAMES } from '@/shared/config/scope'

const requestSchema = z.object({
  question: z.string().min(1).max(1000),
})

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

    const { question } = parsed.data

    // Guard: scope enforcement (BA AC-C4) — cheap fast-path refusal before
    // hitting retrieval/the LLM at all; the similarity threshold in
    // retrievePassages is the real safety net for anything this misses.
    if (mentionsOtherKnownSchool(question)) {
      return NextResponse.json({
        answer: OUT_OF_SCOPE_MESSAGE,
        citations: [],
        data_freshness_date: DATA_FRESHNESS_DATE,
      })
    }

    const result = await ragChat(question)

    return NextResponse.json({
      ...result,
      data_freshness_date: DATA_FRESHNESS_DATE,
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
    supported_schools: SUPPORTED_SCHOOL_NAMES,
    data_freshness_date: DATA_FRESHNESS_DATE,
    disclaimer:
      'Dữ liệu tham chiếu từ văn bản pháp quy chính thống. Vui lòng xác nhận với trường trước khi nộp hồ sơ chính thức.',
  })
}
