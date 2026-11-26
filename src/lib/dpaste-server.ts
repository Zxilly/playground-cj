import { Buffer } from 'node:buffer'
import { request as httpsRequest } from 'node:https'
import { rootCertificates } from 'node:tls'
import { DPASTE_CHAIN_CERTIFICATE } from './dpaste-ca'

function requestDpaste(path: string, payload?: string): Promise<{ status: number, body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(`https://dpaste.com${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      ca: [...rootCertificates, DPASTE_CHAIN_CERTIFICATE],
      headers: {
        'User-Agent': 'Cangjie Playground/1.0',
        ...(payload === undefined
          ? {}
          : {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(payload),
            }),
      },
    }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
        if (body.length > 1_048_576)
          response.destroy(new Error('dpaste response is too large'))
      })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode ?? 502, body }))
    })
    request.setTimeout(15_000, () => request.destroy(new Error('dpaste request timed out')))
    request.on('error', reject)
    request.end(payload)
  })
}

export type ShareCodeLoadError = 'invalid_hash' | 'not_found' | 'timeout' | 'unavailable'

export type ShareCodeResult
  = | { ok: true, code: string }
    | { ok: false, reason: ShareCodeLoadError, status?: number }

export async function createDpaste(content: string): Promise<string> {
  const payload = new URLSearchParams({ content, title: 'Playground Cangjie', expiry_days: '200' })
  const response = await requestDpaste('/api/v2/', payload.toString())
  if (response.status !== 201)
    throw new Error(`dpaste returned HTTP ${response.status}`)
  return response.body.trim()
}

export async function getShareCodeResult(hash: string): Promise<ShareCodeResult> {
  if (!/^[a-z0-9]+$/i.test(hash))
    return { ok: false, reason: 'invalid_hash' }

  try {
    const response = await requestDpaste(`/${hash}.txt`)
    if (response.status === 200)
      return { ok: true, code: response.body }
    if (response.status === 404 || response.status === 410)
      return { ok: false, reason: 'not_found', status: response.status }
    return { ok: false, reason: 'unavailable', status: response.status }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('timed out'))
      return { ok: false, reason: 'timeout' }
    return { ok: false, reason: 'unavailable' }
  }
}

export async function getShareCode(hash: string): Promise<ShareCodeResult | string | undefined> {
  return getShareCodeResult(hash)
}
