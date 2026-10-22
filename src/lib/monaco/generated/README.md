# Generated VS Code localization

`pnpm monaco:generate-nls` regenerates these files from the installed
`@codingame/monaco-vscode-language-pack-zh-hans` package. Translations originate
from Microsoft's [VS Code language packs](https://github.com/microsoft/vscode-loc)
and retain their original numeric message IDs and [upstream MIT license](./LICENSE.md).

The generator scans localization calls in every installed Monaco/VS Code
package, including deferred modules. It requires matching package versions and
rejects dynamic message indexes that cannot be covered statically. Unused slots
are null; retained strings are copied verbatim from the upstream catalog.

Do not edit the generated JSON files by hand.
