/* eslint-disable node/prefer-global/process */
import { readFileSync } from 'node:fs'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import satori from 'satori'
import { getHighlighter } from '@/lib/shiki'
import { getTemplate } from '@/components/Template'

export async function POST(req: NextRequest) {
  const data = await req.json()
  const code = data.code
  const shareUrl = data.shareUrl

  const highlighter = await getHighlighter()
  if (!highlighter || !code || !shareUrl) {
    return new Response('Bad Request', {
      status: 400,
      statusText: 'Bad Request',
    })
  }

  const hastTree = highlighter.codeToHast(code, {
    lang: 'cangjie',
    theme: 'vitesse-light',
  })

  const fontMono = readFileSync(`${process.cwd()}/src/app/fonts/JetBrainsMono.ttf`)
  const fontHarmony = readFileSync(`${process.cwd()}/src/app/fonts/HarmonyOS_Sans.ttf`)

  const tmpl = getTemplate(hastTree, shareUrl)

  const svg = await satori(tmpl, {
    width: 800,
    fonts: [
      {
        name: 'HarmonyOS_Sans',
        data: fontHarmony,
      },
      {
        name: 'JetBrains Mono',
        data: fontMono,
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
