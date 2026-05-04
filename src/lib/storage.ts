// Tiny safe-localStorage helpers. Centralises the SSR check + try/catch
// boilerplate shared by the AI/tour persistence layers.

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined')
    return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null)
      return fallback
    return JSON.parse(raw) as T
  }
  catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
  catch {}
}

export function readString(key: string, fallback: string): string {
  if (typeof window === 'undefined')
    return fallback
  try {
    return window.localStorage.getItem(key) ?? fallback
  }
  catch {
    return fallback
  }
}

export function writeString(key: string, value: string): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage.setItem(key, value)
  }
  catch {}
}

export function removeKey(key: string): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage.removeItem(key)
  }
  catch {}
}
