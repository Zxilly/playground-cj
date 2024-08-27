import { type Monaco, loader } from '@monaco-editor/react'
import { shikiToMonaco } from '@shikijs/monaco'
import { createHighlighter } from 'shiki'

import grammar from './Cangjie.tmLanguage.json'
import langConf from './language-configuration.json'

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

  ;(async () => {
    const highlighter = await createHighlighter({
      themes: [
        'vitesse-light',
      ],
      langs: [
        grammar as any,
      ],
    })

    shikiToMonaco(highlighter, monaco)
  })()
}
