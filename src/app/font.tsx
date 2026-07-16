import localFont from 'next/font/local'

export const harmonyFont = localFont({
  src: './fonts/HarmonyOS_Sans.woff2',
  preload: true,
})

export const jetbrainsFont = localFont({
  src: './fonts/JetBrainsMono.woff2',
  preload: true,
})

/** Interface copy: prefer the proportional HarmonyOS face for long-form text. */
export const uiFontFamily = `${harmonyFont.style.fontFamily}, sans-serif`

/** Code/editor copy: keep JetBrains Mono as the first choice. */
export const fontFamily = `${jetbrainsFont.style.fontFamily}, ${harmonyFont.style.fontFamily}, sans-serif`
