/**
 * Shared OpenAI client — used for both embeddings and answer generation.
 *
 * One key (OPENAI_API_KEY) covers both, so there is a single credential to
 * manage. Anthropic is still a dependency of the offline ingest pipeline
 * (scripts/rag/ocr.ts transcribes scanned pages, scripts/rag/manifest.ts reads
 * document letterheads) but is no longer on the request path.
 */
import OpenAI from 'openai'

/**
 * Chat model for answering. Override with OPENAI_CHAT_MODEL.
 *
 * gpt-4.1 rather than a reasoning model, measured on this corpus with eight
 * retrieved passages:
 *
 *              first token    complete
 *   gpt-5.5        8142ms      12140ms
 *   gpt-4.1         635ms       3158ms
 *
 * A reasoning model emits nothing until it has finished thinking, so streaming
 * cannot hide the wait — the student sees eight seconds of dead air. The task
 * here is not reasoning-heavy either: the passages are already retrieved and
 * the citation strings are supplied ready-made, so the model is extracting and
 * attributing rather than working anything out.
 *
 * Set OPENAI_CHAT_MODEL=gpt-5.5 if answer quality on multi-document questions
 * turns out to matter more than latency.
 */
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4.1'

let _client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }
    _client = new OpenAI({ apiKey })
  }
  return _client
}
