import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClassroomLoadingSkeleton } from './ClassroomLoadingSkeleton'

describe('classroomLoadingSkeleton', () => {
  it('renders aria-busy region with several shimmer blocks', () => {
    const { container } = render(<ClassroomLoadingSkeleton />)
    const region = container.querySelector('[aria-busy="true"]')
    expect(region).not.toBeNull()
    const shimmers = container.querySelectorAll('.animate-shimmer')
    expect(shimmers.length).toBeGreaterThanOrEqual(4)
  })
})
