# Web font subsets

`HarmonyOS_Sans.woff2` and `JetBrainsMono.woff2` are source fonts. Browser code
imports only files in `generated/`; the complete source fonts are not bundled.

`pnpm lingui:compile` compiles translations, and `pnpm fonts:generate` generates
the font subsets. Development and production build hooks run these tasks in
order. The generator uses Node.js and HarfBuzz WASM; it requires no Python or
native font tools.

The generator reads rendered literals from compiled Lingui catalogs, including
every plural and select branch. Each font is partitioned into a preloaded Latin
subset, locale UI subsets, and fallback subsets covering at most 512 code points
per Unicode page. CSS `unicode-range` selects the files needed by the text.
Catalog faces come after fallback pages in CSS so common UI characters use
their small subset even when a fallback page covers the same Unicode range.
Dynamic arguments, editor strings, and user code can use the fallback subsets
without downloading the complete font.

Generated files are checked in so tests and other consumers can import them
directly. Commit their changes with translation or font updates. Unchanged
subsets are reused during generation; bump the cache version in
`scripts/generate-fonts.mjs` when changing subsetter options or dependencies.
