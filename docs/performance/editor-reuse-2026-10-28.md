# Shared editor runtime and responsive UI baseline

This baseline was measured on 2026-10-28 using a local production build of the
shared editor runtime and responsive Playground/Tour changes. It records the
current state; no paired before/after speed comparison was measured.

## Method

`scripts/measure-editor-startup.mjs` collected three fresh browser contexts per
locale against `next start`. Conditions: 1440 × 900, disabled browser cache,
40 ms network latency, 10 Mbps throughput and 4× CPU throttling. Each sample
typed into the real Monaco editor and then waited for a real Cangjie WASM
diagnostic. Server/process caches and host activity were not controlled.
The [sample summary](./editor-reuse-2026-10-28.json) records browser version,
working-tree provenance, payload sizes and all six samples.

## Results

Median seconds from navigation:

| Locale | Code visible | First edit verified | Assistance ready observed | First diagnostic observed |
| --- | ---: | ---: | ---: | ---: |
| English | 8.50 | 9.74 | 31.05 | 34.13 |
| Chinese | 6.99 | 8.04 | 29.41 | 32.68 |

First-edit and assistance observations include automation overhead. Locale
ordering and the small sample count prevent treating the difference between
languages as a language-specific performance result. All six samples had no
page errors.

JavaScript completed by the time code became visible was 2,759,576 encoded
bytes for English and 2,924,003 bytes for Chinese. The corresponding decoded
sizes were 10,435,979 and 11,059,196 bytes. The VS Code service graph therefore
remains a meaningful loading cost. This change retains native toolbar, output,
status bar, formatting and language features; it does not claim a reduction in
that service graph.

Across all production routes, 21 CSS chunks totalled 674,784 bytes, or 95,199
bytes when each chunk was compressed with Node's default gzip settings. The
Playground sample loaded 669,484 decoded CSS bytes / 93,517 encoded bytes.
These totals include VS Code styles, not just the application's utility CSS.
Parsing the output stylesheets found exactly one unscoped `.hidden` rule.
Route-specific Tour and Teach styles no longer regenerate the shared Tailwind
utilities that previously overrode desktop visibility classes.

## Verification scope

The production E2E suite covers SSR in both locales, the desktop contents menu,
mobile code/output switching without remounting, example undo, native output
channels and clear controls, compact landscape layouts, real WASM diagnostics
and formatting, and the classroom evidence/review/persistence workflow.
Runner and AI responses in the E2E suite are controlled fixtures. Native
formatting undo/redo also has a Chromium browser regression test.

A separate local runner smoke request returned `runner_admission_unavailable`
(HTTP 503). The existing origin guard rejected a direct browser request to the
loopback preview. Successful remote runner execution and a real AI provider
session remain unverified. The UI displayed the failure and ended its running
state.

The frontend CI now builds the production application before running this
same E2E suite with `PLAYGROUND_TEST_MODE=production`. Development-mode tests
remain available when that environment variable is absent.
