import type { RichText } from '@/lib/ai/classroom/types'

export function RichTextView({ body }: { body: RichText }) {
  return (
    <>
      {body.map((span) => {
        if ('code' in span)
          return <code key={`code:${span.code}`} className="rounded bg-tour-code-bg px-1 font-mono text-[0.95em]">{span.code}</code>
        if ('strong' in span)
          return <strong key={`strong:${span.strong}`}>{span.strong}</strong>
        return <span key={`text:${span.text}`}>{span.text}</span>
      })}
    </>
  )
}
