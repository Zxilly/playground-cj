import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Negotiator from 'negotiator'
import type { Locale } from '@/lib/i18n'
import { defaultLocale, isLocale, locales } from '@/lib/i18n'
import { getSiteDomain } from '@/lib/siteHref'

const COOKIE_NAME = 'locale'

/**
 * Legacy step redirects for chapters whose duplicated lessons were removed.
 * Live steps within the current chapter range are never redirected; only
 * previously indexed out-of-range step numbers are mapped to their canonical
 * post-deduplication step.
 */
const LEGACY_TOUR_STEP_REDIRECTS: Record<string, Record<string, string>> = {
  'basics': {
    23: '13', // 02-bindings-types/10 -> 03-basic-types/06 (Unit & Nothing)
    24: '14', // 02-bindings-types/11 -> 04-operators/01 (Arithmetic)
    25: '15', // 02-bindings-types/12 -> 04-operators/02 (Comparison & Logical)
    26: '16', // 02-bindings-types/13 -> 04-operators/03 (Assignment)
    27: '17', // 03-functions/01 -> 05-functions/01 (Defining Functions)
    28: '18', // 03-functions/02 -> 05-functions/02 (Implicit Return)
    29: '19', // 03-functions/03 -> 05-functions/03 (Multiple Return Values)
    30: '20', // 03-functions/04 -> 05-functions/04 (Named Parameters)
    31: '21', // 03-functions/05 -> 05-functions/05 (Default Parameter Values)
    32: '22', // 03-functions/06 -> 05-functions/06 (Congratulations!)
    33: '14', // 03-operators/01 -> 04-operators/01 (Arithmetic)
    34: '15', // 03-operators/02 -> 04-operators/02 (Comparison & Logical)
    35: '16', // 03-operators/03 -> 04-operators/03 (Assignment)
  },
  'reflection-annotations': {
    6: '5', // 02-annotations/03 after deduplicating 01-reflection/02
  },
}

function resolveLegacyTourStep(rest: string[]): string[] | null {
  if (rest.length !== 2)
    return null

  const [chapter, step] = rest
  const mappedStep = LEGACY_TOUR_STEP_REDIRECTS[chapter]?.[step]
  if (!mappedStep)
    return null

  return [chapter, mappedStep]
}

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
  const host = request.headers.get('host') ?? ''
  const domain = getSiteDomain(host)
  const parsed = parsePath(pathname)

  // Vercel supplies this country header. Keep the original domains on Vercel
  // for other countries; the Makers origin must never redirect back to itself.
  if (
    (process.env.VERCEL === '1' || process.env.VERCEL_ENV)
    && request.headers.get('x-vercel-ip-country') === 'CN'
    && (request.method === 'GET' || request.method === 'HEAD')
    && ['playground.cj.zxilly.dev', 'tour.cj.zxilly.dev'].includes(request.nextUrl.hostname)
  ) {
    const url = new URL('https://play.cj.zxilly.com')
    url.pathname = domain === 'tour'
      ? buildPath(parsed.lang ?? getPreferredLocale(request), true, parsed.rest)
      : pathname
    url.search = request.nextUrl.search
    const response = NextResponse.redirect(url, 302)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Vary', 'x-vercel-ip-country')
    return response
  }

  if (domain === 'tour') {
    const lang = parsed.lang ?? getPreferredLocale(request)
    const legacyRest = resolveLegacyTourStep(parsed.rest)

    if (legacyRest) {
      const url = request.nextUrl.clone()
      url.pathname = buildPath(lang, false, legacyRest)
      return NextResponse.redirect(url, 301)
    }

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
  if (parsed.hasTourSegment) {
    const legacyRest = resolveLegacyTourStep(parsed.rest)
    if (legacyRest) {
      const lang = parsed.lang ?? getPreferredLocale(request)
      const url = request.nextUrl.clone()
      url.pathname = buildPath(lang, true, legacyRest)
      return NextResponse.redirect(url, 301)
    }
  }

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
    // Exclude API, Next internals, and any path containing a dot (public static assets).
    '/((?!api|_next/static|_next/image|.*\\.).*)',
  ],
}
