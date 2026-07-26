'use client'

import dynamic from 'next/dynamic'
import type { CangjieEditorComponent } from './CangjieEditor'

/** Single lazy Monaco entry shared by Exercise Instances and Playground. */
export const DynamicCangjieEditor = dynamic(
  () => import('./CangjieMonacoEditor').then(module => module.CangjieMonacoEditor),
  { ssr: false },
) as CangjieEditorComponent
