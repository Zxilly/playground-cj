// Encode a string/URL into a data: URL for registering virtual extension files.
export function encodeStringOrUrlToDataUrl(input: string | URL): string {
  if (input instanceof URL) {
    return input.href
  }
  const bytes = new TextEncoder().encode(input)
  const binString = Array.from(bytes, b => String.fromCodePoint(b)).join('')
  const base64 = btoa(binString)
  return new URL(`data:text/plain;base64,${base64}`).href
}
