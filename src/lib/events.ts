type EventCallback = (...args: any[]) => void

class EventEmitter {
  private events: { [key: string]: EventCallback[] } = {}

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event: string, callback: EventCallback) {
    if (!this.events[event])
      return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event])
      return
    this.events[event].forEach(callback => callback(...args))
  }
}

export const eventEmitter = new EventEmitter()

export const EVENTS = {
  SHOW_SHARE_DIALOG: 'show-share-dialog',
  RUN_CODE: 'run-code',
  FORMAT_CODE: 'format-code',
  FORMAT_CODE_COMPLETE: 'format-code-complete',
} as const

export interface EventPayload {
  [EVENTS.SHOW_SHARE_DIALOG]: [url: string]
  [EVENTS.RUN_CODE]: [code: string]
  [EVENTS.FORMAT_CODE]: [code: string]
  [EVENTS.FORMAT_CODE_COMPLETE]: [code: string]
}
