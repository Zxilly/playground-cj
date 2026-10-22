// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const hook = pathToFileURL(resolve('scripts/edgeone-compat-hook.mjs')).href
const upstream = readFileSync('tests/fixtures/edgeone-module-installer.txt', 'utf8')
const directories: string[] = []

function fixture(options: { cliVersion?: string, adapterVersion?: string, source?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'edgeone-hook-'))
  directories.push(root)
  const cli = join(root, 'node_modules/edgeone')
  const adapter = join(root, 'node_modules/@edgeone/opennextjs-pages')
  const compiler = join(adapter, 'dist/build/functions/middleware/compiler.js')
  mkdirSync(cli, { recursive: true })
  mkdirSync(join(adapter, 'dist/build/functions/middleware'), { recursive: true })
  writeFileSync(join(cli, 'package.json'), JSON.stringify({ name: 'edgeone', version: options.cliVersion ?? '1.6.45' }))
  writeFileSync(join(adapter, 'package.json'), JSON.stringify({ name: '@edgeone/opennextjs-pages', version: options.adapterVersion ?? '0.2.10-beta.12', type: 'module' }))
  const source = `const moduleFactories = new Map();\n${options.source ?? upstream}\nexport function probe() { installCompressedModuleFactories([[10, () => 'strict'], 20, () => 'flat']); return moduleFactories.has(10); }\n`
  writeFileSync(compiler, source)
  const unrelated = join(adapter, 'unrelated.js')
  writeFileSync(unrelated, source)
  const runner = join(root, 'run.mjs')
  writeFileSync(runner, `
    import { probe as target } from ${JSON.stringify(pathToFileURL(compiler).href)};
    import { probe as other } from ${JSON.stringify(pathToFileURL(unrelated).href)};
    console.log(JSON.stringify({ target: target(), unrelated: other() }));
  `)
  return { root, cli, compiler, unrelated, source, runner }
}

function run(file: string, cli?: string, preload = true) {
  const env = { ...process.env }
  delete env.EDGEONE_CLI_DIRECTORY
  if (cli)
    env.EDGEONE_CLI_DIRECTORY = cli
  return spawnSync(process.execPath, [...(preload ? ['--import', hook] : []), file], {
    env,
    encoding: 'utf8',
    timeout: 20_000,
  })
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('edgeOne module loading hook', () => {
  it('fixes only the selected compiler and leaves installed bytes unchanged', () => {
    const files = fixture()
    const control = run(files.runner, files.cli, false)
    expect(control.status).toBe(0)
    expect(control.stdout).toContain('"target":false')
    const result = run(files.runner, files.cli)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('"target":true,"unrelated":false')
    expect(readFileSync(files.compiler, 'utf8')).toBe(files.source)
    expect(readFileSync(files.unrelated, 'utf8')).toBe(files.source)
  })

  it('survives a launcher forwarding execArgv to its child, as EdgeOne does', () => {
    const files = fixture()
    const launcher = join(files.root, 'launcher.mjs')
    writeFileSync(launcher, `
      import { spawnSync } from 'node:child_process';
      const child = spawnSync(process.execPath, [...process.execArgv, ${JSON.stringify(files.runner)}], { stdio: 'inherit' });
      process.exit(child.status ?? 1);
    `)
    const result = run(launcher, files.cli)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('"target":true,"unrelated":false')
  })

  it.each([
    { cliVersion: '1.6.46' },
    { adapterVersion: '0.2.10-beta.13' },
  ])('rejects an unreviewed package version: %j', (versions) => {
    const files = fixture(versions)
    const result = run(files.runner, files.cli)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('review the compatibility hook')
  })

  it('rejects changed compiler code without writing to disk', () => {
    const files = fixture({ source: upstream.replace('let end = i + 1;', 'let end = i + 2;') })
    const result = run(files.runner, files.cli)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('installer changed')
    expect(readFileSync(files.compiler, 'utf8')).toBe(files.source)
  })

  it('requires an explicit CLI installation instead of guessing a global package', () => {
    const files = fixture()
    const result = run(files.runner)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('EDGEONE_CLI_DIRECTORY must identify')
  })
})
