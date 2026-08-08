import OpenAI from 'openai'

let _client: OpenAI | null = null

/**
 * Shared OpenAI-compatible client pointed at OpenRouter, used for both the
 * chat/LLM call and the embedding calls (one OPENROUTER_API_KEY for both).
 */
export function getOpenRouterClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys and set it in .env.local.'
      )
    }
    _client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    })
  }
  return _client
}
