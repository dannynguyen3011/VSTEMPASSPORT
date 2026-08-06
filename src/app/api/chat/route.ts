/**
 * POST /api/chat
 *
 * RAG Chatbot endpoint — Streaming response (BA §2.5)
 * Anti-hallucination: citation required, fallback if no context found.
 *
 * Body: { question: string }
 * Response: text/plain stream (Server-Sent Events compatible)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/backend/auth'
import { ragChatStream } from '@/backend/rag'

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

    // Guard: scope enforcement (BA AC-C4)
    const outOfScopeKeywords = ['rmit', 'uel', 'ueh', 'neu', 'foreign trade']
    const isOutOfScope = outOfScopeKeywords.some((kw) =>
      question.toLowerCase().includes(kw)
    )
    if (isOutOfScope) {
      const msg =
        'Hiện tại hệ thống chỉ hỗ trợ Big 6 Schools: VinUni, HUST, USTH, VJU, Fulbright, Swinburne Việt Nam. Vui lòng hỏi về các trường này.'
      return new NextResponse(msg, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Get RAG stream
    const stream = await ragChatStream(question)

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Data-Freshness-Date': DATA_FRESHNESS_DATE,
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
    supported_schools: ['VinUni', 'HUST', 'USTH', 'VJU', 'Fulbright', 'Swinburne'],
    data_freshness_date: DATA_FRESHNESS_DATE,
    disclaimer:
      'Dữ liệu tham chiếu từ văn bản pháp quy chính thống. Vui lòng xác nhận với trường trước khi nộp hồ sơ chính thức.',
  })
}
