'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { TeachLanding } from './TeachLanding'
import { TeachLoadingState } from './TeachLoadingState'

const TeachConfigWizard = dynamic(
  () => import('./TeachConfigWizard').then(module => module.TeachConfigWizard),
  { loading: () => <TeachLoadingState /> },
)

/** Returning learners skip this module and its introduction/configuration UI. */
export function TeachOnboarding({ onEnter }: { onEnter: () => void }) {
  const [stage, setStage] = useState<'landing' | 'config'>('landing')

  if (stage === 'landing')
    return <TeachLanding onStart={() => setStage('config')} />

  return <TeachConfigWizard onEnter={onEnter} onBack={() => setStage('landing')} />
}
