import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { catalogCharacters, planSubsets, unicodeRange } from '../../scripts/font-subsets.mjs'

const { create } = createRequire(import.meta.url)('fontkit')

describe('lingui font subsets', () => {
  it('collects every rendered branch without including argument names or format metadata', () => {
    const points = catalogCharacters({
      ignoredId: ['文', ['ignoredName'], ['count', 'plural', { offset: 1, one: ['字'], other: [['gender', 'select', { other: ['𠮷'], female: ['她'] }]] }]],
      ordinal: [['n', 'selectordinal', { one: ['甲'], other: ['乙'] }]],
    })
    expect(String.fromCodePoint(...points)).toBe([...new Set('文字𠮷她甲乙')].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join(''))
    expect(unicodeRange([32, 33, 34, 65, 0x20BB7])).toBe('U+20-22,U+41,U+20bb7')
  })

  it('retains every source character exactly once and bounds fallback downloads', () => {
    for (const [prefix, source] of [['harmony', 'HarmonyOS_Sans'], ['jetbrains', 'JetBrainsMono']]) {
      const original = create(readFileSync(`src/app/fonts/${source}.woff2`))
      const plan = planSubsets(original.characterSet, { zh: [0x4E2D, 0x6587], en: [65] })
      const points = plan.flatMap((part: { points: number[] }) => part.points)
      expect(points.length).toBe(new Set(points).size)
      expect(points.sort((a: number, b: number) => a - b)).toEqual([...original.characterSet].sort((a: number, b: number) => a - b))
      expect(plan.filter((part: { name: string }) => part.name.startsWith('range-')).every((part: { points: number[] }) => part.points.length <= 512)).toBe(true)

      const manifest = JSON.parse(readFileSync('src/app/fonts/generated/manifest.json', 'utf8'))
      const generatedPoints = Object.keys(manifest.files).filter(file => file.startsWith(`${prefix}-`)).flatMap((file) => {
        const font = create(readFileSync(`src/app/fonts/generated/${file}`))
        // cmap format 4 repeats its U+FFFF sentinel in every generated font.
        const points = manifest.files[file].unicodeRange.split(',').flatMap((range: string) => {
          const [start, end = start] = range.slice(2).split('-').map(value => Number.parseInt(value, 16))
          return Array.from({ length: end - start + 1 }, (_, index) => start + index)
        }) as number[]
        // HarfBuzz may also retain cmap entries needed by layout closure. CSS
        // owns the disjoint ranges, while every declared glyph must be present.
        const actual = new Set(font.characterSet)
        expect(points.every(point => actual.has(point))).toBe(true)
        return points
      })
      expect(new Set(generatedPoints)).toEqual(new Set(original.characterSet.filter((point: number) => point !== 0xFFFF)))
      expect(generatedPoints.length).toBe(new Set(generatedPoints).size)
    }
  })
})
