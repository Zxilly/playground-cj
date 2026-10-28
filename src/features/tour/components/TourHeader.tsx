'use client'

import { lazy, Suspense } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import { Globe, List } from 'lucide-react'
import Image from 'next/image'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { LanguagePicker } from './mdx/LanguagePicker'
import type { FlatSection } from '@/tour/types'
import { getLocaleHref, getPlaygroundHref, getSiteDomain, getTourAIHref, getTourPath } from '@/lib/siteHref'
import styles from './TourHeader.module.css'

const LLMConfigDialog = lazy(() => import('@/modules/llm-config/components/LLMConfigDialog').then(
  module => ({ default: module.LLMConfigDialog }),
))

export interface TourHeaderProps {
  lang: string
  /** Tutorial mode: shows chapter / sub-chapter / section breadcrumb. Omit on AI route. */
  section?: FlatSection
  /** When true, current page IS the AI tutor: render config dialog + omit the switch link. */
  aiMode?: boolean
}

function TableOfContentsButton() {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar()

  return (
    <button
      type="button"
      data-sidebar="trigger"
      aria-label={t`切换侧边栏`}
      aria-expanded={isMobile ? openMobile : open}
      onClick={toggleSidebar}
      className={styles.contentsButton}
    >
      <List size={18} aria-hidden="true" />
      <Trans>目录</Trans>
    </button>
  )
}

export function TourHeader({ lang, section, aiMode = false }: TourHeaderProps) {
  const otherLang = lang === 'en' ? 'zh' : 'en'
  const otherLabel = lang === 'en' ? '中文' : 'EN'
  const tourHomeHref = getTourPath(lang, { servingDomain: getSiteDomain(window.location.host) })
  const aiHref = getTourAIHref(lang, {
    currentOrigin: window.location.origin,
  })
  const localeHref = getLocaleHref(otherLang, window.location)
  const playgroundHref = getPlaygroundHref(lang, { currentOrigin: window.location.origin })

  const chapterName = section && (section.chapterName[lang] ?? section.chapterName.zh)
  const subChapterName = section && (section.subChapterName[lang] ?? section.subChapterName.zh)
  const sectionName = section && (section.sectionName[lang] ?? section.sectionName.zh)
  const ancestors = [chapterName, subChapterName].filter((name, index, names) => name && name !== names[index - 1])

  return (
    <header className={styles.header}>
      <div className={styles.primaryRow}>
        <a href={tourHomeHref} aria-label={t`仓颉之旅首页`} className={styles.brand}>
          <Image src="/icon.png" alt="" width={30} height={30} />
          <span className={styles.brandName}><Trans>仓颉之旅</Trans></span>
        </a>
        <nav aria-label={t`主导航`} className={styles.navigation}>
          <a href={tourHomeHref} aria-current={!aiMode ? 'page' : undefined} className={styles.navLink}>
            <Trans>教程</Trans>
          </a>
          {aiMode
            ? <span aria-current="page" className={styles.navLink}><Trans>AI 课堂</Trans></span>
            : (
                <a href={aiHref} className={styles.navLink} title={t`打开 AI 课堂，从当前教程主题开始学习和练习。`}>
                  <Trans>AI 课堂</Trans>
                </a>
              )}
          <a href={playgroundHref} className={styles.navLink}>Playground</a>
        </nav>
        <div className={styles.preferences}>
          {aiMode && (
            <Suspense fallback={<span className="block size-11" aria-hidden="true" />}>
              <LLMConfigDialog />
            </Suspense>
          )}
          <a href={localeHref} className={styles.localeLink} lang={otherLang}>
            <Globe size={17} aria-hidden="true" />
            {otherLabel}
          </a>
        </div>
      </div>
      <div className={styles.contextRow}>
        {!aiMode && <TableOfContentsButton />}
        {section && (
          <nav aria-label={t`当前章节`} className={styles.breadcrumbs}>
            {ancestors.map(name => (
              <span key={name} className={styles.ancestor}>
                {name}
                <span aria-hidden="true" className={styles.breadcrumbSeparator}>/</span>
              </span>
            ))}
            <span aria-current="page" className={styles.currentLesson} title={sectionName}>{sectionName}</span>
          </nav>
        )}
        <LanguagePicker />
      </div>
    </header>
  )
}
