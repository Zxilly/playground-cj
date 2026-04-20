import type { Sandbox as SandboxT } from '@vercel/sandbox'
import { Sandbox } from '@vercel/sandbox'
import { CJ_EXEC, WORK_DIR } from './paths'

// Keep this shorter than the route's maxDuration (60s) so the sandbox expires
// naturally even if the function is torn down before finally{sandbox.stop()}
// lands its RPC.
const DEFAULT_TIMEOUT_MS = 55_000

function getSnapshotId(): string {
  const id = process.env.CANGJIE_SNAPSHOT_ID
  if (!id)
    throw new Error('CANGJIE_SNAPSHOT_ID is not set; run scripts/build-snapshot.ts first')
  return id
}

export async function createSandbox(signal?: AbortSignal): Promise<SandboxT> {
  return Sandbox.create({
    source: { type: 'snapshot', snapshotId: getSnapshotId() },
    timeout: Number(process.env.CANGJIE_SANDBOX_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    signal,
  })
}

export interface CmdResult {
  exitCode: number
  output: string
}

export async function runCj(
  sandbox: SandboxT,
  args: string[],
  opts: { cwd?: string, signal?: AbortSignal } = {},
): Promise<CmdResult> {
  const res = await sandbox.runCommand({
    cmd: CJ_EXEC,
    args,
    cwd: opts.cwd ?? WORK_DIR,
    signal: opts.signal,
  })
  return { exitCode: res.exitCode, output: await res.output('both') }
}

export async function withSandbox<T>(
  fn: (sandbox: SandboxT) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const sandbox = await createSandbox(signal)
  try {
    return await fn(sandbox)
  }
  finally {
    sandbox.stop().catch(() => {})
  }
}
