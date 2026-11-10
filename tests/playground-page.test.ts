import { describe, expect, it, vi } from 'vitest'
import { isValidElement } from 'react'
import LangPage from '@/app/[lang]/page'
import { getShareCode } from '@/lib/dpaste-server'
import PlaygroundWrapper from '@/features/playground/components/PlaygroundWrapper'

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
    const children = Array.isArray(page.props.children) ? page.props.children : [page.props.children]
    const shell = children.find(child => isValidElement(child) && child.type === PlaygroundWrapper)
    expect(isValidElement<{ sharedCode: unknown, lang: string }>(shell) && shell.props.sharedCode).toBe(pendingCode)
    expect(isValidElement<{ sharedCode: unknown, lang: string }>(shell) && shell.props.lang).toBe('en')
  })
})
