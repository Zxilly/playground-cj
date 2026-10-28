'use client'

import dynamic from 'next/dynamic'
import { loadEditorRuntime } from '@/lib/monaco/load-editor-runtime'
import type { CangjieEditorComponent, CangjieEditorProps } from './CangjieEditor'
import { CangjieEditorLoadingState } from './CangjieEditorLoadingState'

/** Single lazy Monaco entry shared by Exercise Instances and Playground. */
const Editor = dynamic(
  () => loadEditorRuntime('en', () => import('./CangjieMonacoEditor').then(module => module.CangjieMonacoEditor)),
  { ssr: false, loading: CangjieEditorLoadingState },
) as CangjieEditorComponent

const ChineseEditor = dynamic(
  () => loadEditorRuntime('zh', () => import('./CangjieMonacoEditor').then(module => module.CangjieMonacoEditor)),
  { ssr: false, loading: CangjieEditorLoadingState },
) as CangjieEditorComponent

export function DynamicCangjieEditor(props: CangjieEditorProps) {
  const Component = props.locale === 'en' ? Editor : ChineseEditor
  return <Component {...props} />
}
