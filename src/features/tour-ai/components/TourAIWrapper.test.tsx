import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import TourAIWrapper from './TourAIWrapper'

describe('tourAIWrapper', () => {
  it('renders a visible server fallback while the client AI app loads', () => {
    const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
    i18n.activate('zh')
    const html = renderToString(
      <I18nProvider i18n={i18n}>
        <TourAIWrapper lang="zh" />
      </I18nProvider>,
    )

    expect(html).toContain('AI 课堂')
    expect(html).toContain('正在加载 AI 课堂')
    expect(html).toContain('data-motion="ai-classroom-fallback"')
  })
})
