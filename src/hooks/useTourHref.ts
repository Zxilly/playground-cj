export function getTourBasePath(lang: string, isTourDomain: boolean) {
  return isTourDomain ? `/${lang}` : `/${lang}/tour`
}
