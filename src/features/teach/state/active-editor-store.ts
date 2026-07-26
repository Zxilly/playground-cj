/**
 * Read-only bridge to the editor the learner most recently focused. Editors
 * register per-workspace handles so the Lesson Orchestrator can inspect the
 * relevant buffer without receiving a capability to modify learner code.
 */

/**
 * Minimal capability exposed to the active-editor registry.
 */
export interface ActiveEditorHandle {
  /** Read the editor's current contents. */
  getCode: () => string
}

/**
 * The imperative bridge the teacher toolkit injects (and the feature layer wires
 * to the active-editor registry). `getCode` returns `null` when no editor is
 * active so the tool can report that state instead of fabricating empty code.
 */
export interface ActiveEditorBridge {
  /** Read the active editor's code, or null when there is no active editor. */
  getCode: () => string | null
}

/**
 * The registry surface a `code_task` editor uses to (de)register itself as the
 * active editor. Separate from {@link ActiveEditorBridge} so producers (editors)
 * and consumers (the toolkit) depend only on what they need.
 */
export interface ActiveEditorRegistry extends ActiveEditorBridge {
  /**
   * Register `handle` as the active code_task editor and return an unregister
   * function. Unregistering only clears the active handle if it is still the one
   * registered here (a later editor registering wins; this editor's later
   * unmount must not clear the newer one).
   */
  register: (handle: ActiveEditorHandle) => () => void
}

/**
 * Create an isolated active-editor registry. The app creates one per workspace
 * (so two language workspaces never cross-talk) and tests create one per case.
 */
export function createActiveEditorRegistry(): ActiveEditorRegistry {
  let active: ActiveEditorHandle | null = null

  return {
    register: (handle) => {
      active = handle
      return () => {
        if (active === handle)
          active = null
      }
    },
    getCode: () => (active ? active.getCode() : null),
  }
}
