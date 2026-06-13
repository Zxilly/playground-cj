import { z } from 'zod'

export const retrievalItemSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  blockId: z.string(),
  kind: z.enum(['quiz', 'recall']),
  dueAt: z.number(),
  intervalDays: z.number(),
  ease: z.number(),
  history: z.array(z.object({ at: z.number(), grade: z.enum(['again', 'good']) })),
})
export type RetrievalItem = z.infer<typeof retrievalItemSchema>
