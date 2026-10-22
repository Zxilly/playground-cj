export interface StatusBarOptions {
  position?: 'top' | 'bottom'
  height?: number
  compactHeight?: number
  className?: string
}

export interface StatusBarHandle {
  container: HTMLElement
  dispose: () => void
}

/** Hosts the application's LSP control without a VS Code workbench statusbar. */
export async function createCustomStatusBar(
  parentContainer: HTMLElement,
  options: StatusBarOptions = {},
): Promise<StatusBarHandle> {
  const {
    position = 'bottom',
    height = 22,
    compactHeight = height,
    className = '',
  } = options
  const container = document.createElement('footer')
  container.className = `statusbar-container ${className}`.trim()
  if (window.getComputedStyle(parentContainer).position === 'static')
    parentContainer.style.position = 'relative'
  container.style.cssText = `
    position: absolute;
    z-index: 1;
    width: 100%;
    left: 0;
    right: 0;
    background: var(--vscode-statusBar-background, #007acc);
    color: var(--vscode-statusBar-foreground, #ffffff);
    display: flex;
    align-items: center;
    font-size: 12px;
    overflow: hidden;
    flex-shrink: 0;
  `

  const compactViewport = window.matchMedia('(max-width: 1023px)')
  const applyResponsiveHeight = () => {
    container.style.height = `${compactViewport.matches ? compactHeight : height}px`
  }
  applyResponsiveHeight()
  compactViewport.addEventListener('change', applyResponsiveHeight)
  if (position === 'top') {
    container.style.top = '0'
    parentContainer.insertBefore(container, parentContainer.firstChild)
  }
  else {
    container.style.bottom = '0'
    parentContainer.appendChild(container)
  }

  return {
    container,
    dispose() {
      compactViewport.removeEventListener('change', applyResponsiveHeight)
      container.remove()
    },
  }
}
