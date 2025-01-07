import localFont from 'next/font/local'

export const harmonyFont = localFont({
  src: './fonts/HarmonyOS_Sans.woff2',
  preload: true,
})

export const jetbrainsFont = localFont({
  src: './fonts/JetBrainsMono.woff2',
  preload: true,
})

export const fontFamily = `${jetbrainsFont.style.fontFamily}, ${harmonyFont.style.fontFamily}, sans-serif`
