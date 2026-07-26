'use client'

import { Activity, CircleDashed } from 'lucide-react'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { deriveConceptProgress } from '@/lib/teach/classroom/progress'
import type { ConceptProgress } from '@/lib/teach/classroom/progress'
import { formatRevisionLabel } from '@/lib/teach/classroom/revision-label'
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
          Concept Progress
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          {english ? 'Evidence-derived progress' : '由学习证据推导的进度'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {english
            ? 'The teacher cannot assign these states. They are derived from observable attempts across each concept’s Learning Skills.'
            : '老师不能直接设置这些状态；它们只由各概念 Learning Skill 上的可观察尝试推导。'}
        </p>
        <p className="mt-2 max-w-2xl rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          {english
            ? 'This is browser-local self-practice progress, not a server-attested assessment or credential.'
            : '这是浏览器本地的自我练习进度，不是服务端证明的评估或凭证。'}
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {catalog.list().map((summary) => {
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
                  <p
                    className="mt-1 font-mono text-xs text-muted-foreground"
                    title={`Content Version ${summary.version}`}
                  >
                    v
                    {formatRevisionLabel(summary.version)}
                  </p>
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
                  : (english ? 'Read-only concept' : '只读概念')}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {english
                  ? `${evidence.length} evidence records · ${successes} observable successes`
                  : `${evidence.length} 条证据 · ${successes} 次可观察成功`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
