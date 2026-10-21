import { NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { request as httpsRequest } from 'node:https'
import { rootCertificates } from 'node:tls'
import { DPASTE_CHAIN_CERTIFICATE } from '@/lib/dpaste-ca'

export const runtime = 'nodejs'

async function dpaste(content: string): Promise<string> {
  const body = new URLSearchParams({
    content,
    title: 'Playground Cangjie',
    expiry_days: '200',
  })

  const payload = body.toString()
  return new Promise((resolve, reject) => {
    const request = httpsRequest('https://dpaste.com/api/v2/', {
      method: 'POST',
      ca: [...rootCertificates, DPASTE_CHAIN_CERTIFICATE],
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Cangjie Playground/1.0',
      },
    }, (response) => {
      let result = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        result += chunk
        if (result.length > 4_096)
          response.destroy(new Error('dpaste response is too large'))
      })
      response.on('error', reject)
      response.on('end', () => {
        if (response.statusCode !== 201) {
          reject(new Error(`dpaste returned HTTP ${response.statusCode}`))
          return
        }
        resolve(result.trim())
      })
    })
    request.setTimeout(15_000, () => request.destroy(new Error('dpaste request timed out')))
    request.on('error', reject)
    request.end(payload)
  })
}

export async function POST(request: Request) {
  try {
    const { content } = await request.json()
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const dpasteUrl = await dpaste(content)
    const hash = dpasteUrl.split('/')[3].trim()

    return NextResponse.json({ hash })
  }
  catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: `Failed to create dpaste: ${error}` },
      { status: 500 },
    )
  }
}
