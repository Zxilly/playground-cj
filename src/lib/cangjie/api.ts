import { NextResponse } from 'next/server'

export async function handleCangjieOp<T>(
  request: Request,
  label: string,
  op: (code: string, signal: AbortSignal) => Promise<T>,
): Promise<NextResponse> {
  const code = await request.text()
  if (!code.trim())
    return NextResponse.json({ error: 'empty request body' }, { status: 400 })

  try {
    return NextResponse.json(await op(code, request.signal))
  }
  catch (err) {
    console.error(`${label} failed:`, err)
    return NextResponse.json({ error: 'internal sandbox error' }, { status: 500 })
  }
}
