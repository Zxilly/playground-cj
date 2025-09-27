import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Negotiator from 'negotiator'
import { defaultLocale, locales } from '@/lib/i18n'

const COOKIE_NAME = 'locale'

function getLocaleFromHeaders(request: NextRequest): string {
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

function getLocaleFromCookie(request: NextRequest): string | null {
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
  if (cookieLocale && locales.includes(cookieLocale as any)) {
    return cookieLocale
  }
  return null
}

function getPreferredLocale(request: NextRequest): string {
  // Priority: Cookie > Accept-Language header > Default
  const cookieLocale = getLocaleFromCookie(request)
  if (cookieLocale)
    return cookieLocale

  return getLocaleFromHeaders(request)
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/')
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/favicon.ico')
    || pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if pathname already has a locale
  const hasLocaleInPath = locales.some(locale =>
    pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )

  if (hasLocaleInPath) {
    // Path already has locale, just continue
    const response = NextResponse.next()

    // Extract language from pathname and set it as a header
    const langMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
    if (langMatch) {
      response.headers.set('x-locale', langMatch[1])
    }

    return response
  }

  // No locale in path, determine preferred locale and redirect
  const preferredLocale = getPreferredLocale(request)

  // Redirect to localized path for all languages
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
