import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AnsiOutput } from './AnsiOutput'

describe('ansiOutput', () => {
  afterEach(cleanup)

  it('renders terminal colours and escapes source markup', async () => {
    const { getByTestId } = render(
      <AnsiOutput
        data-testid="output"
        text={'\u001B[31merror\u001B[0m <script>alert(1)</script>'}
      />,
    )
    await waitFor(() => expect(getByTestId('output').innerHTML).toContain('color:rgb(187,0,0)'))
    const output = getByTestId('output')
    expect(output.querySelector('script')).toBeNull()
    expect(output.textContent).toContain('<script>alert(1)</script>')
  })

  it('renders plain output immediately and escapes markup', () => {
    const { getByTestId } = render(<AnsiOutput data-testid="output" text={'<img src=x onerror=alert(1)>\nnext line'} />)
    expect(getByTestId('output').textContent).toBe('<img src=x onerror=alert(1)>\nnext line')
    expect(getByTestId('output').querySelector('img')).toBeNull()
  })
})
