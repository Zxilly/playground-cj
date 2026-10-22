import localFont from 'next/font/local'

export const harmonyFont = localFont({
  src: './fonts/HarmonyOS_Sans.woff2',
  // Only download the full CJK face when text needs a glyph outside the UI subset.
  preload: false,
  display: 'swap',
  adjustFontFallback: false,
})

const harmonyUiFont = localFont({
  src: './fonts/HarmonyOS_Sans_UI.woff2',
  preload: true,
  display: 'swap',
  // An inserted Arial fallback would prevent missing glyphs from reaching the
  // full HarmonyOS face in the family list below.
  adjustFontFallback: false,
})

export const jetbrainsFont = localFont({
  src: './fonts/JetBrainsMono.woff2',
  preload: true,
})

/** Interface copy: prefer the proportional HarmonyOS face for long-form text. */
export const uiFontFamily = `${harmonyUiFont.style.fontFamily}, ${harmonyFont.style.fontFamily}, sans-serif`

/** Code/editor copy: keep JetBrains Mono as the first choice. */
export const fontFamily = `${jetbrainsFont.style.fontFamily}, ${uiFontFamily}`
