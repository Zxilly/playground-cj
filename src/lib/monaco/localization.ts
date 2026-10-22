import { registerLocalization } from '@codingame/monaco-vscode-api/l10n'
import messages from './generated/zh-cn-messages.json'
import localization from './generated/zh-cn-localization.json'

// Generated from every installed Monaco/VS Code package, including lazy modules.
// Sparse entries keep their original IDs and VS Code's upstream fallback rules.
// This module must finish before any editor or service module is evaluated.
registerLocalization(
  localization.manifest,
  'zh-cn',
  messages as string[],
  localization.extensionTranslations,
)
