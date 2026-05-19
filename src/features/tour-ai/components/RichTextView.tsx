import type { RichText } from '@/lib/ai/classroom/types'
import { ShikiInlineCode } from '@/features/tour-ai/components/ShikiCode'

export function RichTextView({ body }: { body: RichText }) {
  return (
    <>
      {body.map((span, idx) => {
        if (span.type === 'code')
          return <ShikiInlineCode key={idx} code={span.code} language={span.lang} />
        if (span.type === 'strong')
          return <strong key={idx}>{span.text}</strong>
        return <span key={idx}>{span.text}</span>
      })}
    </>
  )
}
