import { NextRequest, NextResponse } from 'next/server'

const SUPPORTED_LOCALES = ['zh', 'en'] as const
const DEFAULT_LOCALE = 'zh'
const COOKIE_NAME = 'locale'

function getLocaleFromAcceptLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) return DEFAULT_LOCALE

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, quality = '1'] = lang.trim().split(';q=')
      return { locale: locale.toLowerCase(), quality: parseFloat(quality) }
    })
    .sort((a, b) => b.quality - a.quality)

  // Find first supported language
  for (const { locale } of languages) {
    if (locale.startsWith('en')) return 'en'
    if (locale.startsWith('zh')) return 'zh'
  }

  return DEFAULT_LOCALE
}

function getLocaleFromCookie(request: NextRequest): string | null {
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as any)) {
    return cookieLocale
  }
  return null
}

function getPreferredLocale(request: NextRequest): string {
  // Priority: Cookie > Accept-Language header > Default
  const cookieLocale = getLocaleFromCookie(request)
  if (cookieLocale) return cookieLocale

  const acceptLanguage = request.headers.get('accept-language')
  return getLocaleFromAcceptLanguage(acceptLanguage)
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if pathname already has a locale
  const hasLocaleInPath = SUPPORTED_LOCALES.some(locale =>
    pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )

  if (hasLocaleInPath) {
    // Path already has locale, just continue
    return NextResponse.next()
  }

  // No locale in path, determine preferred locale and redirect
  const preferredLocale = getPreferredLocale(request)

  if (preferredLocale === DEFAULT_LOCALE) {
    // For default locale (zh), stay on root path
    return NextResponse.next()
  } else {
    // For non-default locale (en), redirect to localized path
    const redirectUrl = new URL(`/${preferredLocale}${pathname}`, request.url)
    return NextResponse.redirect(redirectUrl)
  }
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