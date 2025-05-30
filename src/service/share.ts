import { compressToBase64, decompressFromBase64 } from 'lz-string'

function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBase64(base64url: string): string {
  return base64url.replace(/-/g, '+').replace(/_/g, '/')
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

  // 兼容传统分享链接，新分享链接在服务端处理
  const hash = params.get('hash')
  if (hash) {
    const response = await fetch(`https://dpaste.com/${hash}.txt`)
    if (response.ok) {
      return [await response.text(), true]
    }
    return ['', false]
  }

  return ['', true]
}

function constructURLWithHash(hash: string): string {
  const url = new URL(window.location.href)
  url.hash = hash

  return url.toString()
}

export function generateDataShareUrl(code: string): string {
  const base64UrlData = base64ToBase64Url(compressToBase64(code))

  const params = new URLSearchParams({ data: base64UrlData })

  return constructURLWithHash(params.toString())
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
