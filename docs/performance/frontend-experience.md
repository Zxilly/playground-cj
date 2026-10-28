# Frontend loading and interaction improvements

Measured on 2026-10-22 against local production builds, starting from `d32e8f0`.
This follows the [Monaco startup work](./monaco-startup.md) and covers the
Playground, Tour, first-time AI Classroom entry, and returning classroom entry.
The changes were subsequently committed on top of upstream `0746eb2`, which
includes the WASM compiler serialization fix. The measurements below predate
that synchronization and retain the original baseline and optimized samples.

## Changes

- Tour renders its lesson and navigation independently of Monaco. Chinese
  localization still loads before the editor runtime. A code preview and a
  localized status fill the editor panel while it loads. AI settings and the
  raw Markdown fallback are loaded only when needed.
- The Tour page sends compiled lessons and code for the selected locale, with
  the existing Chinese fallback. It omits duplicate raw Markdown when compiled
  MDX is available. All lessons remain available for immediate navigation.
  Concurrent cold requests for page metadata and content share course compilation;
  a failed compilation can be retried.
- AI Classroom loads its introduction first, its configuration wizard on Start,
  and the curriculum, local workspace, and teaching runtime on entry. Returning
  learners enter the workspace directly. Review, Progress, and Playground views
  have separate loading boundaries; the initial Live view stays in the workspace
  bundle. Local storage, runtime cleanup, error recovery, and persisted progress
  keep their existing ownership.
- Retained AI Markdown is memoized, downloads the Cangjie highlighter only for
  code fences, and keeps plain code readable if highlighting fails. Wide tables
  scroll inside their container and are keyboard accessible.
- Shared editors coalesce resize notifications into one layout per animation
  frame, skip unchanged dimensions, and observe status-bar size changes.
  Selecting a Playground example now edits the active model and preserves undo.
- Tour Back/Forward updates both the lesson and its code. Navigation no longer
  pushes duplicate history entries in Strict Mode or takes PageUp/PageDown from
  focused editors and inputs. New lessons reset their reading scroll; the mobile
  contents drawer closes after selection and reveals the current branch.
  The header, editor toolbar, and viewport height adapt to narrow screens.
  Lesson guide highlights wait for lazily mounted buttons and then stop observing.

## Measurement

```sh
pnpm build
pnpm exec next start -p 3300
# In another terminal; defaults to three samples per surface/locale/viewport:
node scripts/measure-frontend-load.mjs http://127.0.0.1:3300 .scratch/frontend-after/results.json
```

The harness uses Chromium, a fresh context with cache disabled, 40 ms latency,
10 Mbps download/upload, 4x CPU throttling, and 1440x900 / 390x900 viewports.
It measures both Chinese and English. The narrow viewport is a desktop-browser
simulation, not a physical mobile-device measurement.

`content` is the first DOM observation of an editor line (Playground), the
lesson body (Tour), the introduction, or the classroom shell. It is not a full
application readiness or language-server metric. LCP and CLS are observed until
two seconds after content and fonts are ready. Completed page JavaScript bytes
before that content milestone exclude workers and incomplete requests. Document
bytes include the HTML and serialized React payload. The AI workspace sample
has a fresh store with onboarding marked complete; it does not generate an AI
response or restore a large existing conversation.

The baseline contains three samples per cell (48 total); the optimized run
contains two (32 total). Some baseline samples overlapped local validation
processes, and the optimized run also showed substantial timing variation.
All samples are retained. Timings include host-load noise and do not establish
an isolated production speedup. Payload reductions provide independent
evidence of the loading changes. The first Tour baseline request also includes
cold server course compilation; subsequent requests reuse the cached course.

The [measurement record](./frontend-experience-2026-10-22.json) retains every
sample and the intermediate run. Sizes below use decimal kB (1,000 bytes).
Payload values are medians across both viewport sizes. They describe the
content milestone, not the eventual total download or the minimum dependency
set: optional editor chunks can finish early and increase the observed value.

