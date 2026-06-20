import { createHighlighterCore } from 'shiki/core'
import type { HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledThemes } from 'shiki/themes'
import cangjieGrammar from '@/grammars/Cangjie.tmLanguage.json'

/**
 * Shiki 高亮器：用纯 JS 正则引擎加载仓颉自定义语法（避免在浏览器里加载
 * oniguruma 的 wasm）。整个应用复用同一个单例高亮器实例。
 *
 * 主题通过 `shiki/themes` 暴露的 `bundledThemes` 懒加载映射获取，这样所有
 * `@shikijs/*` 子包导入都发生在 shiki 包内部，避免项目侧直接 import
 * `@shikijs/themes/*` 子路径在 bundler 解析时找不到（该子包未被提升到顶层
 * node_modules）。
 */
let highlighterPromise: Promise<HighlighterCore> | null = null

async function loadTheme(id: 'github-light' | 'github-dark') {
  const mod = await bundledThemes[id]()
  return mod.default
}

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [light, dark] = await Promise.all([
      loadTheme('github-light'),
      loadTheme('github-dark'),
    ])
    return createHighlighterCore({
      // 自定义语法注册为语言 id `cangjie`，scopeName 保持 `source.cj`。
      langs: [{ ...(cangjieGrammar as object), name: 'cangjie' } as never],
      themes: [light, dark],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
  })()
  return highlighterPromise
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 将仓颉代码高亮为 HTML 字符串。出错时回退为转义后的纯 `<pre><code>`，
 * 保证调用方拿到的始终是可直接插入的安全 HTML。
 */
export async function highlightCangjie(
  code: string,
  opts: { dark?: boolean } = {},
): Promise<string> {
  try {
    const highlighter = await getHighlighter()
    return highlighter.codeToHtml(code, {
      lang: 'cangjie',
      theme: opts.dark ? 'github-dark' : 'github-light',
    })
  }
  catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
}
