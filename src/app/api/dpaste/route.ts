import { NextResponse } from 'next/server'
import { createDpaste } from '@/lib/dpaste-server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { content } = await request.json()
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const dpasteUrl = await createDpaste(content)
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
