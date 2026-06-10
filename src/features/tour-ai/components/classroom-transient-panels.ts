export const CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT = 'ai-classroom:close-transient-panels'
export const CLASSROOM_TRANSIENT_PANEL_CLOSE_TARGET_SELECTOR = '[data-classroom-transient-panel-close-target]'

export function closeClassroomTransientPanels() {
  if (typeof document === 'undefined')
    return
  document.dispatchEvent(new Event(CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT))
}

export function isClassroomTransientPanelCloseTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest(CLASSROOM_TRANSIENT_PANEL_CLOSE_TARGET_SELECTOR) != null
}
