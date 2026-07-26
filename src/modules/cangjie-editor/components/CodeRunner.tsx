import { useEffect } from 'react'
import { eventEmitter, EVENTS } from '@/lib/events'
import {
  remoteRun,
} from '@/service/run'
import { browserCangjieFormatter } from '@/lib/cangjie-formatter'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import type { RunnerTruncationState } from '@/lib/runner-contract'
import { toast } from 'sonner'
import { isBusy, remoteLock } from '@/lib/lock'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

interface CodeRunnerProps {
  setToolOutput: (output: string) => void
  setProgramOutput: (output: string) => void
  setTruncation: (state: RunnerTruncationState) => void
  onFormatted?: (code: string) => void
}

export default function CodeRunner({
  setToolOutput,
  setProgramOutput,
  setTruncation,
  onFormatted,
}: CodeRunnerProps) {
  const { i18n } = useLingui()

  useEffect(() => {
    const handleRun = async (code: string) => {
      if (isBusy()) {
        return
      }

      toast.promise(async () => {
        await remoteLock.acquire('run', async () => {
          await remoteRun(code, {
            setToolOutput,
            setProgramOutput,
            setTruncation,
          })
        })
      }, {
        loading: i18n._(msg`正在运行...`),
        success: i18n._(msg`运行成功`),
        error: i18n._(msg`运行失败`),
      })
    }

    const handleFormat = async (code: string) => {
      if (isBusy()) {
        return
      }

      toast.promise(async () => {
        await remoteLock.acquire('run', async () => {
          setTruncation(NO_RUNNER_TRUNCATION)
          const formatted = await browserCangjieFormatter.format(code)
          setToolOutput('')
          onFormatted?.(formatted)
          eventEmitter.emit(EVENTS.FORMAT_CODE_COMPLETE, formatted)
        })
      }, {
        loading: i18n._(msg`正在格式化...`),
        success: i18n._(msg`格式化成功`),
        error: error => error instanceof Error ? error.message : i18n._(msg`格式化失败`),
      })
    }

    eventEmitter.on(EVENTS.RUN_CODE, handleRun)
    eventEmitter.on(EVENTS.FORMAT_CODE, handleFormat)

    return () => {
      eventEmitter.off(EVENTS.RUN_CODE, handleRun)
      eventEmitter.off(EVENTS.FORMAT_CODE, handleFormat)
    }
  }, [setToolOutput, setProgramOutput, setTruncation, onFormatted, i18n])

  return null
}
