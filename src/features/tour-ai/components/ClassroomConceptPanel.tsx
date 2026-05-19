'use client'

import { useMemo } from 'react'
import { Award, GraduationCap, Sprout, TrendingUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { deriveConceptProgress } from '@/lib/ai/classroom/selectors'
import { getConcept } from '@/lib/ai/concept-graph/loader'
import type { ConceptStatus } from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'
import { classroomFadeUpVariants, classroomStaggerVariants } from '@/features/tour-ai/components/classroom-motion'

interface ConceptGroup {
  status: Extract<ConceptStatus, 'demonstrated' | 'practicing' | 'introduced'>
  label: string
  helper: string
  icon: React.ReactNode
  ids: string[]
  tone: 'success' | 'warning' | 'neutral'
}

// Surface the previously-invisible `learner.concepts` ledger to the learner.
// The reducer has been quietly tracking what they've seen / are practicing /
// have demonstrated, but until now there was no UI that let them see their own
// progress. This panel groups by status and resolves concept ids through the
// static graph to display localised titles.
export function ClassroomConceptPanel({ lang }: { lang: string }) {
  const { session } = useClassroomSession()
  const progress = useMemo(() => deriveConceptProgress(session), [session])

  const groups = useMemo<ConceptGroup[]>(() => [
    {
      status: 'demonstrated',
      label: t`已掌握`,
      helper: t`通过练习证明掌握的概念`,
      icon: <Award className="size-3.5" />,
      ids: progress.demonstrated,
      tone: 'success',
    },
    {
      status: 'practicing',
      label: t`练习中`,
      helper: t`正在练习但尚未通过`,
      icon: <TrendingUp className="size-3.5" />,
      ids: progress.practicing,
      tone: 'warning',
    },
    {
      status: 'introduced',
      label: t`已学过`,
      helper: t`AI 已经讲解过的概念`,
      icon: <Sprout className="size-3.5" />,
      ids: progress.introduced,
      tone: 'neutral',
    },
  ], [progress])

  const totalTracked = progress.demonstrated.length + progress.practicing.length + progress.introduced.length
  const demonstratedCount = progress.demonstrated.length
  const empty = totalTracked === 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t`学习进度`}
          data-testid="classroom-concept-panel-trigger"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-tour-border bg-tour-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-tour-bg',
            !empty && 'text-tour-text',
          )}
        >
          <GraduationCap className="size-3.5" />
          {empty
            ? <Trans>进度</Trans>
            : (
                <span className="font-mono">
                  {demonstratedCount}
                  {' / '}
                  {totalTracked}
                </span>
              )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" data-testid="classroom-concept-panel-content">
        <div className="border-b border-tour-border px-4 py-3">
          <div className="text-sm font-semibold text-tour-text">
            <Trans>学习进度</Trans>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {empty
              ? <Trans>AI 会随着课程进展自动记录你掌握的概念。</Trans>
              : (
                  <Trans>
                    已掌握
                    {' '}
                    {demonstratedCount}
                    {' '}
                    个概念 / 接触过
                    {' '}
                    {totalTracked}
                    {' '}
                    个
                  </Trans>
                )}
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {empty
            ? (
                <motion.div
                  key="concept-panel-empty"
                  variants={classroomFadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="px-4 py-6 text-center text-xs text-muted-foreground"
                >
                  <Trans>开始第一节课，AI 会在这里记录你的进度。</Trans>
                </motion.div>
              )
            : (
                <motion.div
                  key="concept-panel-groups"
                  variants={classroomStaggerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="max-h-96 space-y-3 overflow-auto px-3 py-3"
                >
                  {groups.map(group => (
                    <ConceptGroupSection key={group.status} group={group} lang={lang} />
                  ))}
                </motion.div>
              )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}

function ConceptGroupSection({ group, lang }: { group: ConceptGroup, lang: string }) {
  if (group.ids.length === 0)
    return null

  const toneClass = group.tone === 'success'
    ? 'text-classroom-success-fg'
    : group.tone === 'warning' ? 'text-classroom-warning-fg' : 'text-muted-foreground'

  return (
    <motion.div variants={classroomFadeUpVariants} data-testid={`concept-group-${group.status}`}>
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold', toneClass)}>
        {group.icon}
        <span>{group.label}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {group.ids.length}
        </span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {group.ids.map(id => (
          <li key={id} className="text-xs leading-relaxed text-tour-text">
            <ConceptTitle conceptId={id} lang={lang} />
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function ConceptTitle({ conceptId, lang }: { conceptId: string, lang: string }) {
  const concept = getConcept(conceptId)
  if (!concept) {
    // Fallback for concept ids the agent invents that aren't in the static
    // graph yet — still surface the id so the learner sees *something* without
    // breaking the UI.
    return <span className="font-mono text-muted-foreground">{conceptId}</span>
  }
  const title = lang === 'en' ? concept.title.en : concept.title.zh
  return <span>{title}</span>
}
