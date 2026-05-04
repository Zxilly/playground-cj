'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Circle, RotateCcw, Target, Trash2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAIBridge } from '@/components/tour/EditorBridgeContext'
import type { ConceptStatus } from '@/lib/ai/learner-model'
import { useLearnerStore } from '@/stores/learner'
import { getAllConcepts } from '@/lib/ai/concept-graph/loader'
import { cn } from '@/lib/utils'

const SUPPORTED_LANGS = ['Python', 'Go', 'Rust', 'Java', 'Kotlin', 'TypeScript', 'C', 'C++', 'JavaScript'] as const

const STATUS_RANK: Record<ConceptStatus, number> = {
  mastered: 0,
  demonstrated: 1,
  practicing: 2,
  exposed: 3,
  blocked: 4,
  unseen: 5,
}

interface ProgressPanelProps {
  trigger: React.ReactNode
  onClearAll: () => void
}

export function ProgressPanel({ trigger, onClearAll }: ProgressPanelProps) {
  const { uiLang } = useAIBridge()
  const learner = useLearnerStore(state => state.learner)
  const setKnownLanguages = useLearnerStore(state => state.setKnownLanguages)
  const setAgentNotesSummary = useLearnerStore(state => state.setAgentNotesSummary)
  const setActiveQuiz = useLearnerStore(state => state.setActiveQuiz)
  const clear = useLearnerStore(state => state.clear)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)

  const conceptTitle = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of getAllConcepts())
      map.set(c.conceptId, c.title[uiLang] || c.title.zh)
    return map
  }, [uiLang])

  const stats = useMemo(() => {
    const counts: Record<ConceptStatus, number> = {
      unseen: 0,
      exposed: 0,
      practicing: 0,
      demonstrated: 0,
      mastered: 0,
      blocked: 0,
    }
    for (const c of Object.values(learner.concepts))
      counts[c.status] += 1
    return counts
  }, [learner.concepts])

  const sortedConcepts = useMemo(() => {
    return Object.values(learner.concepts).sort((a, b) => {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (r !== 0)
        return r
      return (b.lastTouchedAt ?? 0) - (a.lastTouchedAt ?? 0)
    })
  }, [learner.concepts])

  const toggleLang = (l: string) => {
    const has = learner.knownLanguages.includes(l)
    const next = has
      ? learner.knownLanguages.filter(x => x !== l)
      : [...learner.knownLanguages, l]
    setKnownLanguages(next)
  }

  const saveNotes = () => {
    if (notesDraft === null)
      return
    setAgentNotesSummary(notesDraft)
    setNotesDraft(null)
  }

  const clearAll = () => {
    clear()
    onClearAll()
  }

  const cancelQuiz = () => setActiveQuiz(null)

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle><Trans>学习进度</Trans></SheetTitle>
          <SheetDescription>
            <Trans>由 AI 私教维护。你可以在这里纠正背景语言或重置全部进度。</Trans>
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5 text-sm">
          {/* Overview */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5"><Trans>概览</Trans></h3>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t`已掌握`} value={stats.mastered} tone="ok" />
              <Stat label={t`已演示`} value={stats.demonstrated} tone="ok" />
              <Stat label={t`正在练`} value={stats.practicing} tone="info" />
              <Stat label={t`已接触`} value={stats.exposed} tone="muted" />
              <Stat label={t`卡住`} value={stats.blocked} tone="warn" />
              <Stat label={t`总概念`} value={getAllConcepts().length} tone="muted" />
            </div>
          </section>

          {/* Active Quiz */}
          {learner.activeQuiz && (
            <section className="rounded-md border border-tour-teal/40 bg-tour-teal/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <Target className="size-3.5 text-tour-teal" />
                <span className="font-semibold"><Trans>当前测验</Trans></span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {t`尝试`}
                  {' '}
                  {learner.activeQuiz.attempts}
                </span>
              </div>
              <div className="text-foreground/80 text-xs whitespace-pre-wrap leading-snug">
                {learner.activeQuiz.prompt[uiLang] || learner.activeQuiz.prompt.zh}
              </div>
              <button
                onClick={cancelQuiz}
                className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                <Trans>放弃此测验</Trans>
              </button>
            </section>
          )}

          {/* Concepts */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5"><Trans>概念列表</Trans></h3>
            {sortedConcepts.length === 0
              ? (
                  <p className="text-xs text-muted-foreground">
                    <Trans>暂无记录。开始与 AI 私教对话后会在这里显示。</Trans>
                  </p>
                )
              : (
                  <ul className="space-y-1.5">
                    {sortedConcepts.map(c => (
                      <li key={c.conceptId} className="flex items-start gap-2 text-xs">
                        <StatusIcon status={c.status} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground/90 truncate">
                            {conceptTitle.get(c.conceptId) ?? c.conceptId}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.status}
                            {' '}
                            · ✓
                            {c.evidenceCount.success}
                            {' '}
                            ⏸
                            {c.evidenceCount.partial}
                            {' '}
                            ✗
                            {c.evidenceCount.failed}
                            {c.notes ? ` · ${c.notes}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
          </section>

          {/* Known languages */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
              <Trans>我会的语言（背景）</Trans>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_LANGS.map((l) => {
                const active = learner.knownLanguages.includes(l)
                return (
                  <button
                    key={l}
                    onClick={() => toggleLang(l)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                      active
                        ? 'border-tour-teal/50 bg-tour-teal/15 text-tour-teal'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Agent notes */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">
              <Trans>AI 备忘</Trans>
            </h3>
            {notesDraft === null
              ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap min-h-[2em]">
                      {learner.agentNotesSummary || <span className="text-muted-foreground italic">{t`（尚未记录）`}</span>}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNotesDraft(learner.agentNotesSummary ?? '')}
                        className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                      >
                        <Trans>编辑</Trans>
                      </button>
                      {learner.agentNotesSummary && (
                        <button
                          onClick={() => setAgentNotesSummary(undefined)}
                          className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                        >
                          <Trans>清空</Trans>
                        </button>
                      )}
                    </div>
                  </div>
                )
              : (
                  <div className="space-y-1.5">
                    <textarea
                      value={notesDraft}
                      maxLength={300}
                      onChange={e => setNotesDraft(e.target.value)}
                      className="w-full text-xs border border-border rounded-md p-2 bg-background"
                      rows={4}
                      placeholder={t`简短记录学习者背景或近期易错点（最多 300 字符）`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveNotes}
                        className="text-[11px] rounded bg-tour-teal/15 text-tour-teal px-2 py-0.5 hover:bg-tour-teal/25"
                      >
                        <Trans>保存</Trans>
                      </button>
                      <button
                        onClick={() => setNotesDraft(null)}
                        className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                      >
                        <Trans>取消</Trans>
                      </button>
                    </div>
                  </div>
                )}
          </section>

          {/* Reset */}
          <section className="border-t border-border pt-3">
            <SheetClose asChild>
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-2.5 py-1 text-xs hover:bg-destructive/20"
              >
                <Trash2 className="size-3" />
                <Trans>清空所有进度与对话</Trans>
              </button>
            </SheetClose>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              <Trans>会同时清掉本地保存的概念状态、证据计数、当前测验和聊天历史。</Trans>
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value, tone }: { label: string, value: number, tone: 'ok' | 'info' | 'warn' | 'muted' }) {
  const toneClass = {
    ok: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    info: 'border-tour-teal/30 bg-tour-teal/5 text-tour-teal',
    warn: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    muted: 'border-border bg-muted/30 text-muted-foreground',
  }[tone]
  return (
    <div className={cn('rounded-md border px-2 py-1.5 text-center', toneClass)}>
      <div className="text-base font-semibold leading-none">{value}</div>
      <div className="text-[10px] mt-0.5 leading-none">{label}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: ConceptStatus }) {
  if (status === 'mastered' || status === 'demonstrated')
    return <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5" />
  if (status === 'blocked')
    return <AlertCircle className="size-3.5 text-amber-500 mt-0.5" />
  if (status === 'practicing')
    return <RotateCcw className="size-3.5 text-tour-teal mt-0.5" />
  return <Circle className="size-3.5 text-muted-foreground mt-0.5" />
}
