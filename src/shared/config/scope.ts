import { BIG6_SCHOOLS } from '@/shared/constants'

/**
 * Single source of truth for the chatbot's "Big 6 schools only" scope guard.
 * Built on top of BIG6_SCHOOLS (already used by the school-matching
 * "compass" feature) instead of redefining the school list — see
 * docs/rag-chatbot-worklist.md for why the 5 previously-independent
 * hardcoded copies of this list were consolidated here.
 */
export const SUPPORTED_SCHOOL_NAMES = BIG6_SCHOOLS.map((s) => s.short_name)

// Well-known other Vietnamese universities kept as a cheap fast-path
// denylist for zero-latency refusal before hitting retrieval/the LLM at
// all. This will never be exhaustive — the real safety net against
// out-of-scope hallucination is the similarity threshold in retrievePassages
// (the corpus only contains Big-6 documents, so an off-topic question
// naturally retrieves nothing above threshold regardless of keyword match).
const OTHER_KNOWN_SCHOOLS = ['fulbright', 'rmit', 'uel', 'ueh', 'neu', 'foreign trade']

function normalize(text: string): string {
  return text.toLowerCase()
}

export function mentionsSupportedSchool(text: string): boolean {
  const normalized = normalize(text)
  return BIG6_SCHOOLS.some(
    (school) =>
      normalized.includes(school.short_name.toLowerCase()) ||
      normalized.includes(school.school_name.toLowerCase())
  )
}

export function mentionsOtherKnownSchool(text: string): boolean {
  const normalized = normalize(text)
  return OTHER_KNOWN_SCHOOLS.some((keyword) => normalized.includes(keyword))
}

export const OUT_OF_SCOPE_MESSAGE = `Hiện tại hệ thống chỉ hỗ trợ Big 6 Schools: ${SUPPORTED_SCHOOL_NAMES.join(', ')}. Vui lòng hỏi về các trường này.`

export const SYSTEM_PROMPT_SCOPE_LINE = `Hiện tại hệ thống chỉ hỗ trợ Big 6: ${SUPPORTED_SCHOOL_NAMES.join(', ')}. Nếu hỏi về trường khác, nêu rõ giới hạn này.`
