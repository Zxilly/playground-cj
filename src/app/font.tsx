import localFont from 'next/font/local'

export const harmonyFont = localFont({
  src: './fonts/HarmonyOS_Sans.ttf',
  preload: false,
})

export const jetbrainsFont = localFont({
  src: './fonts/JetBrainsMono.ttf',
  preload: false,
})

export const fontFamily = `${jetbrainsFont.style.fontFamily}, ${harmonyFont.style.fontFamily}, sans-serif`
