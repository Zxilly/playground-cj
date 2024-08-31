import { type Monaco, loader } from '@monaco-editor/react'
import { shikiToMonaco } from '@shikijs/monaco'

import langConf from './language-configuration.json'
import { cangjieCompletionProvider } from '@/lib/completion'
import { getHighlighter } from '@/lib/shiki'

loader.config({
  'paths': {
    vs: 'https://registry.npmmirror.com/monaco-editor/0.51.0/files/min/vs',
  },
  'vs/nls': {
    availableLanguages: {
      '*': 'zh-cn',
    },
  },
})

export function setupEditor(monaco: Monaco) {
  monaco.languages.register({ id: 'cangjie' })
  monaco.languages.setLanguageConfiguration('cangjie', langConf as any)

  monaco.languages.registerCompletionItemProvider('cangjie', cangjieCompletionProvider)

  ;(async () => {
    const highlighter = await getHighlighter()

    shikiToMonaco(highlighter!, monaco)
  })()
}
