import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import type { LspStateOrigin } from '@/lib/lsp'
import { clearCacheAndRestartLsp, restartLsp, startLsp, stopLsp } from '@/lib/lsp'
import { disposeLanguageClient } from './language-client'
import { LanguageServiceLeaseManager } from './language-service-lease-manager'

export { LanguageServiceLeaseManager } from './language-service-lease-manager'

const managerState = hmrSlot(HMR_SLOT_KEYS.LSP_SERVICE_LEASES, () => ({
  manager: new LanguageServiceLeaseManager({
    start: () => startLsp('auto'),
    disposeClient: disposeLanguageClient,
    stop: () => stopLsp('auto'),
  }),
}))

export function acquireLanguageService(): () => Promise<void> {
  return managerState.manager.acquire()
}

export async function startLanguageService(origin: LspStateOrigin = 'manual'): Promise<void> {
  await startLsp(origin)
  managerState.manager.markStarted()
}

export async function stopLanguageService(origin: LspStateOrigin = 'manual'): Promise<void> {
  await disposeLanguageClient()
  await stopLsp(origin)
  managerState.manager.markStopped()
}

export async function restartLanguageService(origin: LspStateOrigin = 'manual'): Promise<void> {
  await disposeLanguageClient()
  await restartLsp(origin)
  managerState.manager.markStarted()
}

export async function clearCacheAndRestartLanguageService(origin: LspStateOrigin = 'manual'): Promise<void> {
  await disposeLanguageClient()
  await clearCacheAndRestartLsp(origin)
  managerState.manager.markStarted()
}

import.meta.webpackHot?.accept()
