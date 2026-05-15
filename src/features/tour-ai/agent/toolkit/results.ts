export function ok<T extends object>(extra?: T) {
  return { ok: true as const, ...(extra ?? ({} as T)) } as { ok: true } & T
}

export function fail(message: string) {
  return { ok: false as const, error: message }
}
