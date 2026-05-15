import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTourNavigation } from '@/features/tour/hooks/useTourNavigation'

const sections = [
  { chapterId: 'ch1', subChapterId: 'sub1', sectionId: 's1', chapterSlug: '01-start', chapterStep: '01-intro', sectionName: { zh: '介绍' } },
  { chapterId: 'ch1', subChapterId: 'sub1', sectionId: 's2', chapterSlug: '01-start', chapterStep: '02-code', sectionName: { zh: '代码' } },
  { chapterId: 'ch2', subChapterId: 'sub2', sectionId: 's3', chapterSlug: '02-next', chapterStep: '01-end', sectionName: { zh: '结束' } },
] as never[]

function Harness() {
  const navigation = useTourNavigation({
    allSections: sections,
    basePath: '/zh/tour',
    initialIndex: 1,
  })

  return (
    <div>
      <span data-testid="index">{navigation.currentIndex}</span>
      <span data-testid="section">{navigation.currentSection.sectionId}</span>
      <button type="button" onClick={navigation.goPrev}>prev</button>
      <button type="button" onClick={navigation.goNext}>next</button>
      <button type="button" onClick={() => navigation.goToSection('ch2', 'sub2', 's3')}>jump</button>
      <div data-tour-editor-root>
        <button type="button">inside editor</button>
      </div>
    </div>
  )
}

describe('useTourNavigation', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('updates the current section and pushes section URLs for explicit navigation', () => {
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})

    render(<Harness />)

    expect(screen.getByTestId('section').textContent).toBe('s2')

    fireEvent.click(screen.getByRole('button', { name: 'next' }))
    expect(screen.getByTestId('index').textContent).toBe('2')
    expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh/tour/02-next/01-end')

    fireEvent.click(screen.getByRole('button', { name: 'prev' }))
    expect(screen.getByTestId('section').textContent).toBe('s2')
    expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh/tour/01-start/02-code')

    fireEvent.click(screen.getByRole('button', { name: 'jump' }))
    expect(screen.getByTestId('section').textContent).toBe('s3')
    expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh/tour/02-next/01-end')
  })

  it('handles PageUp/PageDown shortcuts but ignores events from the tour editor', () => {
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})

    render(<Harness />)

    fireEvent.keyDown(window, { key: 'PageDown' })
    expect(screen.getByTestId('section').textContent).toBe('s3')

    fireEvent.keyDown(screen.getByRole('button', { name: 'inside editor' }), { key: 'PageUp' })
    expect(screen.getByTestId('section').textContent).toBe('s3')

    fireEvent.keyDown(window, { key: 'PageUp' })
    expect(screen.getByTestId('section').textContent).toBe('s2')
    expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh/tour/01-start/02-code')
  })
})
