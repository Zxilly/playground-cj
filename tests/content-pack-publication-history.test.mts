// @vitest-environment node

import {
  cpSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  generatedContentPackDirectory,
  readVerifiedRepositoryPublication,
} from '../scripts/content-pack-verification.mts'

const temporaryDirectories: string[] = []

function copyPublicationFixture(): string {
  const directory = mkdtempSync(
    join(resolve(tmpdir()), 'playground-cj-publication-test-'),
  )
  temporaryDirectories.push(directory)
  cpSync(generatedContentPackDirectory, directory, { recursive: true })
  return directory
}

afterEach(() => {
  const systemTemp = resolve(tmpdir())
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = resolve(directory)
    if (
      resolved.startsWith(`${systemTemp}\\`)
      || resolved.startsWith(`${systemTemp}/`)
    ) {
      rmSync(resolved, { force: true, recursive: true })
    }
  }
})

describe('content Pack publication history filesystem gate', () => {
  it('fails when a published current artifact is missing', () => {
    const directory = copyPublicationFixture()
    rmSync(join(directory, 'en.json'))

    expect(() => readVerifiedRepositoryPublication(directory))
      .toThrow(/Missing publication current en Content Pack artifact/)
  }, 15_000)

  it('never treats the candidate artifact as historical authority', () => {
    const directory = copyPublicationFixture()
    rmSync(join(directory, 'history', '0001', 'en.json'))

    expect(() => readVerifiedRepositoryPublication(directory))
      .toThrow(/Missing publication en Content Pack artifact snapshot/)
  })

  it('checks old receipt and review declaration snapshots before the candidate', () => {
    const directory = copyPublicationFixture()
    rmSync(join(
      directory,
      'history',
      '0001',
      'validation-receipt.json',
    ))

    expect(() => readVerifiedRepositoryPublication(directory))
      .toThrow(/Missing publication validation receipt snapshot/)
  })
})
