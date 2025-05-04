export const EVENTS = {
  SHOW_SHARE_DIALOG: 'show-share-dialog',
  RUN_CODE: 'run-code',
  FORMAT_CODE: 'format-code',
  FORMAT_CODE_COMPLETE: 'format-code-complete',
} as const

export type EventType = typeof EVENTS[keyof typeof EVENTS]

export interface EventPayload {
  [EVENTS.SHOW_SHARE_DIALOG]: (url: string) => void
  [EVENTS.RUN_CODE]: (code: string) => void
  [EVENTS.FORMAT_CODE]: (code: string) => void
  [EVENTS.FORMAT_CODE_COMPLETE]: (code: string) => void
}

type EventCallback<E extends EventType> = EventPayload[E]

type CallbackParameters<T extends (...args: any[]) => any> = Parameters<T>

class EventEmitter {
  private events: { [key: string]: EventCallback<any>[] } = {}

  on<E extends EventType>(event: E, callback: EventCallback<E>): void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off<E extends EventType>(event: E, callback: EventCallback<E>): void {
    if (!this.events[event])
      return

    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  emit<E extends EventType>(
    event: E,
    ...args: CallbackParameters<EventPayload[E]>
  ): void {
    if (!this.events[event])
      return

    this.events[event].forEach((callback) => {
      callback(...args)
    })
  }
}

export const eventEmitter = new EventEmitter()
