// Event bus for *commands* that can't be expressed as state — e.g. running or
// formatting code, where the listener (CodeRunner) lives in a different subtree
// from the emitter (Monaco editor action). Plain state lives in zustand stores.

export const EVENTS = {
  RUN_CODE: 'run-code',
  FORMAT_CODE: 'format-code',
  FORMAT_CODE_COMPLETE: 'format-code-complete',
} as const

export type EventType = typeof EVENTS[keyof typeof EVENTS]

export interface EventPayload {
  [EVENTS.RUN_CODE]: (code: string) => void
  [EVENTS.FORMAT_CODE]: (code: string) => void
  [EVENTS.FORMAT_CODE_COMPLETE]: (code: string) => void
}

type EventCallback<E extends EventType> = EventPayload[E]

class EventEmitter {
  private events: { [key: string]: EventCallback<any>[] } = {}

  on<E extends EventType>(event: E, callback: EventCallback<E>): void {
    if (!this.events[event])
      this.events[event] = []
    this.events[event].push(callback)
  }

  off<E extends EventType>(event: E, callback: EventCallback<E>): void {
    if (!this.events[event])
      return

    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  emit<E extends EventType>(
    event: E,
    ...args: Parameters<EventPayload[E]>
  ): void {
    if (!this.events[event])
      return

    for (const callback of this.events[event])
      callback(...args)
  }
}

export const eventEmitter = new EventEmitter()
