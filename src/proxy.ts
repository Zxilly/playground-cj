import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Negotiator from 'negotiator'
import type { Locale } from '@/lib/i18n'
import { defaultLocale, isLocale, locales } from '@/lib/i18n'

const COOKIE_NAME = 'locale'

type DomainType = 'tour' | 'playground'

interface ParsedPath {
  lang: Locale | null
  hasTourSegment: boolean
  rest: string[]
}

function getLocaleFromHeaders(request: NextRequest): Locale {
  const acceptLanguage = request.headers.get('accept-language') ?? undefined
  const headers = { 'accept-language': acceptLanguage }
  const languages = new Negotiator({ headers }).languages()

  for (const language of languages) {
    const locale = language.toLowerCase()
    if (locale.startsWith('en'))
      return 'en'
    if (locale.startsWith('zh'))
      return 'zh'
  }

  return defaultLocale
}

function getLocaleFromCookie(request: NextRequest): Locale | null {
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale
  }
  return null
}

function getPreferredLocale(request: NextRequest): Locale {
  return getLocaleFromCookie(request) ?? getLocaleFromHeaders(request)
}

function getDomainType(host: string): DomainType {
  return host.startsWith('tour.') ? 'tour' : 'playground'
}

function parsePath(pathname: string): ParsedPath {
  const segments = pathname.split('/').filter(Boolean)

  let lang: Locale | null = null
  let idx = 0

  if (segments.length > 0 && isLocale(segments[0])) {
    lang = segments[0] as Locale
    idx = 1
  }

  let hasTourSegment = false
  if (idx < segments.length && segments[idx] === 'tour') {
    hasTourSegment = true
    idx += 1
  }

  return { lang, hasTourSegment, rest: segments.slice(idx) }
}

function buildPath(lang: Locale, includeTour: boolean, rest: string[]): string {
  const parts = ['', lang]
  if (includeTour)
    parts.push('tour')
  parts.push(...rest)
  return parts.join('/')
}

/**
 * URL rewriting state machine:
 *
 * Tour domain (tour.*):
 *   External URL: /{lang}/{chapter}/{step}
 *   Internal URL: /{lang}/tour/{chapter}/{step}
 *
 *   1. No lang               → rewrite to /{locale}/tour/{rest}
 *   2. Lang + /tour/ + rest  → redirect to /{lang}/{rest}  (strip /tour/ from browser URL)
 *   3. Lang + /tour/ only    → rewrite as-is               (index page, no rest to strip)
 *   4. Lang + no /tour/      → rewrite to /{lang}/tour/{rest}
 *
 * Playground domain:
 *   1. Has lang → pass through
 *   2. No lang  → redirect to /{locale}/{path}
 */
export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname

  if (
    pathname.startsWith('/api/')
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/favicon.ico')
    || pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const host = request.headers.get('host') ?? ''
  const domain = getDomainType(host)
  const parsed = parsePath(pathname)

  if (domain === 'tour') {
    const lang = parsed.lang ?? getPreferredLocale(request)

    // Case 1: No locale in URL → rewrite with locale and /tour/
    if (!parsed.lang) {
      const url = request.nextUrl.clone()
      url.pathname = buildPath(lang, true, parsed.rest)
      return NextResponse.rewrite(url)
    }

    // Case 2: /{lang}/tour/{rest} → redirect to /{lang}/{rest} (strip /tour/ from visible URL)
    if (parsed.hasTourSegment && parsed.rest.length > 0) {
      const url = request.nextUrl.clone()
      url.pathname = buildPath(lang, false, parsed.rest)
      return NextResponse.redirect(url)
    }

    // Case 3 & 4: rewrite to internal path with /tour/
    const url = request.nextUrl.clone()
    url.pathname = buildPath(lang, true, parsed.rest)
    return NextResponse.rewrite(url)
  }

  // Playground domain
  if (parsed.lang) {
    const response = NextResponse.next()
    response.headers.set('x-locale', parsed.lang)
    return response
  }

  const preferredLocale = getPreferredLocale(request)
  const redirectUrl = new URL(`/${preferredLocale}${pathname}`, request.url)
  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
