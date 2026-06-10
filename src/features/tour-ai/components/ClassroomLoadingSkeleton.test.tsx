import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClassroomLoadingSkeleton } from './ClassroomLoadingSkeleton'

describe('classroomLoadingSkeleton', () => {
  it('renders aria-busy region with several shimmer blocks', () => {
    const { container } = render(<ClassroomLoadingSkeleton />)
    const region = screen.getByRole('status', { name: '正在加载课堂内容' })
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.getAttribute('aria-atomic')).toBe('true')
    const shimmers = container.querySelectorAll('.animate-shimmer')
    expect(shimmers.length).toBeGreaterThanOrEqual(4)
  })

  it('can use a visible title and external description for precise loading copy', () => {
    render(
      <div>
        <h2 id="loading-title">正在准备课堂</h2>
        <p id="loading-description">正在加载课堂运行环境和当前课堂内容。</p>
        <ClassroomLoadingSkeleton labelledBy="loading-title" describedBy="loading-description" />
      </div>,
    )

    const region = screen.getByRole('status', { name: '正在准备课堂' })
    expect(region.getAttribute('aria-describedby')).toBe('loading-description')
    expect(document.getElementById(region.getAttribute('aria-describedby')!)?.textContent).toBe('正在加载课堂运行环境和当前课堂内容。')
  })
})
