import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'

/** The mutating methods of {@link WorkspaceRepository} (every non-read entry point). */
const MUTATING_METHODS = [
  'setMission',
  'appendLearningRecord',
  'supersedeLearningRecord',
  'upsertGlossaryTerm',
  'setNotes',
  'appendLesson',
  'updateLessonState',
  'recordBlockOutcome',
  'upsertReference',
  'replaceRetrieval',
  'importAll',
] as const satisfies readonly (keyof WorkspaceRepository)[]

const MUTATING_SET: ReadonlySet<string> = new Set(MUTATING_METHODS)

/**
 * Wrap a {@link WorkspaceRepository} so that every mutating call fires `onChange`
 * once it resolves successfully. Reads pass through untouched.
 *
 * The teacher agent writes the workspace through its toolkit's repository; this
 * wrapper lets the feature layer observe those writes (bumping a store revision)
 * so the central views and the mission-first gate refresh when chat changes a
 * document — without coupling the domain toolkit to any UI state.
 */
export function createObservableRepository(
  repo: WorkspaceRepository,
  onChange: () => void,
): WorkspaceRepository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function' || typeof prop !== 'string' || !MUTATING_SET.has(prop))
        return value
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args)
        if (result instanceof Promise) {
          return result.then((resolved) => {
            onChange()
            return resolved
          })
        }
        onChange()
        return result
      }
    },
  })
}
