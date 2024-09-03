import type { Highlighter } from 'shiki'
import { createHighlighter } from 'shiki'
import AsyncLock from 'async-lock'
import grammar from '@/lib/Cangjie.tmLanguage.json'

let highlighter: Highlighter | null = null
const highlighterLock = new AsyncLock()

export async function getHighlighter(darkMode: boolean) {
  await highlighterLock.acquire('highlighter', async () => {
    highlighter = await createHighlighter({
      themes: [
        darkMode ? 'vitesse-dark' : 'vitesse-light',
      ],
      langs: [
        grammar as any,
      ],
    })
  })

  return highlighter
}
