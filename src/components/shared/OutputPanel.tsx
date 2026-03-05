'use client'

import { fontFamily } from '@/app/font'
import LabelContainer from '@/components/LabelContainer'
import { AnsiUp } from 'ansi_up'
import { useMemo } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

interface OutputPanelProps {
  toolOutput: string
  programOutput: string
}

export function OutputPanel({ toolOutput, programOutput }: OutputPanelProps) {
  const { i18n } = useLingui()

  const toolOutputHtml = useMemo(() => new AnsiUp().ansi_to_html(toolOutput), [toolOutput])
  const programOutputHtml = useMemo(() => new AnsiUp().ansi_to_html(programOutput), [programOutput])

  return (
    <div
      id="panel-content"
      className="flex-1 overflow-hidden flex flex-col"
    >
      <LabelContainer
        title={i18n._(msg`工具输出`)}
        content={(
          <pre
            className="whitespace-pre min-h-0 min-w-0"
            style={{ fontFamily }}
            dangerouslySetInnerHTML={{ __html: toolOutputHtml }}
          />
        )}
        className="flex-1/2 mb-1 lg:mb-2"
      />
      <LabelContainer
        title={i18n._(msg`程序输出`)}
        content={(
          <pre
            className="whitespace-pre min-h-0 min-w-0"
            style={{ fontFamily }}
            dangerouslySetInnerHTML={{ __html: programOutputHtml }}
          />
        )}
        className="flex-1/2 mt-1 lg:mt-2"
      />
    </div>
  )
}
