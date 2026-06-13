'use client'

import { AlertTriangle, FileText } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { Block } from '@/lib/teach/lessons/blocks'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'
import { GlossaryProvider } from '@/features/teach/context/GlossaryProvider'
import { ProseBlock } from '@/features/teach/components/blocks/ProseBlock'
import { HeadingBlock } from '@/features/teach/components/blocks/HeadingBlock'
import { CalloutBlock } from '@/features/teach/components/blocks/CalloutBlock'
import { CodeSampleBlock } from '@/features/teach/components/blocks/CodeSampleBlock'
import { GlossaryRefBlock } from '@/features/teach/components/blocks/GlossaryRefBlock'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'

export interface ReferenceViewProps {
  /** The reference id selected in the workspace store, or null to list them. */
  referenceId: string | null
}

/**
 * Render the static block subset a reference document is built from. References
 * are compressed, non-interactive cheat-sheets (syntax cards / algorithms), so
 * only the knowledge blocks (`prose` / `heading` / `callout` / `code_sample` /
 * `glossary_ref`) are meaningful; any other block type degrades to a safe
 * placeholder rather than wiring up interactive outcomes.
 */
function ReferenceBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case 'prose':
            return <ProseBlock key={key} block={block} />
          case 'heading':
            return <HeadingBlock key={key} block={block} />
          case 'callout':
            return <CalloutBlock key={key} block={block} />
          case 'code_sample':
            return <CodeSampleBlock key={key} block={block} />
          case 'glossary_ref':
            return <GlossaryRefBlock key={key} block={block} />
          default:
            return (
              <div
                key={key}
                data-testid="reference-unsupported-block"
                className="flex items-start gap-2 rounded-md border border-dashed border-amber-400/60 bg-amber-50/40 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  <Trans>速查文档暂不支持该内容块。</Trans>
                </span>
              </div>
            )
        }
      })}
    </div>
  )
}

/**
 * The reference view: teacher-authored cheat-sheets the learner revisits. When a
 * reference is selected it renders that document's blocks (resolving any
 * `glossary_ref` against the workspace glossary); otherwise it lists the
 * available references so the learner can pick one (each opens via the navigation
 * context). Reads references + glossary through the workspace repository.
 */
export function ReferenceView({ referenceId }: ReferenceViewProps) {
  const { repo } = useWorkspace()
  const { openReference } = useLessonNavigation()
  const { data: references, loading } = useWorkspaceResource(() => repo.listReferences(), [repo])
  const { data: glossary } = useWorkspaceResource(() => repo.getGlossary(), [repo])

  if (loading)
    return null

  const refs = references ?? []

  if (refs.length === 0) {
    return (
      <ViewEmptyState testId="references-empty" icon={FileText}>
        <Trans>还没有速查文档。老师会在合适的时候，把要点整理成可反复查阅的速查卡。</Trans>
      </ViewEmptyState>
    )
  }

  const selected = referenceId ? refs.find(ref => ref.id === referenceId) ?? null : null

  if (!selected) {
    return (
      <ul data-testid="reference-view-list" className="flex flex-col gap-2">
        {refs.map(ref => (
          <li key={ref.id}>
            <button
              type="button"
              data-testid="reference-list-item"
              onClick={() => openReference(ref.id)}
              className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-card/40 px-4 py-3 text-start text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{ref.title}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <GlossaryProvider terms={glossary?.terms ?? []}>
      <article data-testid="reference-view" className="flex flex-col gap-4">
        <h2 className="flex items-center gap-1.5 text-xl font-semibold text-foreground">
          <FileText aria-hidden="true" className="size-5 text-primary" />
          {selected.title}
        </h2>
        <ReferenceBlocks blocks={selected.blocks} />
      </article>
    </GlossaryProvider>
  )
}
