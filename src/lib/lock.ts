import AsyncLock from 'async-lock'

export const remoteLock = new AsyncLock()

export function isBusy() {
  return remoteLock.isBusy('run')
}
