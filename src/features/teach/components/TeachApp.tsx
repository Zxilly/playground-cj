'use client'

import dynamic from 'next/dynamic'
import { useState, useSyncExternalStore } from 'react'
import { TeachLoadingState } from './TeachLoadingState'

export interface TeachAppProps {
  lang: string
}

const TeachOnboarding = dynamic(() => import('./TeachOnboarding').then(module => module.TeachOnboarding), {
  loading: () => <TeachLoadingState />,
})
const TeachAppRoot = dynamic(() => import('./TeachAppRoot'), {
  loading: () => <TeachLoadingState />,
})

const ONBOARDED_KEY = 'teach:onboarded'
const subscribeToClient = () => () => undefined
const getClientSnapshot = () => true
const getServerSnapshot = () => false

function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  }
  catch {
    return false
  }
}

function TeachEntry({ lang }: TeachAppProps) {
  const [entered, setEntered] = useState(hasOnboarded)

  if (entered)
    return <TeachAppRoot lang={lang} />

  return (
    <TeachOnboarding onEnter={() => {
      try {
        localStorage.setItem(ONBOARDED_KEY, '1')
      }
      catch {
        // Storage can be unavailable in private browsing; entry remains usable.
      }
      setEntered(true)
    }}
    />
  )
}

/** Select the browser entry before downloading either onboarding or runtime. */
export default function TeachApp(props: TeachAppProps) {
  const client = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot)
  return client ? <TeachEntry {...props} /> : <TeachLoadingState />
}
