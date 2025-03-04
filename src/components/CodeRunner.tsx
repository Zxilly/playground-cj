import { useEffect } from 'react'
import { eventEmitter, EVENTS } from '@/lib/events'
import { remoteRun, requestRemoteAction, SandboxStatus } from '@/service/run'
import { toast } from 'sonner'
import AsyncLock from 'async-lock'

const remoteLock = new AsyncLock()

function isBusy() {
  return remoteLock.isBusy('run')
}

interface CodeRunnerProps {
  setToolOutput: (output: string) => void
  setProgramOutput: (output: string) => void
  onFormatted?: (code: string) => void
}

export default function CodeRunner({ setToolOutput, setProgramOutput, onFormatted }: CodeRunnerProps) {
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
          })
        })
      }, {
        loading: '正在运行...',
        success: '运行成功',
        error: '运行失败',
      })
    }

    const handleFormat = async (code: string) => {
      if (isBusy()) {
        return
      }

      toast.promise(async () => {
        await remoteLock.acquire('run', async () => {
          const [resp, status] = await requestRemoteAction(code, 'format')

          if (status === SandboxStatus.UNKNOWN_ERROR) {
            throw new Error('格式化失败，未知错误')
          }

          setToolOutput(resp.formatter_output)

          if (resp.formatter_code === 0) {
            if (onFormatted) {
              onFormatted(resp.formatted)
            }
            eventEmitter.emit(EVENTS.FORMAT_CODE_COMPLETE, resp.formatted)
          }
          else {
            throw new Error('格式化失败')
          }
        })
      }, {
        loading: '正在格式化...',
        success: '格式化成功',
        error: error => error instanceof Error ? error.message : '格式化失败',
      })
    }

    eventEmitter.on(EVENTS.RUN_CODE, handleRun)
    eventEmitter.on(EVENTS.FORMAT_CODE, handleFormat)

    return () => {
      eventEmitter.off(EVENTS.RUN_CODE, handleRun)
      eventEmitter.off(EVENTS.FORMAT_CODE, handleFormat)
    }
  }, [setToolOutput, setProgramOutput, onFormatted])

  return null
}
