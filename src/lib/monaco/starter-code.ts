import chinese from '@/examples/hello-world.cj'
import english from '@/examples/hello-world.en.cj'

export function getStarterCode(locale?: string): string {
  return locale === 'en' ? english : chinese
}
