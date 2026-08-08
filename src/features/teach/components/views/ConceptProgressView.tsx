'use client'

import { Activity, CircleDashed } from 'lucide-react'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { deriveConceptProgress } from '@/lib/teach/classroom/progress'
import type { ConceptProgress } from '@/lib/teach/classroom/progress'
import { cn } from '@/lib/utils'

const PROGRESS_COPY: Record<ConceptProgress, { zh: string, en: string }> = {
  unseen: { zh: '未接触', en: 'Unseen' },
  seen: { zh: '已接触', en: 'Seen' },
  practicing: { zh: '练习中', en: 'Practicing' },
  demonstrated: { zh: '已证明', en: 'Demonstrated' },
  blocked: { zh: '受阻', en: 'Blocked' },
  stale: { zh: '证据过期', en: 'Stale' },
}

export function ConceptProgressView() {
  const { catalog, classroom, lang } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const english = lang === 'en'

  return (
    <section data-testid="concept-progress-view" className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Activity aria-hidden="true" className="size-4" />
          {english ? 'Learning progress' : '学习进度'}
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          {english ? 'Evidence-derived progress' : '由学习证据推导的进度'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {english
            ? 'The teacher cannot assign these states. They are derived from observable attempts across each concept’s Learning Skills.'
            : '老师不能直接设置这些状态；它们只由你的练习结果推导。'}
        </p>
        <p className="mt-2 max-w-2xl rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          {english
            ? 'Your classroom activity and progress stay in this browser.'
            : '你的课堂活动和学习进度保存在当前浏览器中。'}
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {catalog.list().filter(summary =>
          summary.availability === 'validated').map((summary) => {
          const pack = catalog.get(summary.conceptId)
          if (!pack)
            return null
          const progress = summary.availability === 'validated'
            ? deriveConceptProgress(snapshot, pack)
            : null
          const evidence = snapshot.evidence.filter(item => item.conceptId === summary.conceptId)
          const successes = evidence.filter(item => item.outcome === 'success').length
          return (
            <li key={summary.conceptId} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{summary.title}</h2>
                </div>
                <CircleDashed aria-hidden="true" className="size-5 text-muted-foreground" />
              </div>
              <p className={cn(
                'mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                progress === 'demonstrated'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : progress === 'blocked'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground',
              )}
              >
                {progress
                  ? PROGRESS_COPY[progress][english ? 'en' : 'zh']
                  : null}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {english
                  ? `${evidence.length} evidence records · ${successes} observable successes`
                  : `${evidence.length} 次练习记录 · ${successes} 次成功`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
