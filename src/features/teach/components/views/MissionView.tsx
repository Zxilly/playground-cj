'use client'

import { Ban, Compass, Lock, Sparkles, Target } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'
import { WorkspaceViewSkeleton } from './WorkspaceViewSkeleton'

function Section({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof Target
  label: ReactNode
  items: string[]
}) {
  if (items.length === 0)
    return null
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon aria-hidden="true" className="size-4 text-primary" />
        {label}
      </h3>
      <ul className="flex flex-col gap-1 ps-1">
        {items.map((item, index) => (
          // Index-prefixed: these are plain, render-only string lists that can
          // contain duplicate entries, so a pure-content key is not unique.
          // eslint-disable-next-line react/no-array-index-key
          <li key={`${index}-${item}`} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The mission document view: the learner's *why* for learning Cangjie, which
 * grounds every lesson. Reads the mission through the workspace repository. When
 * no mission exists yet, it points the learner at the teacher chat — mission is
 * established by an intake interview, never invented by the UI.
 */
export function MissionView() {
  const { repo } = useWorkspace()
  const { data: mission, loading } = useWorkspaceResource(() => repo.getMission(), [repo], 'mission')

  if (loading)
    return <WorkspaceViewSkeleton />

  if (!mission) {
    return (
      <ViewEmptyState testId="mission-empty" icon={Compass}>
        <Trans>尚未设定学习目标。请先与老师沟通你学习仓颉的目的，共同确定目标。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <article data-testid="mission-view" className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Target aria-hidden="true" className="size-3.5" />
          <Trans>学习目标</Trans>
        </p>
        <h2 className="text-xl font-semibold text-foreground">{mission.topic}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{mission.why}</p>
      </header>

      <Section icon={Sparkles} label={<Trans>达成的样子</Trans>} items={mission.successLooksLike} />
      <Section icon={Lock} label={<Trans>约束</Trans>} items={mission.constraints} />
      <Section icon={Ban} label={<Trans>不在范围内</Trans>} items={mission.outOfScope} />
    </article>
  )
}
