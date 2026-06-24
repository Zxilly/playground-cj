import { proxyToRunner } from '@/lib/runner-proxy'

export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  return proxyToRunner(request, 'format')
}
