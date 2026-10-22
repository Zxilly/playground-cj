import { describe, expect, it, vi } from 'vitest'
import LangPage from '@/app/[lang]/page'
import { getShareCode } from '@/lib/dpaste-server'

vi.mock('@/lib/dpaste-server', () => ({ getShareCode: vi.fn() }))
vi.mock('@/features/playground/components/PlaygroundWrapper', () => ({ default: vi.fn() }))

describe('playground server page', () => {
  it('returns the shell without waiting for a short-link provider', async () => {
    const pendingCode = new Promise<string>(() => {})
    vi.mocked(getShareCode).mockReturnValueOnce(pendingCode)
    const page = await LangPage({
      params: Promise.resolve({ lang: 'en' }),
      searchParams: Promise.resolve({ hash: 'example' }),
    })
    expect(page.props.children.props.sharedCode).toBe(pendingCode)
    expect(page.props.children.props.lang).toBe('en')
  })
})
