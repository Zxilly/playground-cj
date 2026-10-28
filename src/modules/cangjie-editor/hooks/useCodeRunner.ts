'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import { toast } from 'sonner'
import { remoteRun } from '@/service/run'
import type { Actions } from '@/service/run'
import { browserCangjieFormatter } from '@/lib/cangjie-formatter'
import { abortable } from '@/lib/abortable'
import { isBusy, remoteLock } from '@/lib/lock'

interface CodeRunnerOptions {
  outputs?: Actions
  onRunningChange?: (running: boolean) => void
  scopeKey?: string
}

/** Instance-owned commands: no page-wide broadcasts or completion listeners. */
export function useCodeRunner(options: CodeRunnerOptions = {}) {
  const { i18n } = useLingui()
  const optionsRef = useRef(options)
  optionsRef.current = options
  const lifetimeRef = useRef(new AbortController())

  useEffect(() => {
    const lifetime = new AbortController()
    lifetimeRef.current = lifetime
    return () => lifetime.abort(new DOMException('Editor closed', 'AbortError'))
  }, [options.scopeKey])

  const run = useCallback(async (code: string, signal?: AbortSignal): Promise<void> => {
    const { outputs, onRunningChange } = optionsRef.current
    if (isBusy() || !outputs)
      return
    const runSignal = signal
      ? AbortSignal.any([signal, lifetimeRef.current.signal])
      : lifetimeRef.current.signal
    runSignal.throwIfAborted()
    const notification = toast.loading(i18n._(msg`正在运行...`))
    try {
      await remoteLock.acquire('run', async () => {
        runSignal.throwIfAborted()
        onRunningChange?.(true)
        try {
          await remoteRun(code, outputs, runSignal)
        }
        finally {
          onRunningChange?.(false)
        }
      })
      toast.success(i18n._(msg`运行成功`), { id: notification })
    }
    catch (error) {
      if (runSignal.aborted)
        toast.dismiss(notification)
      else
        toast.error(i18n._(msg`运行失败`), { id: notification })
      throw error
    }
  }, [i18n])

  const format = useCallback(async (code: string, signal?: AbortSignal): Promise<string> => {
    const formatSignal = signal
      ? AbortSignal.any([signal, lifetimeRef.current.signal])
      : lifetimeRef.current.signal
    formatSignal.throwIfAborted()
    if (isBusy())
      return code
    const notification = toast.loading(i18n._(msg`正在格式化...`))
    try {
      const formatted = await remoteLock.acquire('run', async () => {
        formatSignal.throwIfAborted()
        return abortable(browserCangjieFormatter.format(code), formatSignal)
      })
      formatSignal.throwIfAborted()
      toast.success(i18n._(msg`格式化成功`), { id: notification })
      return formatted
    }
    catch (error) {
      if (formatSignal.aborted)
        toast.dismiss(notification)
      else
        toast.error(i18n._(msg`格式化失败，请检查代码并重试。`), { id: notification })
      throw error
    }
  }, [i18n])

  return { run, format }
}
