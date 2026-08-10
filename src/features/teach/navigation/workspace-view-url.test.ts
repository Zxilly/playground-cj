import { describe, expect, it } from 'vitest'
import {
  chatModeForWorkspaceView,
  createWorkspaceHistoryMarker,
  isWorkspaceViewBlocked,
  mergeWorkspaceHistoryState,
  readWorkspaceHistoryMarker,
  readWorkspaceView,
  workspaceViewHref,
} from './workspace-view-url'

describe('workspace view URL helpers', () => {
  it('reads valid views and canonicalizes missing or invalid values to Live', () => {
    expect(readWorkspaceView({ href: 'https://example.test/zh/tour/ai' })).toBe('live')
    expect(readWorkspaceView({ href: 'https://example.test/zh/tour/ai?view=review' })).toBe('review')
    expect(readWorkspaceView({ href: 'https://example.test/zh/tour/ai?view=unknown' })).toBe('live')
    expect(workspaceViewHref({ href: 'https://example.test/zh/tour/ai?topic=main&view=unknown#lesson' }, 'live'))
      .toBe('/zh/tour/ai?topic=main#lesson')
  })

  it('changes only the view parameter while preserving other query and hash state', () => {
    const location = { href: 'https://example.test/zh/tour/ai?topic=main&debug=1#lesson' }
    expect(workspaceViewHref(location, 'playground'))
      .toBe('/zh/tour/ai?topic=main&debug=1&view=playground#lesson')
    expect(workspaceViewHref({ href: 'https://example.test/en/tour/ai?view=review&topic=main#lesson' }, 'live'))
      .toBe('/en/tour/ai?topic=main#lesson')
  })

  it('shares one chat-scope guard between click and history navigation', () => {
    expect(chatModeForWorkspaceView('review')).toBe('review')
    expect(chatModeForWorkspaceView('progress')).toBe('live')
    expect(isWorkspaceViewBlocked('review', 'live')).toBe(true)
    expect(isWorkspaceViewBlocked('playground', 'live')).toBe(false)
    expect(isWorkspaceViewBlocked('live', 'review')).toBe(true)
    expect(isWorkspaceViewBlocked('review', null)).toBe(false)
  })

  it('preserves existing history state and rejects malformed markers', () => {
    const marker = createWorkspaceHistoryMarker('progress', 2)
    const merged = mergeWorkspaceHistoryState({ next: 'keep' }, marker)
    expect(merged.next).toBe('keep')
    expect(readWorkspaceHistoryMarker(merged)).toEqual(marker)
    expect(readWorkspaceHistoryMarker({ __cjTeachWorkspace: { version: 1, position: 1, view: 'other' } })).toBeNull()
  })
})
