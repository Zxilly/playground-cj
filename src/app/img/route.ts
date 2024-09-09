import { readFileSync } from 'node:fs'
import { getTemplate } from '@/components/Template'
import { getHighlighter } from '@/lib/shiki'
import { NextResponse } from 'next/server'
import satori from 'satori'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const data = await req.json()
  const code = data.code
  const shareUrl = data.shareUrl
  const dark = data.dark

  const highlighter = await getHighlighter(dark)
  if (!highlighter || !code || !shareUrl) {
    return new Response('Bad Request', {
      status: 400,
      statusText: 'Bad Request',
    })
  }

  const hastTree = highlighter.codeToHast(code, {
    lang: 'cangjie',
    theme: dark ? 'vitesse-dark' : 'vitesse-light',
  })

  const fontMono = readFileSync(`${process.cwd()}/src/app/fonts/JetBrainsMono.ttf`)
  const fontMonoBold = readFileSync(`${process.cwd()}/src/app/fonts/JetBrainsMono_Bold.ttf`)
  const fontHarmony = readFileSync(`${process.cwd()}/src/app/fonts/HarmonyOS_Sans.ttf`)
  const fontHarmonyBold = readFileSync(`${process.cwd()}/src/app/fonts/HarmonyOS_Sans_Bold.ttf`)

  const theme = highlighter.getTheme(dark ? 'vitesse-dark' : 'vitesse-light')

  const tmpl = getTemplate(hastTree, shareUrl, dark, theme.bg)

  const svg = await satori(tmpl, {
    width: 800,
    fonts: [
      {
        name: 'HarmonyOS_Sans',
        data: fontHarmony,
        weight: 400,
      },
      {
        name: 'JetBrains Mono',
        data: fontMono,
        weight: 400,
      },
      {
        name: 'HarmonyOS_Sans',
        data: fontHarmonyBold,
        weight: 700,
      },
      {
        name: 'JetBrains Mono',
        data: fontMonoBold,
        weight: 700,
      },
    ],
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
    },
  })
}
