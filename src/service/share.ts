import { compressToBase64, decompressFromBase64 } from 'lz-string'

const PLUS_RE = /\+/g
const SLASH_RE = /\//g
const TRAILING_EQ_RE = /=+$/
const DASH_RE = /-/g
const UNDERSCORE_RE = /_/g

function base64ToBase64Url(base64: string): string {
  return base64.replace(PLUS_RE, '-').replace(SLASH_RE, '_').replace(TRAILING_EQ_RE, '')
}

function base64UrlToBase64(base64url: string): string {
  return base64url.replace(DASH_RE, '+').replace(UNDERSCORE_RE, '/')
}

async function fetchDpasteContent(hash: string): Promise<string | undefined> {
  const response = await fetch(`https://dpaste.com/${hash}.txt`)
  if (response.ok) {
    return response.text()
  }
  return undefined
}

export async function getShareCode(hash: string): Promise<string | undefined> {
  return fetchDpasteContent(hash)
}

export function loadDataShareCode(): string | undefined {
  const params = new URLSearchParams(window.location.hash.slice(1))

  const base64UrlData = params.get('data')
  if (base64UrlData) {
    return decompressFromBase64(base64UrlToBase64(base64UrlData))
  }

  return undefined
}

export async function loadLegacyShareCode(): Promise<[string, boolean]> {
  const params = new URLSearchParams(window.location.hash.slice(1))

  const hash = params.get('hash')
  if (hash) {
    const content = await fetchDpasteContent(hash)
    return content ? [content, true] : ['', false]
  }

  return ['', true]
}

export function generateDataShareUrl(code: string): string {
  const base64UrlData = base64ToBase64Url(compressToBase64(code))
  const params = new URLSearchParams({ data: base64UrlData })
  const url = new URL(window.location.href)
  url.hash = params.toString()
  return url.toString()
}

export async function generateHashShareUrl(code: string): Promise<string> {
  const response = await fetch('/api/dpaste', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: code }),
  })

  if (!response.ok) {
    throw new Error('Failed to create share URL')
  }

  const { hash } = await response.json()

  const url = new URL(window.location.href.split('#')[0])
  url.search = ''
  url.searchParams.set('hash', hash)

  return url.toString()
}
