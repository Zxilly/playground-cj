import { NextResponse } from 'next/server'

export const runtime = 'edge'

async function dpaste(content: string) {
  const query = new URLSearchParams()
  query.set('content', content)
  query.set('title', 'Playground Cangjie')
  query.set('expiry_days', '200')

  const response = await fetch('https://dpaste.com/api/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: query.toString(),
  })
  return response.text()
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
    return NextResponse.json(
      { error: `Failed to create dpaste: ${error}` },
      { status: 500 },
    )
  }
}
