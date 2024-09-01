/* eslint-disable node/prefer-global/process */
import { readFileSync } from 'node:fs'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { getHighlighter } from '@/lib/shiki'
import { getCodeSnippet } from '@/components/PictureTemplate'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const shareUrl = req.nextUrl.searchParams.get('shareUrl')

  const highlighter = await getHighlighter()
  if (!highlighter || !code || !shareUrl) {
    return new Response('Bad Request', {
      status: 400,
      statusText: 'Bad Request',
    })
  }
  const hast = highlighter.codeToHast(code, {
    lang: 'cangjie',
    theme: 'vitesse-light',
  })

  const node = toJsxRuntime(hast, {
    Fragment,
    // @ts-expect-error jsx and jsxs are typed
    jsx,
    // @ts-expect-error jsx and jsxs are typed
    jsxs,
  })

  const fontMono = readFileSync(`${process.cwd()}/src/app/fonts/JetBrainsMono.ttf`)
  const fontHarmony = readFileSync(`${process.cwd()}/src/app/fonts/HarmonyOS_Sans.ttf`)

  const tmpl = getCodeSnippet(node, shareUrl)

  // const svg = await satori(tmpl, {
  //   width: 800,
  //   fonts: [
  //     {
  //       name: 'HarmonyOS_Sans',
  //       data: fontHarmony,
  //     },
  //     {
  //       name: 'JetBrains Mono',
  //       data: fontMono,
  //     },
  //   ],
  // })
  const svg = ''

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
    },
  })
}
