import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import { createContentPackCatalog } from './content-catalog'

const version = `cv:sha256:${'a'.repeat(64)}`
const pack = {
  id: 'pack:cj.program.main',
  version,
  learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
  concept: {
    id: 'cj.program.main',
    title: 'main',
    summary: 'Program entry point.',
    prerequisites: [],
  },
  blocks: [],
  learningSkills: [],
  exerciseTemplates: [],
} satisfies CourseContentPack

describe('current Course catalog', () => {
  it('indexes the build-owned packs without selecting historical implementations', () => {
    const catalog = createContentPackCatalog([pack])

    expect(catalog.list()).toEqual([{
      conceptId: 'cj.program.main',
      title: 'main',
      version,
    }])
    expect(catalog.get('cj.program.main')).toBe(pack)
    expect(catalog.get('cj.program.main', version)).toBe(pack)
    expect(catalog.get('cj.program.main', `cv:sha256:${'c'.repeat(64)}`))
      .toBeUndefined()
    expect(() => catalog.require(
      'cj.program.main',
      `cv:sha256:${'c'.repeat(64)}`,
    )).toThrow(/not in the current Course/)
  })
})
