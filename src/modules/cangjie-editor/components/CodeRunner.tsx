import { useEffect } from 'react'
import { eventEmitter, EVENTS } from '@/lib/events'
import {
  remoteRun,
  requestRemoteAction,
} from '@/service/run'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import type { RunnerTruncationState } from '@/lib/runner-contract'
import { applyCompleteFormattedSource } from '@/lib/runner-format'
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
          const resp = await requestRemoteAction(code, 'format')

          setToolOutput(resp.formatter_output)
          setTruncation({
            compilerOutput: false,
            programStdout: false,
            programStderr: false,
            formattedSource: resp.formatted_truncated,
            formatterOutput: resp.formatter_output_truncated,
          })

          if (resp.formatter_code === 0) {
            if (!applyCompleteFormattedSource(resp, onFormatted)) {
              throw new Error(i18n._(msg`格式化结果已截断；编辑器内容未更改。`))
            }
            eventEmitter.emit(EVENTS.FORMAT_CODE_COMPLETE, resp.formatted)
          }
          else {
            throw new Error(i18n._(msg`格式化失败`))
          }
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
