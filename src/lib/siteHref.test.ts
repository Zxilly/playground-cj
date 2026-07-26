import { describe, expect, it } from 'vitest'
import {
  getLocaleHref,
  getPlaygroundHref,
  getSiteDomain,
  getTourAIHref,
  getTourHref,
  getTourPath,
} from '@/lib/siteHref'

describe('site href helpers', () => {
  it('detects the tour domain from sibling subdomains', () => {
    expect(getSiteDomain('tour.cj.zxilly.dev:443')).toBe('tour')
    expect(getSiteDomain('https://playground.cj.zxilly.dev')).toBe('playground')
  })

  it('builds tour links for both sibling-domain and local deployments', () => {
    expect(getTourHref('zh', {
      currentOrigin: 'https://playground.cj.zxilly.dev',
      rest: ['01-welcome', '01-intro'],
    })).toBe('https://tour.cj.zxilly.dev/zh/01-welcome/01-intro')

    expect(getTourHref('zh', {
      currentOrigin: 'http://localhost:3000',
      rest: ['01-welcome', '01-intro'],
    })).toBe('/zh/tour/01-welcome/01-intro')
  })

  it('builds playground links for sibling tour domains', () => {
    expect(getPlaygroundHref('zh', {
      currentOrigin: 'https://tour.cj.zxilly.dev',
    })).toBe('https://playground.cj.zxilly.dev/zh')
  })

  it('builds the tour path shape for the current serving domain', () => {
    expect(getTourPath('zh', {
      rest: ['01-welcome', '01-intro'],
      servingDomain: 'tour',
    })).toBe('/zh/01-welcome/01-intro')

    expect(getTourPath('zh', {
      rest: ['01-welcome', '01-intro'],
      servingDomain: 'playground',
    })).toBe('/zh/tour/01-welcome/01-intro')
  })

  it('builds AI tutor links with optional topic deep links', () => {
    expect(getTourAIHref('zh', {
      currentOrigin: 'http://localhost:3000',
      topic: 'cj.program.main',
    })).toBe('/zh/tour/ai?topic=cj.program.main')

    expect(getTourAIHref('zh', {
      currentOrigin: 'https://tour.cj.zxilly.dev',
      topic: 'cj.var.immutable',
    })).toBe('https://tour.cj.zxilly.dev/zh/ai?topic=cj.var.immutable')
  })

  it('replaces the locale while preserving path, search, and hash', () => {
    expect(getLocaleHref('en', {
      pathname: '/zh/tour/01-welcome/01-intro',
      search: '?tab=editor',
      hash: '#code',
    })).toBe('/en/tour/01-welcome/01-intro?tab=editor#code')
  })
})
