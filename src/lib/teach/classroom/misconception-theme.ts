import { z } from 'zod'

export function normalizeMisconceptionTheme(theme: string): string {
  return theme
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

export const misconceptionThemeSchema = z.string()
  .trim()
  .min(1)
  .max(500)
  .refine(theme => normalizeMisconceptionTheme(theme).length > 0, {
    message: 'misconception theme must contain a letter or number',
  })
