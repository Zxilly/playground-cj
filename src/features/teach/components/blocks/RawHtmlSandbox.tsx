'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RawHtmlBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { BlockComponentProps } from './block-props'

/** Hard ceiling matching the schema's `height` max, used to clamp child-reported heights. */
const MAX_HEIGHT_PX = 1200
const DEFAULT_HEIGHT_PX = 320

/**
 * Content-Security-Policy injected into the sandbox document. The frame already
 * runs without `allow-same-origin` (so it has an opaque, null origin and cannot
 * touch app cookies/storage), and the CSP further forbids reaching out to the
 * network or loading external sub-resources. `'unsafe-inline'` for scripts/styles
 * is required because the model's html is delivered inline via `srcDoc`.
 */
const SANDBOX_CSP = [
  'default-src \'none\'',
  'script-src \'unsafe-inline\'',
  'style-src \'unsafe-inline\'',
  'img-src data:',
  'connect-src \'none\'',
  'form-action \'none\'',
  'base-uri \'none\'',
].join('; ')

/**
 * The postMessage bridge the sandbox child may use. Exactly two message types
 * are honoured (child → parent); everything else is ignored. The bridge script
 * is injected into the document head so block authors can call
 * `parent.postMessage({ type: 'teach:run', code })` / `'teach:height'`.
 */
const BRIDGE_SCRIPT = `
(function () {
  function post(message) {
    try { parent.postMessage(message, '*'); } catch (_e) {}
  }
  window.teach = {
    run: function (code) { post({ type: 'teach:run', code: String(code == null ? '' : code) }); },
    reportHeight: function (px) { post({ type: 'teach:height', px: Number(px) || 0 }); },
  };
  // Auto-report height once the document settles so the frame fits its content.
  window.addEventListener('load', function () {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    if (h) window.teach.reportHeight(h);
  });
})();
`

function buildSrcDoc(html: string): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<script>${BRIDGE_SCRIPT}</script>`,
    '</head>',
    '<body>',
    html,
    '</body>',
    '</html>',
  ].join('')
}

interface SandboxRunMessage {
  type: 'teach:run'
  code?: unknown
}

interface SandboxHeightMessage {
  type: 'teach:height'
  px?: unknown
}

type SandboxMessage = SandboxRunMessage | SandboxHeightMessage

/** Whitelist guard: only `teach:run` / `teach:height` shapes are accepted. */
function isSandboxMessage(data: unknown): data is SandboxMessage {
  if (typeof data !== 'object' || data === null)
    return false
  const type = (data as { type?: unknown }).type
  return type === 'teach:run' || type === 'teach:height'
}

interface RawHtmlSandboxProps extends BlockComponentProps<RawHtmlBlockSchemaType> {
  /**
   * Receives Cangjie code the sandbox child wants to run (via a `teach:run`
   * bridge message). The renderer wires this to the shared runner; tests inject
   * a fake. When omitted, `teach:run` messages are accepted but no-op.
   */
  onRun?: (code: string) => void
}

/**
 * Fallback block: render model-authored HTML inside a strictly sandboxed iframe.
 * Used only when the structured block library cannot express an interactive
 * widget. Security posture:
 *  - `sandbox="allow-scripts"` WITHOUT `allow-same-origin` — the frame runs with
 *    a null origin, so it cannot read app cookies, storage, or same-origin DOM.
 *  - A tight CSP `<meta>` blocks network egress and external sub-resources.
 *  - A whitelisted postMessage bridge accepts only `teach:run` (forward code to
 *    the runner) and `teach:height` (resize); messages from any other source or
 *    of any other type are ignored.
 */
export function RawHtmlSandbox({ block, onRun }: RawHtmlSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState<number>(block.height ?? DEFAULT_HEIGHT_PX)

  const srcDoc = useMemo(() => buildSrcDoc(block.html), [block.html])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Source guard: only trust messages from THIS sandbox's contentWindow.
      const frame = iframeRef.current
      if (!frame || event.source !== frame.contentWindow)
        return
      if (!isSandboxMessage(event.data))
        return

      if (event.data.type === 'teach:run') {
        const code = event.data.code
        onRun?.(typeof code === 'string' ? code : '')
        return
      }
      // teach:height
      const px = Number((event.data as SandboxHeightMessage).px)
      if (Number.isFinite(px) && px > 0)
        setHeight(Math.min(Math.round(px), MAX_HEIGHT_PX))
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onRun])

  return (
    <iframe
      ref={iframeRef}
      data-testid="raw-html-sandbox"
      title="lesson interactive widget"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ height: `${height}px` }}
      className="w-full rounded-md border border-border/60 bg-background"
    />
  )
}
