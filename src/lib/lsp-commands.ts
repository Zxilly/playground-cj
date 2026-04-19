import { msg } from '@lingui/core/macro'
import { i18n } from '@/lib/i18n'
import {
  clearCacheAndRestartLsp,
  restartLsp,
  startLsp,
  stopLsp,
} from '@/lib/lsp'

export const LSP_COMMAND_IDS = {
  start: 'cangjie.lsp.start',
  stop: 'cangjie.lsp.stop',
  restart: 'cangjie.lsp.restart',
  clearCacheRestart: 'cangjie.lsp.clearCacheAndRestart',
} as const

let registered = false
let pendingRegistration: Promise<void> | null = null

/** Registers Cangjie LSP lifecycle commands in the Command Palette. */
export async function registerLspCommands(): Promise<void> {
  if (registered)
    return
  if (pendingRegistration)
    return pendingRegistration

  pendingRegistration = (async () => {
    const { CommandsRegistry, MenuRegistry, MenuId } = await import('@codingame/monaco-vscode-api/monaco')

    interface ActionDef {
      id: string
      title: string
      handler: () => Promise<void>
    }

    const actions: ActionDef[] = [
      {
        id: LSP_COMMAND_IDS.start,
        title: i18n._(msg`仓颉：启动 LSP`),
        handler: () => startLsp('manual'),
      },
      {
        id: LSP_COMMAND_IDS.stop,
        title: i18n._(msg`仓颉：停止 LSP`),
        handler: () => stopLsp('manual'),
      },
      {
        id: LSP_COMMAND_IDS.restart,
        title: i18n._(msg`仓颉：重启 LSP`),
        handler: () => restartLsp('manual'),
      },
      {
        id: LSP_COMMAND_IDS.clearCacheRestart,
        title: i18n._(msg`仓颉：清除缓存并重启 LSP`),
        handler: () => clearCacheAndRestartLsp('manual'),
      },
    ]

    for (const action of actions) {
      CommandsRegistry.registerCommand({
        id: action.id,
        handler: () => {
          void action.handler().catch(err => console.error(`[LSP] ${action.id} failed:`, err))
        },
      })
      MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command: { id: action.id, title: action.title },
      })
    }

    registered = true
  })()

  try {
    await pendingRegistration
  }
  finally {
    pendingRegistration = null
  }
}
