import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AnsiOutput } from './AnsiOutput'

describe('ansiOutput', () => {
  afterEach(cleanup)

  it('renders terminal colours and escapes source markup', () => {
    const { getByTestId } = render(
      <AnsiOutput
        data-testid="output"
        text={'\u001B[31merror\u001B[0m <script>alert(1)</script>'}
      />,
    )
    const output = getByTestId('output')

    expect(output.innerHTML).toContain('color:rgb(187,0,0)')
    expect(output.querySelector('script')).toBeNull()
    expect(output.textContent).toContain('<script>alert(1)</script>')
  })
})