| Surface | Locale | JS before content, before → after (kB) | Change | Document, before → after (kB) |
| --- | --- | ---: | ---: | ---: |
| Playground | zh | 2580.2 → 2579.6 | -0.0% | 12.3 → 12.3 |
| Playground | en | 2424.6 → 2424.0 | -0.0% | 11.6 → 11.6 |
| Tour | zh | 2544.8 → 226.7 | -91.1% | 468.8 → 186.7 |
| Tour | en | 2389.2 → 384.7 | -83.9% | 468.6 → 183.7 |
| AI introduction | zh | 908.5 → 161.0 | -82.3% | 8.7 → 8.4 |
| AI introduction | en | 908.5 → 161.0 | -82.3% | 8.2 → 7.9 |
| AI workspace | zh | 908.5 → 833.2 | -8.3% | 8.7 → 8.4 |
| AI workspace | en | 908.5 → 833.2 | -8.3% | 8.2 → 7.9 |

Content timings are medians for each locale/viewport. The two optimized
samples per cell are too few for stable tail-latency estimates. Playground
startup was slower in this run while its downloaded code size was essentially
unchanged; this work does not claim a Playground startup speedup. Its changes
target resize work and example-selection behavior. The host was not isolated,
so timing changes cannot be attributed to application changes alone. Returning
AI workspace entry also took longer despite downloading less code; its entry
time improvement is not established by these measurements.

| Surface | Locale | Width | Content before (s) | Content after (s) | After range (s) |
| --- | --- | ---: | ---: | ---: | ---: |
| Playground | zh | 1440 | 5.23 | 16.87 | 15.06–18.68 |
| Playground | zh | 390 | 5.57 | 6.28 | 5.95–6.61 |
| Playground | en | 1440 | 5.59 | 6.48 | 6.36–6.59 |
| Playground | en | 390 | 6.79 | 7.41 | 6.59–8.23 |
| Tour | zh | 1440 | 7.13 | 2.03 | 1.92–2.13 |
| Tour | zh | 390 | 6.74 | 1.90 | 1.90–1.91 |
| Tour | en | 1440 | 5.06 | 2.25 | 2.11–2.39 |
| Tour | en | 390 | 4.99 | 2.26 | 2.01–2.51 |
| AI introduction | zh | 1440 | 2.23 | 1.46 | 1.45–1.47 |
| AI introduction | zh | 390 | 2.11 | 1.47 | 1.35–1.58 |
| AI introduction | en | 1440 | 2.12 | 1.21 | 1.15–1.26 |
| AI introduction | en | 390 | 2.01 | 1.13 | 1.12–1.13 |
| AI workspace | zh | 1440 | 2.39 | 3.72 | 3.20–4.25 |
| AI workspace | zh | 390 | 2.36 | 4.07 | 3.96–4.17 |
| AI workspace | en | 1440 | 2.62 | 4.54 | 4.35–4.73 |
| AI workspace | en | 390 | 2.28 | 4.21 | 3.96–4.46 |

All 32 optimized samples had no page errors or horizontal document overflow.
Maximum observed CLS was 0.0019 within the measurement window.
The later Tour highlight retry only changes the one-time guide effect; it was
validated separately and is not included in these measured byte counts.

## Validation

- Production build, TypeScript checks, and ESLint for changed application/test
  files passed. The interface detector reported no findings in changed TSX.
- All 971 unit/component tests passed. Coverage includes locale projection and
  fallback, shared/retryable course loading, deferred onboarding, runtime
  teardown, navigation history, sidebar behavior, example replacement, and
  resize scheduling.
- After that full run, the Tour guide correction passed all four focused
  component cases, including three new cases for late targets and cleanup.
  The final production build and both Tour end-to-end cases also passed again.
- All 11 production browser end-to-end cases passed, including both locales,
  shared source, example replacement with undo and exact submitted source,
  completion/diagnostics/formatting/Chinese menus, language-client restart,
  Tour Back/Forward and mobile navigation, first-time AI entry, and the full
  classroom evidence/review/persistence path. AI and code-execution responses
  in these interaction tests are mocked; language services run in the browser.
- The two shared Monaco browser lifecycle cases passed, including multiple
  editors and file-service model synchronization.
- Chinese mobile Tour, English desktop dark Tour, Chinese dark AI introduction,
  and English mobile dark AI editor were visually checked. All four checks had
  no page errors or horizontal document overflow.

Use the production server for the end-to-end suite:

```powershell
$env:PLAYGROUND_TEST_URL = 'http://127.0.0.1:3300'
pnpm exec vitest run --project e2e
```
