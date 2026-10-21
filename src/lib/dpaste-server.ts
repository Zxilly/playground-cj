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

export async function createDpaste(content: string): Promise<string> {
  const payload = new URLSearchParams({ content, title: 'Playground Cangjie', expiry_days: '200' })
  const response = await requestDpaste('/api/v2/', payload.toString())
  if (response.status !== 201)
    throw new Error(`dpaste returned HTTP ${response.status}`)
  return response.body.trim()
}

export async function getShareCode(hash: string): Promise<string | undefined> {
  if (!/^[a-z0-9]+$/i.test(hash))
    return undefined
  const response = await requestDpaste(`/${hash}.txt`)
  return response.status === 200 ? response.body : undefined
}
