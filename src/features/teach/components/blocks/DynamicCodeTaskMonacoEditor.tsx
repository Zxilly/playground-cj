'use client'

import dynamic from 'next/dynamic'
import type { CodeTaskEditorComponent } from './CodeTaskBlock'

/**
 * Single lazy Monaco entry shared by lesson code_task blocks and Playground.
 * Keeping one dynamic boundary avoids duplicate editor/LSP bundles.
 */
export const DynamicCodeTaskMonacoEditor = dynamic(
  () => import('./CodeTaskMonacoEditor').then(module => module.CodeTaskMonacoEditor),
  { ssr: false },
) as CodeTaskEditorComponent
