import type { RichText } from '@/lib/ai/classroom/types'
import { ShikiInlineCode } from '@/features/tour-ai/components/ShikiCode'

function spanSignature(span: RichText[number]): string {
  if (span.type === 'code')
    return `code:${span.lang ?? ''}:${span.code}`
  if (span.type === 'strong')
    return `strong:${span.text}`
  return `text:${span.text}`
}

export function RichTextView({ body }: { body: RichText }) {
  const seen = new Map<string, number>()

  return (
    <>
      {body.map((span) => {
        const signature = spanSignature(span)
        const occurrence = seen.get(signature) ?? 0
        seen.set(signature, occurrence + 1)
        const key = `${signature}:${occurrence}`
        if (span.type === 'code')
          return <ShikiInlineCode key={key} code={span.code} language={span.lang} />
        if (span.type === 'strong')
          return <strong key={key}>{span.text}</strong>
        return <span key={key}>{span.text}</span>
      })}
    </>
  )
}
