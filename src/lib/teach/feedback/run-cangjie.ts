// Keep existing classroom imports and stored-result types compatible while all
// editor surfaces use the same execution contract.
export { defaultRunner, runCangjieCode } from '@/lib/runner'
export type { CangjieRunner, RunCangjieCodeDeps, RunFailureKind, RunResult } from '@/lib/runner'
