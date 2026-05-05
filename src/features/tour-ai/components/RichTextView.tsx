import type { RichText } from '@/lib/ai/classroom/types'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'

export function RichTextView({ body }: { body: RichText }) {
  return (
    <>
      {body.map((span) => {
        if ('code' in span)
          return <code key={`code:${span.code}`} className={aiClassroomStyles.code.inline}>{span.code}</code>
        if ('strong' in span)
          return <strong key={`strong:${span.strong}`}>{span.strong}</strong>
        return <span key={`text:${span.text}`}>{span.text}</span>
      })}
    </>
  )
}
