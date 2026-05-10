import type { RichText } from '@/lib/ai/classroom/types'

export function RichTextView({ body }: { body: RichText }) {
  return (
    <>
      {body.map((span, idx) => {
        if ('code' in span)
          return <code key={idx} className="rounded bg-tour-code-bg px-1 font-mono text-[0.95em]">{span.code}</code>
        if ('strong' in span)
          return <strong key={idx}>{span.strong}</strong>
        return <span key={idx}>{span.text}</span>
      })}
    </>
  )
}
