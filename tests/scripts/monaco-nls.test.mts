// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { collectNlsIds, subsetNlsMessages } from '../../scripts/generate-monaco-nls.mjs'

describe('monaco localization subsets', () => {
  it('reads imported aliases and namespace calls without matching comments or strings', () => {
    const source = `
      import { localize as label, localize2 } from './vs/nls.js';
      import * as nls from '@codingame/monaco-vscode-api/vscode/vs/nls';
      label(12, 'first'); localize2(42, 'second'); nls.localize(18, 'third');
      label('unindexed', 'fallback'); localize2({ key: 'unindexed' }, 'fallback');
      // label(900, 'comment');
      const text = "nls.localize(901, 'string')";
      unrelated(902, 'not nls');
    `
    expect([...collectNlsIds(source)].sort((a, b) => a - b)).toEqual([12, 18, 42])
  })

  it('rejects dynamic indexes that cannot be covered safely', () => {
    expect(() => collectNlsIds(`import { localize } from './nls.js'; localize(index, 'fallback');`))
      .toThrow('Non-static NLS index')
  })

  it('preserves numeric indexes and the original translation text', () => {
    const original = [null, '打开', 'unused', '格式化文档']
    const subset = subsetNlsMessages(original, new Set([1, 3]))
    expect(subset).toEqual([null, '打开', null, '格式化文档'])
    expect(original[2]).toBe('unused')
  })

  it('fails when package indexes and the catalog do not match', () => {
    expect(() => subsetNlsMessages(['text'], new Set([2]))).toThrow('outside')
    expect(() => subsetNlsMessages(['text'], new Set([-1]))).toThrow('outside')
    expect(() => subsetNlsMessages([], new Set())).toThrow('Expected an indexed')
  })
})
