/*
 * Bootstrap a Cangjie SDK+stdx sandbox and save as a Vercel Sandbox snapshot.
 *
 * Usage:
 *   vercel env pull .env.local
 *   node --env-file=.env.local scripts/build-snapshot.ts
 *
 * Env overrides:
 *   CANGJIE_SDK_URL  — tarball URL (defaults to 1.1.0-beta.25)
 *   CANGJIE_STDX_URL — stdx zip URL (defaults to matching 1.1.0-beta.25.1)
 */

import type { Sandbox as SandboxT } from '@vercel/sandbox'
import { Sandbox } from '@vercel/sandbox'
import { CJ_EXEC, SDK_ROOT, STDX_ROOT } from '../src/lib/cangjie/paths.ts'

const DEFAULT_SDK_URL
  = 'https://cangjie-lang.cn/v1/files/auth/downLoad?nsId=142267&fileName=cangjie-sdk-linux-x64-1.1.0-beta.25.tar.gz&objectKey=69cb718e6e8ed61e6e07fd42'
const DEFAULT_STDX_URL
  = 'https://gitcode.com/Cangjie/cangjie_stdx/releases/download/v1.1.0-beta.25/cangjie-stdx-linux-x64-1.1.0-beta.25.1.zip'

async function runOrThrow(
  sandbox: SandboxT,
  cmd: string,
  args: string[],
  opts: { sudo?: boolean, cwd?: string } = {},
): Promise<void> {
  const res = await sandbox.runCommand({ cmd, args, sudo: opts.sudo, cwd: opts.cwd })
  if (res.exitCode !== 0) {
    const out = await res.output('both')
    throw new Error(`${cmd} ${args.join(' ')} failed (${res.exitCode}):\n${out}`)
  }
}

