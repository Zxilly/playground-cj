import { createHighlighter } from 'shiki'
import grammar from '@/lib/Cangjie.tmLanguage.json'

export function getHighlighter() {
  return createHighlighter({
    themes: [
      'vitesse-light',
    ],
    langs: [
      grammar as any,
    ],
  })
}
