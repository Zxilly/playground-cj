'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, MessageCircle, Play, SkipForward, X } from 'lucide-react'
import type { FlatSection } from '@/tour/types'
import { AIBridgeProvider, useAIBridge } from '@/components/tour/EditorBridgeContext'
import { TourEditor } from '@/components/tour/TourEditor'
import { aiClassroomStyles } from '@/components/tour/ai/ai-classroom-design'
import {
  appendLessonAuthorProgress,
  EMPTY_AUTHOR_PROGRESS,
} from '@/components/tour/ai/lesson-author-progress-state'
import { LessonAuthorProgressPanel } from '@/components/tour/ai/LessonAuthorProgressPanel'
import { TourAIChat } from '@/components/tour/ai/TourAIChat'
import { createLessonAuthorToolkit } from '@/components/tour/ai/tools'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { cn, isDarkMode } from '@/lib/utils'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { createClassroomTransaction } from '@/lib/ai/classroom/transaction'
import { usePersistentClassroomSession } from '@/lib/ai/classroom/use-persistent-session'
import type {
  ClassroomEvent,
  ClassroomQuiz,
  ClassroomSession,
  ClassroomStreamItem,
  LessonContentBlock,
  RichText,
  RunResult,
} from '@/lib/ai/classroom/types'
import {
  clearChatAnnotations as clearChatAnnotationState,
  createEditorAnnotationState,
  replaceChatAnnotations as replaceChatAnnotationState,
} from '@/lib/ai/classroom/editor-annotations'
import type { EditorAnnotationState, NewChatAnnotation } from '@/lib/ai/classroom/editor-annotations'
import { runLessonAuthorStep } from '@/lib/ai/lesson-author-runner'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { requestRemoteAction } from '@/service/run'

interface TourAIAppProps {
  lang: string
  allSections: FlatSection[]
}

function textFor(lang: string, text: Record<string, string>): string {
  return text[lang] || text.zh || text.en || ''
}

export default function TourAIApp({ lang, allSections }: TourAIAppProps) {
  const { session, dispatch, hydrated } = usePersistentClassroomSession({ lang })
  const sessionRef = useRef(session)
  const [annotationState, setAnnotationState] = useState<EditorAnnotationState>(() => createEditorAnnotationState())

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const classroom = useMemo(() => ({
    getSession: () => sessionRef.current,
    dispatch: (action: ClassroomAction) => dispatch(action),
    replaceChatAnnotations: (annotations: NewChatAnnotation[]) => {
      setAnnotationState(state => replaceChatAnnotationState(state, annotations))
    },
    clearChatAnnotations: () => {
      setAnnotationState(state => clearChatAnnotationState(state))
    },
  }), [dispatch])

  return (
    <AIBridgeProvider lang={lang} allSections={allSections} classroom={classroom}>
      <ClassroomShell
        lang={lang}
        allSections={allSections}
        session={session}
        dispatch={dispatch}
        hydrated={hydrated}
        annotationState={annotationState}
      />
    </AIBridgeProvider>
  )
}

