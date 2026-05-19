// richTextPlainText now lives alongside the new shape in
// `@/lib/ai/classroom/rich-text` — re-export to keep existing imports working.
export { richTextPlainText } from '@/lib/ai/classroom/rich-text'

export function textFor(lang: string, text: Record<string, string>): string {
  return text[lang] || text.zh || text.en || ''
}
