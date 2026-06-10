export function resetDocumentScroll() {
  if (typeof document === 'undefined')
    return

  const scrollingElement = document.scrollingElement as HTMLElement | null
  if (scrollingElement) {
    scrollingElement.scrollTop = 0
    scrollingElement.scrollLeft = 0
  }

  document.documentElement.scrollTop = 0
  document.documentElement.scrollLeft = 0

  if (document.body) {
    document.body.scrollTop = 0
    document.body.scrollLeft = 0
  }
}

export function resetClassroomViewportScroll(viewport: HTMLDivElement | null) {
  if (!viewport)
    return
  viewport.scrollTop = 0
  viewport.scrollLeft = 0
}