function ClassroomShell({
  lang,
  allSections,
  session,
  dispatch,
  hydrated,
  annotationState,
}: {
  lang: string
  allSections: FlatSection[]
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  annotationState: EditorAnnotationState
}) {
  const bridge = useAIBridge()
  const config = useLLMConfig()
  const applyAutoKey = useLLMConfigStore(state => state.applyAutoKey)
  const keySource = useLLMConfigStore(state => state.keySource)
  const [chatOpen, setChatOpen] = useState(false)
  const [authorRunning, setAuthorRunning] = useState(false)
  const [authorProgress, setAuthorProgress] = useState(EMPTY_AUTHOR_PROGRESS)
  const appendAuthorProgressRef = useRef<(chunk: string) => void>(() => {})
  const ranPageOpenRef = useRef(false)
  const runningEventRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const authorAbortRef = useRef<AbortController | null>(null)
  const currentSection = allSections[0]

  appendAuthorProgressRef.current = (chunk: string) => {
    setAuthorProgress(state => appendLessonAuthorProgress(state, chunk))
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      authorAbortRef.current?.abort()
      authorAbortRef.current = null
    }
  }, [])

  useEffect(() => {
    if (config.apiKey || keySource !== 'auto')
      return
    let cancelled = false
    fetch('/api/ai-key', { method: 'GET' })
      .then(async (resp) => {
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}`)
        return resp.json() as Promise<{ baseURL: string, apiKey: string, model: string }>
      })
      .then((data) => {
        if (!cancelled)
          applyAutoKey(data)
      })
      .catch(() => {
        // Keep the classroom visible even when no built-in key is available.
      })
    return () => {
      cancelled = true
    }
  }, [applyAutoKey, config.apiKey, keySource])

  const runAuthor = useCallback(async (event: ClassroomEvent, consumeQueuedEvent: boolean): Promise<boolean> => {
    if (!config.apiKey || authorRunning || !mountedRef.current)
      return false
    const abortController = new AbortController()
    authorAbortRef.current = abortController
    setAuthorRunning(true)
    setAuthorProgress({
      status: 'running',
      expanded: true,
      text: '',
    })
    dispatch({ type: 'LESSON_AUTHOR_STARTED', now: Date.now() })
    const transaction = createClassroomTransaction(bridge)
    try {
      const transactionBridge = transaction.bridge
      await runLessonAuthorStep({
        config,
        toolkit: createLessonAuthorToolkit(transactionBridge),
        bridge: transactionBridge,
        event,
        abortSignal: abortController.signal,
        onProgress: (chunk) => {
          if (abortController.signal.aborted || !mountedRef.current)
            return
          queueMicrotask(() => {
            if (abortController.signal.aborted || !mountedRef.current)
              return
            appendAuthorProgressRef.current(chunk)
          })
        },
      })
      if (abortController.signal.aborted || !mountedRef.current) {
        transaction.discard()
        return false
      }
      transaction.commit(consumeQueuedEvent ? [{ type: 'CONSUME_EVENT', now: Date.now() }] : [])
      setAuthorProgress(state => ({
        ...state,
        status: 'completed',
        expanded: false,
      }))
      return true
    }
    catch (error) {
      transaction.discard()
      if (abortController.signal.aborted || !mountedRef.current)
        return false
      dispatch({
        type: 'LESSON_AUTHOR_FAILED',
        error: (error as Error).message,
        now: Date.now(),
      })
      setAuthorProgress(state => appendLessonAuthorProgress({
        ...state,
        status: 'failed',
        expanded: true,
      }, `\n失败：${(error as Error).message}`))
      return false
    }
    finally {
      if (authorAbortRef.current === abortController)
        authorAbortRef.current = null
      if (mountedRef.current)
        setAuthorRunning(false)
    }
  }, [authorRunning, bridge, config, dispatch])

  useEffect(() => {
    if (ranPageOpenRef.current || !hydrated || !currentSection || !config.apiKey || session.stream.length > 0 || session.eventQueue.length > 0)
      return
    ranPageOpenRef.current = true
    void runAuthor({
      type: 'page_opened',
      createdAt: Date.now(),
      summary: `Opened ${textFor(lang, currentSection.sectionName)}.`,
    }, false)
  }, [config.apiKey, currentSection, hydrated, lang, runAuthor, session.eventQueue.length, session.stream.length])

  useEffect(() => {
    const next = session.eventQueue[0]
    if (!next || authorRunning)
      return
    const key = `${next.type}:${next.createdAt}`
    if (runningEventRef.current === key)
      return
    runningEventRef.current = key
    void runAuthor(next, true).then((completed) => {
      if (completed && runningEventRef.current === key)
        runningEventRef.current = null
    })
  }, [authorRunning, runAuthor, session.eventQueue])

  const retryQueuedAuthorEvent = useCallback(() => {
    const next = session.eventQueue[0]
    if (!next || authorRunning)
      return
    const key = `${next.type}:${next.createdAt}`
    runningEventRef.current = key
    void runAuthor(next, true).then((completed) => {
      if (completed && runningEventRef.current === key)
        runningEventRef.current = null
    })
  }, [authorRunning, runAuthor, session.eventQueue])

  if (!currentSection)
    return null

  return (
    <div
      data-testid="ai-classroom-root"
      className={cn(aiClassroomStyles.layout.root, isDarkMode() && 'dark')}
      style={{
        'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
        '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
      } as React.CSSProperties}
    >
      <div className={aiClassroomStyles.layout.shell}>
        <main className={aiClassroomStyles.layout.main}>
          <header data-testid="ai-classroom-header" className={aiClassroomStyles.header.root}>
            <div className={aiClassroomStyles.header.content}>
              <div className={aiClassroomStyles.header.brandMark}>仓</div>
              <div className={aiClassroomStyles.header.title}>AI Mode Classroom</div>
              <span className={aiClassroomStyles.header.subtitle}>{textFor(lang, currentSection.sectionName)}</span>
              <span data-testid="classroom-phase" className={aiClassroomStyles.badge.phase}>
                {session.phase}
              </span>
            </div>
            <button
              type="button"
              aria-label="打开 ChatAgent"
              onClick={() => setChatOpen(true)}
              className={aiClassroomStyles.button.secondary}
            >
              <MessageCircle className="size-4" />
              ChatAgent
            </button>
          </header>

          <div className={aiClassroomStyles.layout.viewport}>
            <div className={aiClassroomStyles.layout.content}>
              <section className={aiClassroomStyles.layout.sectionIntro}>
                <div className={aiClassroomStyles.text.eyebrow}>Continuous Classroom Stream</div>
                <h1 className={aiClassroomStyles.text.pageTitle}>{textFor(lang, currentSection.sectionName)}</h1>
              </section>

              <ClassroomStream session={session} lang={lang} dispatch={dispatch} bridge={bridge} />

              <LessonAuthorProgressPanel
                progress={authorProgress}
                visible={session.pendingAction === 'lesson_author' || authorRunning || authorProgress.status !== 'idle'}
                onToggle={() => setAuthorProgress(state => ({ ...state, expanded: !state.expanded }))}
              />

              {annotationState.annotations.some(annotation => annotation.namespace === 'chat' && annotation.stale) && (
                <div className={cn(aiClassroomStyles.text.warning, 'mt-3')}>ChatAgent 标注已过期</div>
              )}

              <AuthorErrorRetry session={session} onRetry={retryQueuedAuthorEvent} />
            </div>
          </div>
        </main>

        {chatOpen && (
          <aside className={aiClassroomStyles.layout.sidebar}>
            <div className={aiClassroomStyles.header.sidebarHeader}>
              <div className={aiClassroomStyles.text.label}>ChatAgent</div>
              <button
                type="button"
                aria-label="关闭 ChatAgent"
                onClick={() => setChatOpen(false)}
                className={aiClassroomStyles.button.icon}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className={aiClassroomStyles.layout.sidebarBody}>
              <TourAIChat />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function ClassroomStream({
  session,
  lang,
  dispatch,
  bridge,
}: {
  session: ClassroomSession
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: ReturnType<typeof useAIBridge>
}) {
  if (session.stream.length === 0) {
    return (
      <div className={aiClassroomStyles.surface.muted}>
        正在规划下一步
      </div>
    )
  }

  return (
    <div className={aiClassroomStyles.stream.list}>
      {session.stream.map(item => (
        <StreamItemView
          key={item.id}
          item={item}
          currentQuiz={session.currentQuiz}
          lang={lang}
          dispatch={dispatch}
          bridge={bridge}
        />
      ))}
    </div>
  )
}

function AuthorErrorRetry({ session, onRetry }: { session: ClassroomSession, onRetry: () => void }) {
  const lastError = [...session.stream].reverse().find(
    item => item.type === 'system_event' && item.event.type === 'lesson_author_error',
  )

  if (!lastError || lastError.type !== 'system_event' || lastError.event.type !== 'lesson_author_error' || session.eventQueue.length === 0)
    return null

  return (
    <section className={cn(aiClassroomStyles.surface.warning, 'mt-4')}>
      <div className="mb-2">
        LessonAuthor 失败：
        {lastError.event.summary}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={aiClassroomStyles.button.warning}
      >
        重试 LessonAuthor
      </button>
    </section>
  )
}

function StreamItemView({
  item,
  currentQuiz,
  lang,
  dispatch,
  bridge,
}: {
  item: ClassroomStreamItem
  currentQuiz: ClassroomQuiz | null
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: ReturnType<typeof useAIBridge>
}) {
  if (item.type === 'lesson_blocks') {
    return (
      <div className={aiClassroomStyles.stream.lessonBlocks}>
        {item.blocks.map(block => (
          <LessonBlockView key={lessonBlockKey(block)} block={block} />
        ))}
      </div>
    )
  }

  if (item.type === 'quiz') {
    return (
      <QuizPracticeCard
        quiz={item.quiz}
        isActive={Boolean(currentQuiz && currentQuiz.createdAt === item.quiz.createdAt && currentQuiz.status === 'active')}
        lang={lang}
        dispatch={dispatch}
        bridge={bridge}
      />
    )
  }

  if (item.type === 'run_result') {
    return (
      <section className={cn(aiClassroomStyles.surface.card, 'text-sm')}>
        <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-2')}>运行结果</div>
        <pre className={aiClassroomStyles.code.result}>
          输出：
          {item.result.stdout || '(empty)'}
        </pre>
      </section>
    )
  }

  if (item.type === 'progress_update') {
    return (
      <section className={aiClassroomStyles.surface.success}>
        <Check className="size-4" />
        已记录：
        {item.outcome}
        {' '}
        ·
        {' '}
        {item.conceptId}
      </section>
    )
  }

  return (
    <section className={aiClassroomStyles.surface.system}>
      {item.event.type}
    </section>
  )
}

function LessonBlockView({ block }: { block: LessonContentBlock }) {
  if (block.type === 'heading') {
    const HeadingTag = block.level === 3 ? 'h3' : 'h2'
    return <HeadingTag className={aiClassroomStyles.text.heading}>{block.text}</HeadingTag>
  }
  if (block.type === 'paragraph')
    return <p className={aiClassroomStyles.text.paragraph}><RichTextView body={block.body} /></p>
  if (block.type === 'concept_card') {
    return (
      <section className={aiClassroomStyles.surface.card}>
        <div className={cn(aiClassroomStyles.text.status, 'mb-1')}>{block.conceptId}</div>
        <h3 className={cn(aiClassroomStyles.text.titleSmall, 'mb-2 text-base')}>{block.title}</h3>
        <p className={aiClassroomStyles.text.body}><RichTextView body={block.body} /></p>
      </section>
    )
  }
  if (block.type === 'code_example') {
    return (
      <section>
        {block.title && <div className={cn(aiClassroomStyles.text.label, 'mb-2')}>{block.title}</div>}
        <pre className={aiClassroomStyles.code.block}>{block.code}</pre>
      </section>
    )
  }
  if (block.type === 'callout') {
    return (
      <section className={cn(aiClassroomStyles.surface.card, aiClassroomStyles.text.body)}>
        {block.title && <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-1')}>{block.title}</div>}
        <RichTextView body={block.body} />
      </section>
    )
  }
  if (block.type === 'steps') {
    return (
      <section>
        {block.title && <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-2')}>{block.title}</div>}
        <ol className={aiClassroomStyles.stream.steps}>
          {block.items.map(item => (
            <li key={richTextPlainText(item)} className={aiClassroomStyles.text.body}>
              <RichTextView body={item} />
            </li>
          ))}
        </ol>
      </section>
    )
  }
  if (block.type === 'compare') {
    return (
      <section className={aiClassroomStyles.stream.twoColumn}>
        <div className={aiClassroomStyles.surface.card}>
          <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-1')}>{block.leftTitle}</div>
          <RichTextView body={block.left} />
        </div>
        <div className={aiClassroomStyles.surface.card}>
          <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-1')}>{block.rightTitle}</div>
          <RichTextView body={block.right} />
        </div>
      </section>
    )
  }
  return null
}

function RichTextView({ body }: { body: RichText }) {
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

function lessonBlockKey(block: LessonContentBlock): string {
  if (block.type === 'heading')
    return `heading:${block.text}`
  if (block.type === 'paragraph')
    return `paragraph:${richTextPlainText(block.body)}`
  if (block.type === 'concept_card')
    return `concept:${block.conceptId}:${block.title}`
  if (block.type === 'code_example')
    return `code:${block.title ?? ''}:${block.code.slice(0, 80)}`
  if (block.type === 'callout')
    return `callout:${block.tone}:${block.title ?? ''}:${richTextPlainText(block.body)}`
  if (block.type === 'steps')
    return `steps:${block.title ?? ''}:${block.items.map(richTextPlainText).join('|')}`
  if (block.type === 'compare')
    return `compare:${block.leftTitle}:${block.rightTitle}`
  return `quiz:${block.conceptId}:${richTextPlainText(block.prompt)}`
}

function richTextPlainText(body: RichText): string {
  return body.map(span => 'text' in span ? span.text : 'code' in span ? span.code : span.strong).join('')
}

function QuizPracticeCard({
  quiz,
  isActive,
  lang,
  dispatch,
  bridge,
}: {
  quiz: ClassroomQuiz
  isActive: boolean
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: ReturnType<typeof useAIBridge>
}) {
  const [running, setRunning] = useState(false)
  const mountedRef = useRef(true)
  const promptText = quiz.prompt.map(span => 'text' in span ? span.text : 'code' in span ? span.code : span.strong).join('')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runQuiz = async () => {
    setRunning(true)
    dispatch({ type: 'RUN_STARTED', now: Date.now() })
    try {
      const editorCode = bridge.editor.getEditor()?.getModel()?.getValue() ?? quiz.starterCode
      const data = await requestRemoteAction(editorCode, 'run')
      const result: RunResult = {
        ok: data.compiler_code === 0 && data.bin_code === 0,
        stdout: data.bin_output,
        stderr: data.compiler_output,
        exitCode: data.bin_code,
      }
      if (!mountedRef.current)
        return
      dispatch({ type: 'QUIZ_RUN_FINISHED', result, now: Date.now() })
    }
    finally {
      if (mountedRef.current)
        setRunning(false)
    }
  }

  return (
    <section data-testid="quiz-practice-card" className={aiClassroomStyles.surface.accent}>
      <div className={aiClassroomStyles.quiz.header}>
        <div>
          <div className={aiClassroomStyles.text.label}>Practice</div>
          <div className={aiClassroomStyles.text.status}>
            Quiz
            {' '}
            {quiz.status}
          </div>
        </div>
        <div className={aiClassroomStyles.badge.status}>
          Quiz
          {' '}
          {quiz.status}
        </div>
      </div>
      <div className={aiClassroomStyles.quiz.body}>
        <p className={aiClassroomStyles.text.body}>{promptText}</p>
        <div className={aiClassroomStyles.quiz.expectedFrame}>
          <div className={aiClassroomStyles.quiz.expectedBar}>
            Expected output:
            {' '}
            <code>{quiz.expectedOutput}</code>
          </div>
          <div className={aiClassroomStyles.quiz.editor}>
            <TourEditor code={quiz.starterCode} locale={lang} />
          </div>
        </div>
        <div className={aiClassroomStyles.quiz.actions}>
          <button
            type="button"
            onClick={runQuiz}
            disabled={running || !isActive}
            className={aiClassroomStyles.button.primary}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            运行检查
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'QUIZ_SKIP', now: Date.now() })}
            disabled={!isActive}
            className={aiClassroomStyles.button.secondaryLarge}
          >
            <SkipForward className="size-4" />
            Skip
          </button>
        </div>
      </div>
    </section>
  )
}
