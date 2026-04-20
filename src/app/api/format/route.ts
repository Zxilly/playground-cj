import type { NextResponse } from 'next/server'
import { handleCangjieOp } from '@/lib/cangjie/api'
import { formatCode } from '@/lib/cangjie/run'

export const runtime = 'nodejs'
export const maxDuration = 60

export function POST(request: Request): Promise<NextResponse> {
  return handleCangjieOp(request, 'formatCode', formatCode)
}
