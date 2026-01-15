/**
 * Status Bar Hack Module
 *
 * 在 EditorService 模式下手动创建状态栏。
 * 这是一个 hack 解决方案，因为 EditorService 模式下状态栏服务
 * 虽然可以注册，但没有 DOM 容器可以渲染。
 *
 * 此模块通过 createAuxiliaryStatusbarPart 手动创建状态栏部件。
 */

import getStatusbarServiceOverride from '@codingame/monaco-vscode-view-status-bar-service-override'
import type { IEditorOverrideServices } from '@codingame/monaco-vscode-api'

/**
 * 获取状态栏服务覆盖
 * 用于 MonacoVscodeApiConfig.serviceOverrides
 */
export function getStatusBarServiceOverrides(): IEditorOverrideServices {
  return {
    ...getStatusbarServiceOverride(),
  }
}

export interface StatusBarOptions {
  /** 状态栏位置，默认 bottom */
  position?: 'top' | 'bottom'
  /** 状态栏高度，默认 22px */
  height?: number
  /** 自定义样式类名 */
  className?: string
}

export interface StatusBarEntry {
  id: string
  name: string
  text: string
  ariaLabel?: string
  tooltip?: string
  command?: string
  alignment: 'left' | 'right'
  priority?: number
}

export interface StatusBarEntryAccessor {
  update: (entry: Partial<StatusBarEntry>) => void
  dispose: () => void
}

export interface StatusBarHandle {
  container: HTMLElement
  addEntry: (entry: StatusBarEntry) => StatusBarEntryAccessor
  updateEntry: (id: string, entry: Partial<StatusBarEntry>) => void
  removeEntry: (id: string) => void
  dispose: () => void
}

/**
 * 在 EditorService 模式下创建自定义状态栏
 *
 * 必须在 MonacoVscodeApiWrapper.start() 完成后调用
 *
 * @param parentContainer 父容器元素
 * @param options 状态栏选项
 * @returns 状态栏句柄
 */
export async function createCustomStatusBar(
  parentContainer: HTMLElement,
  options: StatusBarOptions = {},
): Promise<StatusBarHandle> {
  const {
    position = 'bottom',
    height = 22,
    className = '',
  } = options

  const { getService } = await import('@codingame/monaco-vscode-api')
  const { IStatusbarService } = await import('@codingame/monaco-vscode-api/services')
  const { IInstantiationService } = await import('@codingame/monaco-vscode-api/services')

  const container = document.createElement('footer')
  container.id = 'custom-statusbar'
  container.className = `statusbar-container ${className}`.trim()
  container.style.cssText = `
    height: ${height}px;
    width: 100%;
    background: var(--vscode-statusBar-background, #007acc);
    color: var(--vscode-statusBar-foreground, #ffffff);
    display: flex;
    align-items: center;
    font-size: 12px;
    overflow: hidden;
  `

  if (position === 'top') {
    parentContainer.insertBefore(container, parentContainer.firstChild)
  }
  else {
    parentContainer.appendChild(container)
  }

  const statusbarService = await getService(IStatusbarService)
  const instantiationService = await getService(IInstantiationService)

  const auxiliaryPart = statusbarService.createAuxiliaryStatusbarPart(
    container,
    instantiationService,
  )

  interface EntryData {
    accessor: StatusBarEntryAccessor
    currentState: {
      name: string
      text: string
      ariaLabel: string
      tooltip?: string
      command?: string
    }
  }
  const entries = new Map<string, EntryData>()

  return {
    container,

    addEntry(entry: StatusBarEntry): StatusBarEntryAccessor {
      const alignment = entry.alignment === 'left' ? 0 : 1

      const currentState = {
        name: entry.name,
        text: entry.text,
        ariaLabel: entry.ariaLabel || entry.text,
        tooltip: entry.tooltip,
        command: entry.command,
      }

      const nativeAccessor = auxiliaryPart.addEntry(
        {
          name: currentState.name,
          text: currentState.text,
          ariaLabel: currentState.ariaLabel,
          tooltip: currentState.tooltip,
          command: currentState.command,
        },
        entry.id,
        alignment,
        entry.priority || 0,
      )

      const entryAccessor: StatusBarEntryAccessor = {
        update: (update) => {
          if (update.name !== undefined)
            currentState.name = update.name
          if (update.text !== undefined)
            currentState.text = update.text
          if (update.ariaLabel !== undefined)
            currentState.ariaLabel = update.ariaLabel
          if (update.tooltip !== undefined)
            currentState.tooltip = update.tooltip

          nativeAccessor.update({
            name: currentState.name,
            text: currentState.text,
            ariaLabel: currentState.ariaLabel,
            tooltip: currentState.tooltip,
            command: currentState.command,
          })
        },
        dispose: () => {
          nativeAccessor.dispose()
          entries.delete(entry.id)
        },
      }

      entries.set(entry.id, { accessor: entryAccessor, currentState })
      return entryAccessor
    },

    updateEntry(id: string, update: Partial<StatusBarEntry>) {
      const entryData = entries.get(id)
      if (entryData) {
        entryData.accessor.update(update)
      }
    },

    removeEntry(id: string) {
      const entryData = entries.get(id)
      if (entryData) {
        entryData.accessor.dispose()
      }
    },

    dispose() {
      entries.forEach(entryData => entryData.accessor.dispose())
      entries.clear()
      auxiliaryPart.dispose()
      container.remove()
    },
  }
}
