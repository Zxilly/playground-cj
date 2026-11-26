import { registerLocalization } from '@codingame/monaco-vscode-api/l10n'
import messagesPayload from './generated/zh-cn-messages.json'
import localization from './generated/zh-cn-localization.json'

interface SparseNlsPayload {
  length: number
  entries: Record<string, string>
}

function expandSparseNlsMessages(payload: SparseNlsPayload | (string | null)[]): string[] {
  if (Array.isArray(payload))
    return payload as string[]
  const expanded = Array.from({ length: payload.length }) as string[]
  for (const [index, value] of Object.entries(payload.entries))
    expanded[Number(index)] = value
  return expanded
}

// Generated from the reachable Monaco/VS Code ESM graph.
// Sparse entries keep their original IDs and VS Code's upstream fallback rules.
// This module must finish before any editor or service module is evaluated.
registerLocalization(
  localization.manifest,
  'zh-cn',
  expandSparseNlsMessages(messagesPayload as SparseNlsPayload | (string | null)[]),
  localization.extensionTranslations,
)
