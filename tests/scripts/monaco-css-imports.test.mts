import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const transform = createRequire(import.meta.url)('../../scripts/monaco-css-imports.cjs') as (source: string) => string

describe('monaco CSS imports for Next', () => {
  it('keeps CSS asset imports and disables only the optional module registration', () => {
    expect(transform('import * as style from \'./icons.css\';\nregisterCss(style, 10);'))
      .toBe('import \'./icons.css\'; const style = {};\nregisterCss(style, 10);')
  })

  it('leaves JavaScript namespaces and existing side-effect imports unchanged', () => {
    const source = 'import * as editor from \'./editor.js\';\nimport \'./editor.css\';'
    expect(transform(source)).toBe(source)
  })
})
