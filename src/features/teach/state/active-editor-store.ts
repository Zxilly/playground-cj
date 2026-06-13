/**
 * The "active code_task editor" bridge.
 *
 * The teaching workspace renders zero-or-many `code_task` blocks (each owns its
 * own Monaco editor), but the teacher agent only ever drives *one* — the one the
 * learner is currently working in. Rather than couple the domain toolkit to
 * Monaco or to React, each `code_task` editor registers a tiny
 * {@link ActiveEditorHandle} (read/write the current code) when it mounts/focuses
 * and unregisters it when it unmounts. The teacher toolkit's `read_editor_code` /
 * `set_editor_code` tools resolve the *currently registered* handle through this
 * store, so they always target whichever code_task the learner last interacted
 * with — with no shared singleton Monaco editor.
 *
 * This is intentionally not a zustand store: the toolkit reads it imperatively
 * from a tool `execute`, and there is no reactive UI bound to "which editor is
 * active". A module-level registry keeps it dependency-free and testable.
 */

/**
 * The minimal read/write contract a `code_task` editor exposes so the teacher
 * agent can read or seed the learner's current code. Backed by the Monaco model
 * (`model.getValue()` / `model.setValue()`) in the real app, and by a fake in
 * tests.
 */
export interface ActiveEditorHandle {
  /** Read the editor's current contents. */
  getCode: () => string
  /** Replace the editor's current contents with `code`. */
  setCode: (code: string) => void
}

/**
 * The imperative bridge the teacher toolkit injects (and the feature layer wires
 * to the {@link activeEditorRegistry}). `getCode` returns `null` when no
 * code_task editor is currently active so the tool can return an explicit "no
 * active editor" hint rather than fabricating an empty string; `setCode` reports
 * whether a write actually landed on an active editor.
 */
export interface ActiveEditorBridge {
  /** Read the active editor's code, or null when there is no active editor. */
  getCode: () => string | null
  /** Write `code` to the active editor; returns false when none is active. */
  setCode: (code: string) => boolean
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
    setCode: (code) => {
      if (!active)
        return false
      active.setCode(code)
      return true
    },
  }
}
