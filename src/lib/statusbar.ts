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

/**
 * Hosts the application's LSP status control as a normal flex item (never
 * overlaying the editor canvas) without loading a VS Code workbench statusbar.
 */
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
  container.style.cssText = `
    position: relative;
    z-index: 1;
    width: 100%;
    background: var(--vscode-statusBar-background, var(--muted, #007acc));
    color: var(--vscode-statusBar-foreground, var(--foreground, #ffffff));
    border-top: 1px solid var(--vscode-statusBar-border, var(--border, transparent));
    display: flex;
    align-items: center;
    justify-content: flex-end;
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
    parentContainer.insertBefore(container, parentContainer.firstChild)
  }
  else {
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
