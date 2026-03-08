interface ViewsServiceModule {
  Parts: {
    TITLEBAR_PART: unknown
    BANNER_PART: unknown
    SIDEBAR_PART: unknown
    ACTIVITYBAR_PART: unknown
    AUXILIARYBAR_PART: unknown
    EDITOR_PART: unknown
    PANEL_PART: unknown
    STATUSBAR_PART: unknown
  }
  Position: {
    LEFT: unknown
  }
  attachPart: (part: unknown, container: HTMLElement) => unknown
  getSideBarPosition: () => unknown
  isPartVisibile: (part: unknown) => boolean
  onDidChangeSideBarPosition: (listener: () => void) => unknown
  onPartVisibilityChange: (part: unknown, listener: (visible: boolean) => void) => unknown
}

interface ViewsPartConfig {
  part: unknown
  getElementSelector: () => string
  onDidElementChange?: (listener: () => void) => unknown
  optional?: boolean
}

const ATTACH_TIMEOUT_MS = 5000
const ATTACH_RETRY_MS = 50

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function attachPartWhenReady(
  mod: ViewsServiceModule,
  part: unknown,
  getElementSelector: () => string,
  optional = false,
) {
  const deadline = Date.now() + ATTACH_TIMEOUT_MS
  let lastError: unknown

  while (Date.now() < deadline) {
    const selector = getElementSelector()
    const element = document.querySelector<HTMLElement>(selector)

    if (element) {
      try {
        mod.attachPart(part, element)
        return element
      }
      catch (error) {
        lastError = error
      }
    }

    await delay(ATTACH_RETRY_MS)
  }

  if (optional)
    return null

  throw lastError ?? new Error(`Timed out while attaching workbench part: ${String(part)}`)
}

export async function initializeMonacoViewsService() {
  const mod = await import('@codingame/monaco-vscode-views-service-override') as ViewsServiceModule
  const {
    Parts,
    Position,
    getSideBarPosition,
    isPartVisibile,
    onDidChangeSideBarPosition,
    onPartVisibilityChange,
  } = mod

  const configs: ViewsPartConfig[] = [
    { part: Parts.TITLEBAR_PART, getElementSelector: () => '#titleBar', optional: true },
    { part: Parts.BANNER_PART, getElementSelector: () => '#banner', optional: true },
    {
      part: Parts.SIDEBAR_PART,
      getElementSelector: () => getSideBarPosition() === Position.LEFT ? '#sidebar' : '#sidebar-right',
      onDidElementChange: onDidChangeSideBarPosition,
    },
    {
      part: Parts.ACTIVITYBAR_PART,
      getElementSelector: () => getSideBarPosition() === Position.LEFT ? '#activityBar' : '#activityBar-right',
      onDidElementChange: onDidChangeSideBarPosition,
    },
    {
      part: Parts.AUXILIARYBAR_PART,
      getElementSelector: () => getSideBarPosition() === Position.LEFT ? '#auxiliaryBar' : '#auxiliaryBar-left',
      onDidElementChange: onDidChangeSideBarPosition,
    },
    { part: Parts.PANEL_PART, getElementSelector: () => '#panel' },
    { part: Parts.STATUSBAR_PART, getElementSelector: () => '#statusBar', optional: true },
  ]

  for (const config of configs) {
    const element = await attachPartWhenReady(mod, config.part, config.getElementSelector, config.optional)
    if (!element)
      continue

    config.onDidElementChange?.(() => {
      void attachPartWhenReady(mod, config.part, config.getElementSelector, config.optional).catch((error) => {
        console.error('Failed to re-attach Monaco workbench part:', error)
      })
    })

    if (!isPartVisibile(config.part))
      element.style.display = 'none'

    onPartVisibilityChange(config.part, (visible) => {
      const nextElement = document.querySelector<HTMLElement>(config.getElementSelector())
      if (nextElement)
        nextElement.style.display = visible ? 'block' : 'none'
    })
  }
}
