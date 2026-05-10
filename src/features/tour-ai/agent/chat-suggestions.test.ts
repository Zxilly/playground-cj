import { describe, expect, it } from 'vitest'
import { buildTourAIChatSuggestions } from './chat-suggestions'

describe('buildTourAIChatSuggestions', () => {
  it('returns the required chat actions with usable prompts for English learners', () => {
    const suggestions = buildTourAIChatSuggestions('en')

    expect(suggestions.every(suggestion => suggestion.title.trim().length > 0)).toBe(true)
    expect(suggestions.every(suggestion => suggestion.prompt.trim().length > 0)).toBe(true)
    expect(suggestions.at(0)?.prompt).toContain('current quiz')
  })

  it('falls back to Chinese suggestions for unsupported languages', () => {
    const suggestions = buildTourAIChatSuggestions('ja')

    expect(suggestions.every(suggestion => suggestion.title.trim().length > 0)).toBe(true)
    expect(suggestions.every(suggestion => suggestion.prompt.trim().length > 0)).toBe(true)
    expect(suggestions.at(0)?.title).toMatch(/题目/)
  })
})
