export interface TourSection {
  id: string
  name: Record<string, string>
  markdown: Record<string, string>
  code: Record<string, string>
  mdxSource?: Record<string, any>
}

export interface TourSubChapter {
  id: string
  name: Record<string, string>
  sections: TourSection[]
}

export interface TourChapter {
  id: string
  name: Record<string, string>
  subChapters: TourSubChapter[]
}

export interface FlatSection {
  chapterId: string
  chapterSlug: string
  chapterStep: string
  chapterName: Record<string, string>
  subChapterId: string
  subChapterName: Record<string, string>
  sectionId: string
  sectionName: Record<string, string>
  markdown: Record<string, string>
  code: Record<string, string>
  mdxSource?: Record<string, any>
}

export interface TourSectionSlim {
  id: string
  name: Record<string, string>
}

export interface TourSubChapterSlim {
  id: string
  name: Record<string, string>
  sections: TourSectionSlim[]
}

export interface TourChapterSlim {
  id: string
  name: Record<string, string>
  subChapters: TourSubChapterSlim[]
}
