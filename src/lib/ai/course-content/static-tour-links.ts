import type { ConceptValidationStatus, CourseContentPack, SourceReference } from './types'
import { getDefaultCourseContentIndex } from './loader'
import type { SiteDomain } from '@/lib/siteHref'
import { getTourAIHref, getTourHref } from '@/lib/siteHref'

export interface StaticTourSectionAddress {
  chapterId: string
  subChapterId?: string
  sectionId?: string
}

export interface StaticTourRouteProjection extends StaticTourSectionAddress {
  routeRest: string[]
}

export interface StaticTourCourseEntry {
  packId: string
  contentVersion: string
  primaryConceptId: string
  conceptIds: string[]
  blockIds: string[]
  skillIds: string[]
  exerciseTemplateIds: string[]
  statuses: Record<string, ConceptValidationStatus>
  conceptStatuses: Record<string, ConceptValidationStatus>
  sourceAddress: StaticTourSectionAddress
  sourceRouteRest: string[]
}

export type StaticTourRouteIndex = ReadonlyMap<string, string[]>

export interface StaticTourSourceHrefOptions {
  address?: StaticTourSectionAddress | null
  conceptId?: string | null
  currentOrigin?: string
  routeIndex?: StaticTourRouteIndex
}

export interface StaticTourTopicEntryHrefOptions {
  entry?: Pick<StaticTourCourseEntry, 'primaryConceptId'> | null
  currentOrigin?: string
  servingDomain?: SiteDomain
}

const STATIC_TOUR_ROUTE_REST_BY_SOURCE_KEY: Record<string, string[]> = {
  '01-welcome/01-intro/01': ['welcome', '1'],
  '02-basics/01-bindings/01': ['basics', '1'],
  '02-basics/01-bindings/02': ['basics', '2'],
  '02-basics/02-basic-types/01': ['basics', '8'],
  '02-basics/02-bindings-types/01': ['basics', '14'],
  '02-basics/03-operators/01': ['basics', '33'],
  '02-basics/03-operators/02': ['basics', '34'],
  '03-flow-control/01-conditions/01': ['flow-control', '1'],
}

function stripOrderPrefix(id: string): string {
  return id.replace(/^\d+-/, '')
}

function normalizeStaticTourSectionId(sectionId?: string): string | undefined {
  if (!sectionId)
    return undefined

  const numeric = Number.parseInt(sectionId, 10)
  if (!Number.isNaN(numeric))
    return String(numeric).padStart(2, '0')

  return sectionId
}

export function normalizeStaticTourSectionAddress(address: StaticTourSectionAddress): StaticTourSectionAddress {
  return {
    chapterId: address.chapterId,
    subChapterId: address.subChapterId,
    sectionId: normalizeStaticTourSectionId(address.sectionId),
  }
}

function sourceKey(address: StaticTourSectionAddress): string {
  const normalized = normalizeStaticTourSectionAddress(address)
  return [normalized.chapterId, normalized.subChapterId, normalized.sectionId].filter(Boolean).join('/')
}

function sourceMatchesSection(source: SourceReference, section: StaticTourSectionAddress): boolean {
  const normalized = normalizeStaticTourSectionAddress(section)
  if (source.kind !== 'static_tour')
    return false
  if (source.chapterId !== normalized.chapterId)
    return false
  if (normalized.subChapterId && source.subChapterId !== normalized.subChapterId)
    return false
  if (normalized.sectionId && source.sectionId !== normalized.sectionId)
    return false
  return true
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function sortByTrackOrder(conceptIds: string[], pack: CourseContentPack): string[] {
  const order = new Map<string, number>()
  for (const track of pack.tracks) {
    for (const conceptId of track.conceptIds) {
      if (!order.has(conceptId))
        order.set(conceptId, order.size)
    }
  }

  return [...conceptIds].sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER))
}

