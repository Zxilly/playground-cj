import type { RichText } from '@/lib/ai/classroom/types'
import { ShikiInlineCode } from '@/features/tour-ai/components/ShikiCode'

export function RichTextView({ body }: { body: RichText }) {
  return (
    <>
      {body.map((span, idx) => {
        if ('code' in span)
          return <ShikiInlineCode key={idx} code={span.code} language={span.lang ?? span.language} />
        if ('strong' in span)
          return <strong key={idx}>{span.strong}</strong>
        return <span key={idx}>{span.text}</span>
      })}
    </>
  )
}
