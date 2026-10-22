// @vitest-environment node

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { patchEdgeOneTurbopack } from '../../scripts/patch-edgeone-turbopack.mjs'

const upstream = readFileSync('tests/fixtures/edgeone-module-installer.txt', 'utf8')

function installer() {
  return runInNewContext(`
    const moduleFactories = new Map();
    ${patchEdgeOneTurbopack(upstream)}
    ({ install: installCompressedModuleFactories, factories: moduleFactories });
  `) as {
    install: (entries: unknown[], offset?: number) => void
    factories: Map<number, () => string>
  }
}

describe('edgeOne Turbopack module registration', () => {
  it('registers strict nested factories and flat factories in the same chunk', () => {
    const { install, factories } = installer()
    const strict = () => 'strict entry'
    const flat = () => 'flat entry'
    install([[10, 11, strict], 20, flat])
    expect(factories.get(10)).toBe(strict)
    expect(factories.get(11)).toBe(strict)
    expect(factories.get(20)).toBe(flat)
    expect([...factories.keys()]).toEqual([10, 11, 20])
  })

  it('fills missing aliases using the already registered group factory', () => {
    const { install, factories } = installer()
    const first = () => 'first'
    const duplicate = () => 'duplicate'
    install([11, first])
    install([10, 11, 12, duplicate])
    expect(factories.get(10)).toBe(first)
    expect(factories.get(11)).toBe(first)
    expect(factories.get(12)).toBe(first)
  })

  it('honors offsets and accepts the older flat format', () => {
    const { install, factories } = installer()
    const entry = () => 'entry'
    install(['chunk path', 10, 11, entry], 1)
    expect([...factories.keys()]).toEqual([10, 11])
    expect(factories.get(11)).toBe(entry)
  })

  it('rejects malformed groups instead of silently dropping entry modules', () => {
    expect(() => installer().install([10])).toThrow('malformed chunk format')
  })

  it('does not modify unrelated runtime code and is idempotent', () => {
    const source = `// prefix\n${upstream}\n// suffix\n`
    const patched = patchEdgeOneTurbopack(source)
    expect(patched.startsWith('// prefix\n')).toBe(true)
    expect(patched.endsWith('\n// suffix\n')).toBe(true)
    expect(patchEdgeOneTurbopack(patched)).toBe(patched)
  })

  it('refuses changed or missing upstream implementations', () => {
    expect(() => patchEdgeOneTurbopack('')).toThrow('Unrecognized')
    expect(() => patchEdgeOneTurbopack(upstream.replace('let end = i + 1;', 'let end = i + 2;')))
      .toThrow('installer changed')
  })
})
