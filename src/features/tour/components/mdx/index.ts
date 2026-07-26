import { CompareWith } from './CompareWith'
import { CompareGroup } from './CompareGroup'
import { Highlight } from './Highlight'
import { Note } from './Note'
import { LanguagePicker } from './LanguagePicker'

export const tourMdxComponents = {
  CompareWith,
  CompareGroup,
  Highlight,
  Note,
  LanguagePicker,
  // Suppress h1 from MDX — the page already renders it separately
  h1: () => null,
}
