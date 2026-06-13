'use client'

import { Archive, NotebookPen } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'

/**
 * The learning-records view: ADR-style notes the teacher appends when the learner
 * genuinely understands a non-trivial concept, discloses prior knowledge, corrects
 * a misconception, or the mission drifts. Records are never deleted — superseded
 * ones are kept and visually de-emphasised so the history stays auditable. Reads
 * the log through the workspace repository.
 */
export function RecordsView() {
  const { repo } = useWorkspace()
  const { data: records, loading } = useWorkspaceResource(() => repo.listLearningRecords(), [repo], 'learningRecords')

  if (loading)
    return null

  if (!records || records.length === 0) {
    return (
      <ViewEmptyState testId="records-empty" icon={NotebookPen}>
        <Trans>还没有学习记录。当你真正理解某个概念时，老师会记录下来，用来安排后续教学。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <ul data-testid="records-view" className="flex flex-col gap-3">
      {records.map(record => (
        <li
          key={record.id}
          data-testid={`record-${record.id}`}
          data-status={record.status}
          className={cn(
            'rounded-md border px-4 py-3',
            record.status === 'superseded'
              ? 'border-dashed border-border/50 bg-muted/10 opacity-70'
              : 'border-border/60 bg-card/40',
          )}
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {record.status === 'superseded'
              ? <Archive aria-hidden="true" className="size-4 text-muted-foreground" />
              : <NotebookPen aria-hidden="true" className="size-4 text-primary" />}
            <span className="min-w-0 flex-1">{record.title}</span>
            {record.status === 'superseded' && (
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                <Trans>已被取代</Trans>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{record.body}</p>
          {record.evidence && (
            <p className="mt-1.5 text-xs italic text-muted-foreground/80">{record.evidence}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
