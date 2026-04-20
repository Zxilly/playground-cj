import type { FormatMessage, RunMessage } from './types'
import { STDX_ROOT, WORK_DIR } from './paths'
import { runCj, withSandbox } from './sandbox'

interface ScanDependency {
  package: string
  isStd: boolean
}

interface ScanResult {
  dependencies?: ScanDependency[]
}

// Only scan-dependency when the user actually imports stdx; a plain substring
// match would fire on benign string literals and add needless round trips.
const STDX_IMPORT_RE = /^\s*import\s+stdx\b/m

export async function compileAndRun(code: string, signal?: AbortSignal): Promise<RunMessage> {
  return withSandbox(async (sandbox) => {
    const mainPath = `${WORK_DIR}/src/main.cj`
    const binPath = `${WORK_DIR}/src/main`

    await sandbox.writeFiles([{ path: mainPath, content: code }], { signal })

    const extraLinks: string[] = []

    if (STDX_IMPORT_RE.test(code)) {
      const scan = await runCj(sandbox, ['cjc', '--scan-dependency', '--package', 'src'], { cwd: WORK_DIR, signal })
      if (scan.exitCode !== 0) {
        return { compiler_output: scan.output, compiler_code: scan.exitCode, bin_output: '', bin_code: 0 }
      }
      try {
        const parsed = JSON.parse(scan.output) as ScanResult
        for (const dep of parsed.dependencies ?? []) {
          if (typeof dep.package === 'string' && typeof dep.isStd === 'boolean' && !dep.isStd && dep.package)
            extraLinks.push(`-l${dep.package}`)
        }
      }
      catch {
        // Parse failure → fall through; cjc will surface a real diagnostic.
      }
    }

    const compile = await runCj(sandbox, [
      'cjc',
      `--import-path=${STDX_ROOT}`,
      '-L',
      `${STDX_ROOT}/stdx`,
      ...extraLinks,
      '--output-type=exe',
      '-p',
      'src',
      '-o',
      'src/main',
      '-V',
      '-j',
      '1',
    ], { cwd: WORK_DIR, signal })

    const msg: RunMessage = {
      compiler_output: compile.output,
      compiler_code: compile.exitCode,
      bin_output: '',
      bin_code: 0,
    }

    if (compile.exitCode !== 0)
      return msg

    const run = await runCj(sandbox, [binPath], { cwd: WORK_DIR, signal })
    msg.bin_output = run.output
    msg.bin_code = run.exitCode
    return msg
  }, signal)
}

export async function formatCode(code: string, signal?: AbortSignal): Promise<FormatMessage> {
  return withSandbox(async (sandbox) => {
    const tmpPath = `${WORK_DIR}/tmp.cj`
    await sandbox.writeFiles([{ path: tmpPath, content: code }], { signal })

    const result = await runCj(sandbox, ['cjfmt', '-f', tmpPath, '-o', tmpPath], { cwd: WORK_DIR, signal })

    let formatted = code
    let note = ''
    if (result.exitCode === 0) {
      const buf = await sandbox.readFileToBuffer({ path: tmpPath }, { signal })
      if (buf)
        formatted = buf.toString('utf8')
      else
        note = 'failed to read back formatted output; returning original code'
    }

    return {
      formatted,
      formatter_output: note ? (result.output ? `${result.output}\n${note}` : note) : result.output,
      formatter_code: result.exitCode,
    }
  }, signal)
}
