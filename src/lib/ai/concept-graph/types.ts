export interface LocaleText { zh: string, en: string }

export interface ConceptNode {
  conceptId: string
  title: LocaleText
  summary: LocaleText
  difficulty: 1 | 2 | 3 | 4 | 5
  prerequisites: string[]
  chapterRefs: string[]
  docRefs?: string[]
  commonMisconceptions?: LocaleText[]
}

export interface ConceptGraph {
  version: 1
  nodes: ConceptNode[]
}
