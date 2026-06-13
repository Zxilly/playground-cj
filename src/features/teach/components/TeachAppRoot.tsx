'use client'

import { useState } from 'react'
import { createWorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { TeachAppContent } from './TeachApp'

export interface TeachAppRootProps {
  lang: string
}

/**
 * Client-only entry that builds the live workspace collaborators once
 * (IndexedDB repository keyed by `lang`, Cangjie MCP knowledge source, remote
 * runner) and renders {@link TeachAppContent}. Loaded via a dynamic, SSR-disabled
 * import (see {@link TeachApp}) so its IndexedDB / runner dependencies never run
 * on the server.
 */
export default function TeachAppRoot({ lang }: TeachAppRootProps) {
  const [collaborators] = useState(() => createWorkspaceCollaborators(lang))
  return <TeachAppContent lang={lang} collaborators={collaborators} />
}
