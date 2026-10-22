import localFont from 'next/font/local'
import './fonts/generated/fonts.css'

const harmonyUiFont = localFont({
  src: './fonts/generated/harmony-latin.woff2',
  preload: true,
  display: 'swap',
  // Missing characters must reach the generated Unicode subsets below.
  adjustFontFallback: false,
})

const jetbrainsFont = localFont({
  src: './fonts/generated/jetbrains-latin.woff2',
  preload: true,
  display: 'swap',
  adjustFontFallback: false,
})

/** Interface copy: prefer the proportional HarmonyOS face for long-form text. */
export const uiFontFamily = `${harmonyUiFont.style.fontFamily}, 'HarmonyOS Sans Web', sans-serif`

/** Code/editor copy: keep JetBrains Mono as the first choice. */
export const fontFamily = `${jetbrainsFont.style.fontFamily}, 'JetBrains Mono Extras', ${uiFontFamily}`
