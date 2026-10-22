import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TourNavigation } from '@/features/tour/components/TourNavigation'

describe('tourNavigation', () => {
  afterEach(cleanup)

  it('disables previous on the first section and reports progress', () => {
    render(<TourNavigation lang="en" currentIndex={0} total={3} onPrev={() => {}} onNext={() => {}} />)

    expect(screen.getByRole('button', { name: /previous/i })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: /next/i })).toHaveProperty('disabled', false)
    expect(document.body.textContent?.replace(/\s+/g, '')).toContain('1/3')
  })

  it('calls handlers for enabled navigation buttons', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(<TourNavigation lang="zh" currentIndex={1} total={3} onPrev={onPrev} onNext={onNext} />)

    fireEvent.click(screen.getByRole('button', { name: '上一页' }))
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('uses distinct highlight targets for previous and next controls', () => {
    render(<TourNavigation lang="en" currentIndex={1} total={3} onPrev={() => {}} onNext={() => {}} />)

    expect(screen.getByRole('button', { name: /previous/i }).getAttribute('data-tour-highlight')).toBe('prev')
    expect(screen.getByRole('button', { name: /next/i }).getAttribute('data-tour-highlight')).toBe('next')
  })

  it('exposes the mobile editor state and keeps the lesson controls accessible', () => {
    const onToggle = vi.fn()
    const onNext = vi.fn()
    const { rerender } = render(
      <TourNavigation lang="zh" currentIndex={0} total={3} onPrev={() => {}} onNext={onNext} editorToggle={{ expanded: true, onToggle }} />,
    )

    const toggle = screen.getByRole('button', { name: '收起代码' })
    expect(toggle.getAttribute('aria-controls')).toBe('tour-editor-content')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: '上一页' })).toHaveProperty('disabled', true)
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(onNext).toHaveBeenCalledOnce()

    rerender(
      <TourNavigation lang="en" currentIndex={2} total={3} onPrev={() => {}} onNext={onNext} editorToggle={{ expanded: false, onToggle }} />,
    )
    expect(screen.getByRole('button', { name: 'Show code' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true)
  })
})
