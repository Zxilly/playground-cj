import { describe, expect, it } from 'vitest'
import { formatRevisionLabel } from './revision-label'

describe('revision label', () => {
  it('shortens only recognized content-addressed identities', () => {
    const digest = '0123456789abcdef'.repeat(4)
    expect(formatRevisionLabel(`cv:sha256:${digest}`))
      .toBe('cv:0123456789…6789abcdef')
    expect(formatRevisionLabel(`lc:sha256:${digest}`))
      .toBe('lc:0123456789…6789abcdef')
  })

  it('preserves unknown protocol values verbatim', () => {
    expect(formatRevisionLabel('unknown-revision')).toBe('unknown-revision')
    expect(formatRevisionLabel('cv:sha256:not-a-digest'))
      .toBe('cv:sha256:not-a-digest')
  })
})
