import { proxyToRunner } from '@/lib/runner-proxy'

// Compile+run can take several seconds (cold start + execution); allow headroom.
export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  return proxyToRunner(request, 'run')
}
