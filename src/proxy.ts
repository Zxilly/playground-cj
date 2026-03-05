import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Negotiator from 'negotiator'
import type { Locale } from '@/lib/i18n'
import { defaultLocale, locales } from '@/lib/i18n'

const COOKIE_NAME = 'locale'

function getLocaleFromHeaders(request: NextRequest): Locale {
  const acceptLanguage = request.headers.get('accept-language') ?? undefined
  const headers = { 'accept-language': acceptLanguage }
  const languages = new Negotiator({ headers }).languages()

  // Find first supported language
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
  // Priority: Cookie > Accept-Language header > Default
  const cookieLocale = getLocaleFromCookie(request)
  if (cookieLocale)
    return cookieLocale

  return getLocaleFromHeaders(request)
}

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

  // Handle tour.* domain: rewrite URLs to include /tour segment
  const host = request.headers.get('host') ?? ''
  if (host.startsWith('tour.')) {
    const segments = pathname.split('/')
    const lang = segments[1] ?? ''

    if (lang !== 'zh' && lang !== 'en') {
      const preferredLocale = getPreferredLocale(request)
      const url = request.nextUrl.clone()
      url.pathname = `/${preferredLocale}/tour`
      return NextResponse.rewrite(url)
    }

    // /zh/01-basics/... → /zh/tour/01-basics/...
    segments.splice(2, 0, 'tour')
    const url = request.nextUrl.clone()
    url.pathname = segments.join('/')
    return NextResponse.rewrite(url)
  }

  const hasLocaleInPath = locales.some(locale =>
    pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )

  if (hasLocaleInPath) {
    const response = NextResponse.next()
    const langMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
    if (langMatch) {
      response.headers.set('x-locale', langMatch[1])
    }
    return response
  }

  const preferredLocale = getPreferredLocale(request)
  const redirectUrl = new URL(`/${preferredLocale}${pathname}`, request.url)
  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - Static files
    // - Next.js internals
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
