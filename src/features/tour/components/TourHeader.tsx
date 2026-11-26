'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { List } from 'lucide-react'
import Image from 'next/image'
import { Trans, useLingui } from '@lingui/react/macro'
import { AppNavLinks, LocaleSwitchLink, ThemeToggle } from '@/components/app-shell'
import { LanguagePicker } from './mdx/LanguagePicker'
import type { FlatSection } from '@/tour/types'
import { getSiteDomain, getTourPath } from '@/lib/siteHref'
import styles from './TourHeader.module.css'
import { useHydrated } from '@/hooks/useHydrated'
import type { Locale } from '@/lib/i18n'
import type { SiteDomain } from '@/lib/siteHref'

export interface TourHeaderProps {
  lang: string
  /** Shows chapter / sub-chapter / section breadcrumb and forwards current chapter to AI Classroom. */
  section?: FlatSection
  servingDomain?: SiteDomain
}

function TableOfContentsButton() {
  const { t } = useLingui()
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

export function TourHeader({ lang, section, servingDomain = 'playground' }: TourHeaderProps) {
  const { t } = useLingui()
  const hydrated = useHydrated()
  const currentLocale: Locale = lang === 'en' ? 'en' : 'zh'
  const fallbackPathname = getTourPath(currentLocale, {
    servingDomain,
    rest: section ? [section.chapterSlug, section.chapterStep] : [],
  })
  const currentDomain = hydrated ? getSiteDomain(window.location.host) : servingDomain
  const tourHomeHref = getTourPath(currentLocale, { servingDomain: currentDomain })

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
        <AppNavLinks
          active="tour"
          lang={currentLocale}
          servingDomain={servingDomain}
          aiTopic={section?.chapterSlug}
          className={styles.navigation}
          linkClassName={styles.navLink}
          activeLinkClassName={styles.navLinkActive}
        />
        <div className={styles.preferences}>
          <ThemeToggle />
          <LocaleSwitchLink
            lang={currentLocale}
            fallbackPathname={fallbackPathname}
            className={styles.localeLink}
          />
        </div>
      </div>
      <div className={styles.contextRow}>
        <TableOfContentsButton />
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
