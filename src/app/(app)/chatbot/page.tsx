'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Topbar } from '@/components/shared/Topbar'
import { getSession } from '@/shared/auth-client'
import { DEMO_CHAT } from '@/shared/constants'
import type { ChatMessage, Citation } from '@/types'
import { SendHorizonal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

/**
 * Signed-in users get real RAG answers from POST /api/chat, streamed token by
 * token. Signed-out visitors keep the canned DEMO_CHAT walkthrough, matching
 * how the other pages behave in demo mode.
 */
const DATA_REFRESHED_AT = '2026-04-03'
const NOT_FOUND_MESSAGE = 'Toi khong tim thay thong tin chinh thong cho cau hoi nay.'
const OUT_OF_SCOPE_MESSAGE = 'Hien tai he thong chi ho tro Big 6 Schools.'
const SUPPORTED_SCHOOLS = ['vinuni', 'hust', 'usth', 'vju', 'fulbright', 'swinburne']
const ERROR_MESSAGE =
  'Xin loi, khong the ket noi toi co van AI luc nay. Vui long thu lai sau it phut.'
/** Turns sent back as context. Server trims again; this just bounds the payload. */
const HISTORY_TURNS = 8

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function includesSupportedSchool(question: string) {
  const normalized = question.toLowerCase()
  return SUPPORTED_SCHOOLS.some((school) => normalized.includes(school))
}

function selectDemoAnswer(question: string): ChatMessage | null {
  const normalized = question.toLowerCase()

  if (normalized.includes('vinuni') && normalized.includes('sat')) {
    return DEMO_CHAT[1] ?? null
  }

  if (normalized.includes('hust') && (normalized.includes('tai nang') || normalized.includes('xet tuyen'))) {
    return DEMO_CHAT[3] ?? null
  }

  return null
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  /** null until the client has read localStorage — avoids a hydration mismatch. */
  const [isDemo, setIsDemo] = useState<boolean | null>(null)
  const chatContainerRef = useRef<HTMLElement | null>(null)

  const canSend = input.trim().length > 0 && !loading && isDemo !== null

  const latestUpdatedText = useMemo(
    () => `Cap nhat du lieu lan cuoi: ${DATA_REFRESHED_AT}`,
    []
  )

  useEffect(() => {
    const demo = !getSession()
    setIsDemo(demo)
    // Seed the canned transcript only in demo mode. Sending it as history for a
    // real user would feed fabricated citations back into the model's context.
    if (demo) setMessages(DEMO_CHAT)
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  /** Canned answers for signed-out visitors. */
  const answerFromDemo = async (question: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500))

    const outOfScope =
      !includesSupportedSchool(question) && /truong|dai hoc|university/i.test(question)
    const demoAnswer = selectDemoAnswer(question)

    const content = outOfScope
      ? OUT_OF_SCOPE_MESSAGE
      : demoAnswer
      ? demoAnswer.content
      : NOT_FOUND_MESSAGE

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `${content}\n\n${latestUpdatedText}`,
        citations: outOfScope || !demoAnswer ? [] : demoAnswer.citations,
        timestamp: new Date().toISOString(),
      },
    ])
  }

  /** Real RAG answer, streamed into a placeholder message as tokens arrive. */
  const answerFromApi = async (question: string, accessToken: string) => {
    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        citations: [],
        timestamp: new Date().toISOString(),
      },
    ])

    const history = messages.slice(-HISTORY_TURNS).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ question, history }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`chat request failed: ${response.status}`)
    }

    // Citations are known at retrieval time and ride along in a header, so the
    // cards can render as soon as the first token arrives.
    let citations: Citation[] = []
    const encoded = response.headers.get('X-Citations')
    if (encoded) {
      try {
        citations = JSON.parse(
          new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)))
        ) as Citation[]
      } catch {
        // A malformed header must not cost the user their answer.
      }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let content = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      content += decoder.decode(value, { stream: true })
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
      )
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content, citations } : m))
    )
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question) return

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question,
        citations: [],
        timestamp: new Date().toISOString(),
      },
    ])
    setInput('')
    setLoading(true)

    try {
      const session = getSession()
      if (session) await answerFromApi(question, session.access_token)
      else await answerFromDemo(question)
    } catch (error) {
      console.error('[chatbot]', error)
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: ERROR_MESSAGE,
          citations: [],
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="RAG Chatbot 24/7" />

      <main className="flex-1 p-4 sm:p-6 overflow-hidden">
        <div className="h-full bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <p className="text-sm text-foreground font-medium">Co van AI (co citation)</p>
            <p className="text-xs text-muted-foreground mt-1">
              Neu khong co thong tin chinh thong, chatbot se tu choi tra loi ngoai context.
            </p>
          </div>

          <section ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-card">
            {messages.map((message) => {
              const isAssistant = message.role === 'assistant'
              return (
                <article
                  key={message.id}
                  className={`max-w-[92%] sm:max-w-[80%] rounded-xl px-4 py-3 ${
                    isAssistant
                      ? 'bg-muted text-foreground mr-auto'
                      : 'bg-primary text-primary-foreground ml-auto'
                  }`}
                >
                  <div className={`text-sm leading-6 prose prose-sm max-w-none ${isAssistant ? 'prose-gray dark:prose-invert' : 'prose-invert'}`}>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  <p className={`text-[11px] mt-2 ${isAssistant ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                    {formatTime(message.timestamp)}
                  </p>

                  {isAssistant && message.citations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.citations.map((citation, index) => (
                        <div
                          key={`${message.id}-${index}`}
                          className="rounded-lg border border-border bg-background p-2.5 text-xs text-muted-foreground"
                        >
                          <p className="font-semibold text-foreground">
                            {citation.document}
                            {' '}
                            · Trang
                            {' '}
                            {citation.page}
                          </p>
                          <p className="mt-1">{citation.excerpt}</p>
                          <p className="mt-1 text-muted-foreground/70">
                            Published:
                            {' '}
                            {citation.published_date}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}

            {loading && (
              <div className="bg-muted text-muted-foreground rounded-xl px-4 py-3 max-w-[70%]">
                Dang tim citation chinh thong...
              </div>
            )}
          </section>

          <section className="border-t border-border bg-card p-4">
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder="Nhap cau hoi ve Big 6, SAT, GPA, IELTS, portfolio..."
                className="w-full flex-1 min-h-[52px] max-h-36 border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 bg-muted/50 text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!canSend}
                className="h-[52px] w-full sm:w-auto px-4 rounded-lg bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2 text-sm font-medium"
              >
                Gui
                <SendHorizonal className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
