import type { RichText } from '@/lib/ai/classroom/types'

export function textFor(lang: string, text: Record<string, string>): string {
  return text[lang] || text.zh || text.en || ''
}

export function richTextPlainText(body: RichText): string {
  return body.map(span => 'text' in span ? span.text : 'code' in span ? span.code : span.strong).join('')
}
