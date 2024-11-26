import type { Highlighter } from 'shiki'
import grammar from '@/lib/Cangjie.tmLanguage.json'
import AsyncLock from 'async-lock'
import { createHighlighter } from 'shiki'

let highlighter: Highlighter | null = null
const highlighterLock = new AsyncLock()

export async function getHighlighter(darkMode: boolean) {
  await highlighterLock.acquire('highlighter', async () => {
    highlighter = await createHighlighter({
      themes: [
        darkMode ? 'dark-plus' : 'light-plus',
      ],
      langs: [
        grammar as any,
      ],
    })
  })

  return highlighter
}
