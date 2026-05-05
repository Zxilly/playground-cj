import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TourAIWrapper from './TourAIWrapper'

describe('tourAIWrapper', () => {
  it('renders a visible server fallback while the client AI app loads', () => {
    const html = renderToString(<TourAIWrapper lang="zh" allSections={[]} />)

    expect(html).toContain('AI Mode Classroom')
    expect(html).toContain('正在加载 AI classroom')
  })
})
