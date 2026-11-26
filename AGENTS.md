<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository Overview

`playground-cj` is a Next.js 16 + React 19 web application (Node `>= 24`, `pnpm@12.14.0`) hosting three user-facing surfaces plus remote execution services:

- **Playground** (`src/app/[lang]/`, `src/features/playground/`, `src/examples/`, `src/const.ts`): interactive Cangjie editor, sample catalog, WASM LSP/formatter, sharing, and execution output.
- **Tour of Cangjie** (`tour/`, `src/tour/`, `src/features/tour/`, `src/app/[lang]/tour/`): bilingual (`zh` / `en`) interactive MDX curriculum.
- **AI Classroom** (`src/lib/ai/concept-graph/`, `src/lib/teach/`, `src/features/teach/`): concept-graph-driven adaptive classroom backed by generated bilingual content packs (`src/lib/teach/classroom/generated/content-packs/{en,zh}.json`).
- **Routing & Proxy** (`src/proxy.ts`): multi-domain routing (`playground.*` / `tour.*` / `play.cj.zxilly.com`), locale negotiation, and 301 legacy tour step redirects.
- **Execution Runner** (`cj-runner/` in Go, `modal/` in Python): sandboxed Cangjie compiler/runner locked by `cj-runner/cangjie-toolchain.lock.json`.

## Tour & Content Authoring Rules

1. **Unique numeric prefixes**: Every sibling directory under `tour/`, `tour/<chapter>/`, and `tour/<chapter>/<subchapter>/` MUST have a unique numeric prefix (`01-`, `02-`, ..., `01`, `02`, ...). `src/tour/loader.ts` and `src/tour/content-guardrails.test.ts` fail closed on collisions.
2. **Comparison language whitelist**: `<CompareWith lang="...">` blocks in `tour/**/*.mdx` MUST only use languages registered in `ALL_LANGUAGES` (`src/stores/knownLanguages.ts`: `'c'`, `'java'`, `'go'`, `'rust'`).
3. **No brittle hardcoded line numbers**: Do not instruct learners using `"第 N 行"` / `"line N"` in `tour/**/*.mdx`; reference code identifiers or statements semantically instead.
4. **Distinct subchapter names**: When a chapter has multiple subchapters, do not give any subchapter a `name.json` identical to its parent chapter's `zh` or `en` name.
5. **Concept graph & content pack sync**: Whenever `tour/` paths or `src/lib/ai/concept-graph/concept-graph.json` change, update all `chapterRefs` and `sourceRefs`, add 301 redirects in `src/proxy.ts` for any removed out-of-range public step URLs, and run `pnpm content-packs:generate` to keep `src/lib/teach/classroom/generated/content-packs/{en,zh}.json` in sync.
6. **Bilingual parity**: Keep `index.zh.mdx` / `index.en.mdx` and `src/examples/*.cj` / `*.en.cj` aligned in technical accuracy, feature comments, and localized output strings.

## State, i18n, and Code Style Rules

- **Zustand selectors**: `eslint-plugin-granular-selectors` enforces atomic selectors (`useStore(s => s.field)`). Do not return fresh objects from store selectors or introduce `useShallow`.
- **Lingui i18n**: User-visible UI copy should use Lingui macros (`<Trans>`, `t`, `msg`) with `zh` as `sourceLocale` so `pnpm lingui:extract`, `pnpm lingui:compile`, and `pnpm fonts:generate` keep `harmony-ui-zh.woff2` accurate.
- **WASM assets**: Run `pnpm prep` before local `next dev` / `next build` if `public/lsp/` is missing.

## Verification Checklist

Run these checks before committing changes:

```bash
pnpm content-packs:generate # whenever tour/, concept-graph, or content-pack-builder changed
pnpm run lint
pnpm exec tsc --noEmit --incremental false
pnpm exec vitest run --project unit --project component
```

When verifying Cangjie snippets and generated content packs locally with `cjc` installed:

```bash
pnpm content-packs:verify
```

Linux CI strictly enforces the locked Linux x64 `cjc` SHA-256 and target triple; non-Linux local hosts skip the Linux-only SHA-256 lock check while still compiling and executing every exercise and runnable code sample with local `cjc` (set `CONTENT_PACKS_STRICT_TOOLCHAIN=1` to force strict enforcement).
