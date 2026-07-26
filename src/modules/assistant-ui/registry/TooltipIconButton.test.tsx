import { cleanup, render, screen } from '@testing-library/react'
import { CopyIcon } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipIconButton } from './TooltipIconButton'

describe('tooltipIconButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('uses the tooltip text as the button name while hiding the visual icon', () => {
    render(
      <TooltipProvider>
        <TooltipIconButton tooltip="复制">
          <CopyIcon data-testid="copy-icon" />
        </TooltipIconButton>
      </TooltipProvider>,
    )

    const button = screen.getByRole('button', { name: '复制' })
    const icon = screen.getByTestId('copy-icon')
    const visual = button.querySelector('.aui-button-icon-visual')

    expect(visual?.getAttribute('aria-hidden')).toBe('true')
    expect(visual?.contains(icon)).toBe(true)
  })
})
