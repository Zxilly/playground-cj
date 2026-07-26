// @vitest-environment node

import { describe, expect, it } from 'vitest'
import config from '../../vitest.config.mts'

describe('vitest project boundaries', () => {
  it('keeps e2e tests out of the unit project', () => {
    const projects = config.test?.projects ?? []
    const unit = projects.find(project => project.test?.name === 'unit')

    expect(unit?.test?.include).toContain('src/**/*.test.ts')
    expect(unit?.test?.include).toContain('tests/**/*.test.{ts,mts}')
    expect(unit?.test?.exclude).toContain('tests/**/*.e2e.test.ts')
  })

  it('pre-optimizes browser dependencies that cannot reload Monaco during tests', () => {
    const projects = config.test?.projects ?? []
    const browser = projects.find(project => project.test?.name === 'browser')

    expect(browser?.optimizeDeps?.include).toContain('@lingui/react')
  })
})
