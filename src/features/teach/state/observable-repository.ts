import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceScope } from '@/features/teach/state/workspace-store'

/**
 * Per-mutating-method metadata the observable wrapper needs:
 *  - `scope`     — the document kind this write touches, so the wrapper can bump
 *    only the matching read subscribers (see {@link WorkspaceScope}).
 *  - `changed`   — given the method's resolved result, did the write actually
 *    change anything? Methods whose repository implementation silently early-
 *    returns when the target does not exist (`updateLessonState`,
 *    `recordBlockOutcome` → `null`; `supersedeLearningRecord` → `false`) report
 *    no change, so a no-op write does not spuriously refresh every view (#8).
 *    Defaults to "always changed" for methods that always mutate.
 */
interface MutatingMethodMeta {
  scope: WorkspaceScope
  changed?: (result: unknown) => boolean
}

const notNull = (result: unknown): boolean => result != null
const isTrue = (result: unknown): boolean => result === true

/**
 * Every mutating {@link WorkspaceRepository} method, mapped to the scope it
 * affects and (where relevant) a predicate that decides whether the call really
 * changed anything. Reads are absent and pass through untouched.
 */
const MUTATING_METHODS = {
  setMission: { scope: 'mission' },
  appendLearningRecord: { scope: 'learningRecords' },
  supersedeLearningRecord: { scope: 'learningRecords', changed: isTrue },
  upsertGlossaryTerm: { scope: 'glossary' },
  setNotes: { scope: 'notes' },
  appendLesson: { scope: 'lessons' },
  updateLessonState: { scope: 'lessons', changed: notNull },
  recordBlockOutcome: { scope: 'lessons', changed: notNull },
  upsertReference: { scope: 'references' },
  replaceRetrieval: { scope: 'retrieval' },
  importAll: { scope: 'all' },
} as const satisfies Partial<Record<keyof WorkspaceRepository, MutatingMethodMeta>>

const MUTATING_MAP = MUTATING_METHODS as Record<string, MutatingMethodMeta | undefined>

/**
 * Wrap a {@link WorkspaceRepository} so that every mutating call fires `onChange`
 * with the affected {@link WorkspaceScope} once it resolves — but only when the
 * call actually changed something. Reads pass through untouched.
 *
 * Both the teacher agent (through its toolkit's repository) and the feature
 * layer's direct UI writes (e.g. `recordBlockOutcome` from a lesson block) go
 * through this wrapper, so the central views and the mission-first gate refresh
 * when a document changes — scoped so only the affected reads re-run — without
 * coupling the domain toolkit to any UI state. A no-op write (superseding a
 * missing record, updating a lesson that no longer exists) does not bump, so an
 * idempotent call cannot trigger a needless refresh.
 */
export function createObservableRepository(
  repo: WorkspaceRepository,
  onChange: (scope: WorkspaceScope) => void,
): WorkspaceRepository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      const meta = typeof prop === 'string' ? MUTATING_MAP[prop] : undefined
      if (typeof value !== 'function' || !meta)
        return value
      return (...args: unknown[]) => {
        const fire = (result: unknown): void => {
          if (!meta.changed || meta.changed(result))
            onChange(meta.scope)
        }
        const result = (value as (...a: unknown[]) => unknown).apply(target, args)
        if (result instanceof Promise) {
          return result.then((resolved) => {
            fire(resolved)
            return resolved
          })
        }
        fire(result)
        return result
      }
    },
  })
}