async function main(): Promise<void> {
  const sdkUrl = process.env.CANGJIE_SDK_URL ?? DEFAULT_SDK_URL
  const stdxUrl = process.env.CANGJIE_STDX_URL ?? DEFAULT_STDX_URL

  console.log('Creating sandbox...')
  const sandbox = await Sandbox.create({
    runtime: 'node22',
    timeout: 30 * 60_000,
  })
  console.log(`  sandbox id: ${sandbox.sandboxId}`)

  try {
    console.log('Installing system deps...')
    await runOrThrow(sandbox, 'dnf', [
      '-y',
      'install',
      'binutils',
      'gcc',
      'glibc-devel',
      'openssl',
      'openssl-devel',
      'libatomic',
      'tar',
      'gzip',
      'unzip',
    ], { sudo: true })

    console.log('Downloading Cangjie SDK...')
    await runOrThrow(sandbox, 'mkdir', ['-p', SDK_ROOT])
    await runOrThrow(sandbox, 'curl', ['-fsSL', '--retry', '3', '-o', '/tmp/sdk.tar.gz', sdkUrl])

    console.log('Extracting SDK...')
    await runOrThrow(sandbox, 'tar', [
      '-xzf',
      '/tmp/sdk.tar.gz',
      '-C',
      SDK_ROOT,
      '--strip-components=1',
    ])
    await runOrThrow(sandbox, 'rm', ['-f', '/tmp/sdk.tar.gz'])

    console.log('Downloading Cangjie stdx...')
    await runOrThrow(sandbox, 'curl', ['-fsSL', '--retry', '3', '-o', '/tmp/stdx.zip', stdxUrl])

    console.log('Extracting stdx...')
    // Locate the folder named "stdx" containing .so files inside the zip and
    // copy its parent contents into STDX_ROOT so final layout is STDX_ROOT/stdx/*.so .
    await runOrThrow(sandbox, 'bash', ['-c', `
set -euo pipefail
mkdir -p /tmp/stdx-raw
unzip -q /tmp/stdx.zip -d /tmp/stdx-raw
# -print -quit avoids SIGPIPE from the "| head -1" pattern under pipefail.
stdx_dir=$(find /tmp/stdx-raw -type d -name stdx -print -quit)
if [ -z "$stdx_dir" ]; then
  echo "stdx directory not found in zip" >&2
  exit 1
fi
import_base=$(dirname "$stdx_dir")
mkdir -p "${STDX_ROOT}"
cp -R "$import_base"/. "${STDX_ROOT}"/
rm -rf /tmp/stdx-raw /tmp/stdx.zip
ls "${STDX_ROOT}"/stdx | head -5
`])

    console.log('Symlinking gcc crt*.o into /usr/lib64 ...')
    await runOrThrow(sandbox, 'bash', ['-c', `
set -e
gcc_lib=$(dirname "$(gcc -print-libgcc-file-name)")
for f in crtbeginS.o crtendS.o; do
  sudo ln -sf "$gcc_lib/$f" "/usr/lib64/$f"
done
`], { sudo: true })

    console.log(`Writing wrapper ${CJ_EXEC} ...`)
    // The wrapper sources envsetup.sh and augments LD_LIBRARY_PATH so compiled
    // binaries can resolve libstdx.*.so at runtime. Escape \\${...} so JS template
    // keeps them as literal bash expansions.
    const wrapperContent = `#!/bin/bash
set -e
. "${SDK_ROOT}/envsetup.sh"
export LD_LIBRARY_PATH="${STDX_ROOT}/stdx\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$@"
`
    await sandbox.writeFiles([{ path: '/tmp/cj-exec', content: wrapperContent, mode: 0o755 }])
    await runOrThrow(sandbox, 'mv', ['/tmp/cj-exec', CJ_EXEC], { sudo: true })
    await runOrThrow(sandbox, 'chmod', ['+x', CJ_EXEC], { sudo: true })

    console.log('Smoke-testing plain compile+run...')
    await sandbox.writeFiles([
      { path: '/home/vercel-sandbox/src/main.cj', content: 'main() { println("plain ok") }\n' },
    ])
    const plainC = await sandbox.runCommand({
      cmd: CJ_EXEC,
      args: ['cjc', '--output-type=exe', '-p', 'src', '-o', 'src/main'],
      cwd: '/home/vercel-sandbox',
    })
    if (plainC.exitCode !== 0)
      throw new Error(`plain compile failed:\n${await plainC.output('both')}`)
    const plainR = await sandbox.runCommand({
      cmd: CJ_EXEC,
      args: ['/home/vercel-sandbox/src/main'],
      cwd: '/home/vercel-sandbox',
    })
    if (plainR.exitCode !== 0)
      throw new Error(`plain run failed:\n${await plainR.output('both')}`)
    console.log(`  plain: ${(await plainR.stdout()).trim()}`)

    console.log('Smoke-testing stdx compile+run...')
    const stdxCode = `import stdx.encoding.json.*

main() {
    let j = JsonString("\\"stdx-ok\\"")
    println(j.toString())
}
`
    await sandbox.writeFiles([{ path: '/home/vercel-sandbox/src/main.cj', content: stdxCode }])
    const stdxCompile = await sandbox.runCommand({
      cmd: CJ_EXEC,
      args: [
        'cjc',
        `--import-path=${STDX_ROOT}`,
        '-L',
        `${STDX_ROOT}/stdx`,
        '-lstdx.encoding.json',
        '--output-type=exe',
        '-p',
        'src',
        '-o',
        'src/main',
      ],
      cwd: '/home/vercel-sandbox',
    })
    if (stdxCompile.exitCode !== 0)
      throw new Error(`stdx compile failed:\n${await stdxCompile.output('both')}`)
    const stdxRun = await sandbox.runCommand({
      cmd: CJ_EXEC,
      args: ['/home/vercel-sandbox/src/main'],
      cwd: '/home/vercel-sandbox',
    })
    if (stdxRun.exitCode !== 0)
      throw new Error(`stdx run failed:\n${await stdxRun.output('both')}`)
    console.log(`  stdx: ${(await stdxRun.stdout()).trim()}`)

    // Clean up smoke artifacts so the snapshot FS stays tidy.
    await runOrThrow(sandbox, 'rm', ['-rf', '/home/vercel-sandbox/src'])

    console.log('Taking snapshot (no expiration)...')
    const snap = await sandbox.snapshot({ expiration: 0 })
    console.log('\n================================================')
    console.log(`Snapshot ID: ${snap.snapshotId}`)
    console.log('================================================')
    console.log('\nSet in Vercel project env:')
    console.log(`  CANGJIE_SNAPSHOT_ID=${snap.snapshotId}`)
  }
  catch (err) {
    console.error('Build failed, stopping sandbox...')
    await sandbox.stop().catch(() => {})
    throw err
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
