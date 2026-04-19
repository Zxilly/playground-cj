export type SiteDomain = 'tour' | 'playground'

const TOUR_SUBDOMAIN_PREFIX = 'tour.'
const PLAYGROUND_SUBDOMAIN_PREFIX = 'playground.'

interface SiteHrefOptions {
  currentOrigin?: string
  rest?: string[]
}

interface TourPathOptions {
  rest?: string[]
  servingDomain?: SiteDomain
}

interface LocationLike {
  pathname: string
  search?: string
  hash?: string
}

function normalizeHost(hostOrOrigin?: string): string {
  if (!hostOrOrigin)
    return ''

  if (hostOrOrigin.includes('://')) {
    try {
      return new URL(hostOrOrigin).hostname.toLowerCase()
    }
    catch {
      return ''
    }
  }

  return hostOrOrigin.split(':')[0].toLowerCase()
}

function buildLocalizedPath(lang: string, rest: string[] = []): string {
  return ['', lang, ...rest].join('/')
}

function getSiblingOrigin(currentOrigin: string, targetDomain: SiteDomain): string | null {
  try {
    const url = new URL(currentOrigin)
    const currentDomain = getSiteDomain(url.hostname)

    if (currentDomain === targetDomain)
      return url.origin

    const currentPrefix = currentDomain === 'tour' ? TOUR_SUBDOMAIN_PREFIX : PLAYGROUND_SUBDOMAIN_PREFIX
    if (!url.hostname.startsWith(currentPrefix))
      return null

    const targetPrefix = targetDomain === 'tour' ? TOUR_SUBDOMAIN_PREFIX : PLAYGROUND_SUBDOMAIN_PREFIX
    url.hostname = `${targetPrefix}${url.hostname.slice(currentPrefix.length)}`
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.origin
  }
  catch {
    return null
  }
}

export function getSiteDomain(hostOrOrigin?: string): SiteDomain {
  return normalizeHost(hostOrOrigin).startsWith(TOUR_SUBDOMAIN_PREFIX) ? 'tour' : 'playground'
}

export function getPlaygroundPath(lang: string, rest: string[] = []): string {
  return buildLocalizedPath(lang, rest)
}

export function getTourPath(lang: string, { rest = [], servingDomain = 'playground' }: TourPathOptions = {}): string {
  return buildLocalizedPath(lang, servingDomain === 'tour' ? rest : ['tour', ...rest])
}

export function getPlaygroundHref(lang: string, { currentOrigin, rest = [] }: SiteHrefOptions = {}): string {
  const siblingOrigin = currentOrigin ? getSiblingOrigin(currentOrigin, 'playground') : null
  if (siblingOrigin)
    return new URL(getPlaygroundPath(lang, rest), siblingOrigin).toString()

  return getPlaygroundPath(lang, rest)
}

export function getTourHref(lang: string, { currentOrigin, rest = [] }: SiteHrefOptions = {}): string {
  const siblingOrigin = currentOrigin ? getSiblingOrigin(currentOrigin, 'tour') : null
  if (siblingOrigin)
    return new URL(getTourPath(lang, { rest, servingDomain: 'tour' }), siblingOrigin).toString()

  const servingDomain = currentOrigin ? getSiteDomain(currentOrigin) : 'playground'
  return getTourPath(lang, { rest, servingDomain })
}

export function getLocaleHref(locale: string, { pathname, search = '', hash = '' }: LocationLike): string {
  const pathSegments = pathname.split('/').filter(Boolean)

  if (pathSegments.length > 0 && ['zh', 'en'].includes(pathSegments[0])) {
    pathSegments[0] = locale
  }
  else {
    pathSegments.unshift(locale)
  }

  return `/${pathSegments.join('/')}${search}${hash}`
}
