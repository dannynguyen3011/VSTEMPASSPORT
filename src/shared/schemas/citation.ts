import { z } from 'zod'

export const citationSchema = z.object({
  document: z.string(),
  page: z.string(),
  published_date: z.string(),
  excerpt: z.string(),
})

export type Citation = z.infer<typeof citationSchema>

export const chatResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
})

export type ChatResponse = z.infer<typeof chatResponseSchema>