function fallbackStaticTourRouteRest(address: StaticTourSectionAddress): string[] {
  const normalized = normalizeStaticTourSectionAddress(address)
  const sectionStep = normalized.sectionId ? Number.parseInt(normalized.sectionId, 10) : 1
  return STATIC_TOUR_ROUTE_REST_BY_SOURCE_KEY[sourceKey(normalized)] ?? [
    stripOrderPrefix(normalized.chapterId),
    Number.isNaN(sectionStep) ? normalized.sectionId ?? '1' : String(sectionStep),
  ]
}

export function createStaticTourRouteIndex(routes: StaticTourRouteProjection[]): StaticTourRouteIndex {
  return new Map(routes.map(route => [sourceKey(route), route.routeRest]))
}

export function getStaticTourRouteRest(address: StaticTourSectionAddress, routeIndex?: StaticTourRouteIndex): string[] {
  return routeIndex?.get(sourceKey(address)) ?? fallbackStaticTourRouteRest(address)
}

export function findDefaultCourseEntryForStaticTourSection(
  section: StaticTourSectionAddress,
  options: { routeRest?: string[] } = {},
): StaticTourCourseEntry | null {
  const address = normalizeStaticTourSectionAddress(section)
  const index = getDefaultCourseContentIndex()
  const { pack, validation } = index
  const blocks = pack.blocks.filter(block => block.sourceRefs.some(source => sourceMatchesSection(source, address)))
  const templates = pack.exerciseTemplates.filter(template => template.sourceRefs.some(source => sourceMatchesSection(source, address)))
  const conceptIds = sortByTrackOrder(unique([
    ...blocks.map(block => block.conceptId),
    ...templates.flatMap(template => template.conceptIds),
  ]), pack)

  const primaryConceptId = conceptIds.find(conceptId => validation.conceptStatuses[conceptId] !== 'invalid')
  if (!primaryConceptId)
    return null

  const skillIds = unique([
    ...pack.skills
      .filter(skill => skill.conceptIds.some(conceptId => conceptIds.includes(conceptId)))
      .map(skill => skill.skillId),
    ...templates.map(template => template.skillId),
  ])
  const statuses = Object.fromEntries(conceptIds.map(conceptId => [conceptId, validation.conceptStatuses[conceptId] ?? 'invalid']))

  return {
    packId: pack.packId,
    contentVersion: pack.contentVersion,
    primaryConceptId,
    conceptIds,
    blockIds: blocks.map(block => block.blockId),
    skillIds,
    exerciseTemplateIds: templates.map(template => template.templateId),
    statuses,
    conceptStatuses: statuses,
    sourceAddress: address,
    sourceRouteRest: options.routeRest ?? getStaticTourRouteRest(address),
  }
}

export function getPrimaryStaticTourSectionForConcept(conceptId: string): StaticTourSectionAddress | null {
  const index = getDefaultCourseContentIndex()
  const concept = index.getConcept(conceptId)
  if (!concept)
    return null

  for (const blockId of concept.blockIds) {
    const source = index.getBlock(blockId)?.sourceRefs.find(ref => ref.kind === 'static_tour')
    if (source) {
      return {
        chapterId: source.chapterId,
        subChapterId: source.subChapterId,
        sectionId: source.sectionId,
      }
    }
  }

  return null
}

export function staticTourRest(address: StaticTourSectionAddress): string[] {
  return getStaticTourRouteRest(address)
}

export function getStaticTourSourceHref(lang: string, options: StaticTourSourceHrefOptions): string | null {
  const address = options.address ?? (options.conceptId ? getPrimaryStaticTourSectionForConcept(options.conceptId) : null)
  if (!address)
    return null

  return getTourHref(lang, {
    currentOrigin: options.currentOrigin,
    rest: getStaticTourRouteRest(address, options.routeIndex),
  })
}

export function getStaticTourTopicEntryHref(lang: string, options: StaticTourTopicEntryHrefOptions = {}): string {
  return getTourAIHref(lang, {
    currentOrigin: options.currentOrigin,
    servingDomain: options.servingDomain,
    topic: options.entry?.primaryConceptId,
  })
}
