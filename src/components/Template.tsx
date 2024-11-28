import type { Root } from 'hast'
/* eslint-disable react-refresh/only-export-components */
import QRCode from 'qrcode-svg'
import React from 'react'

interface LineNumberProps {
  n: number
  darkMode: boolean
}

function LineNumber({ n, darkMode }: LineNumberProps) {
  return (
    <span
      style={{
        width: 0.001,
        transform: 'translateX(-32px)',
        opacity: 0.3,
        color: darkMode ? '#bfbaaa' : '#4e4f47',
      }}
    >
      {n}
    </span>
  )
}

interface Node {
  type: string
  color?: string
  properties?: { style: string }
  children?: Node[]
  value?: string
}

interface Context {
  l: number
}

function getColor(style?: string) {
  return style?.split(';').find(s => s.includes('color'))?.split(':')[1] ?? '#000'
}

function transform(node: Node, color: string, context: Context, darkMode: boolean): React.ReactNode[] {
  switch (node.type) {
    case 'element':
    {
      const elColor = getColor(node.properties?.style)
      return node.children?.map(el =>
        transform(el, elColor || color || (darkMode ? '#282a36' : '#f8f8f2'), context, darkMode),
      ) ?? []
    }

    case 'text':
      return node.value?.split('\n').reduce<React.ReactNode[]>((acc, line) => {
        const chars = line.split('')
        if (!chars.length)
          chars.push('')

        return [
          ...acc,
          ...(acc.length
            ? [
                <div
                  style={{
                    width: '100%',
                    height: 1,
                    display: 'flex',
                  }}
                  key={`divider-${context.l}`}
                />,
                <LineNumber darkMode={darkMode} n={++context.l} key={`line-${context.l}`} />,
              ]
            : []),

          <span
            style={{
              color,
              display: 'flex',
              flexWrap: 'wrap',
            }}
            key={`line-content-${context.l}`}
          >
            {chars.join('')}
          </span>,
        ]
      }, []) ?? []

    default:
      if (node.children) {
        return node.children.map(el => transform(el, color, context, darkMode)) ?? []
      }
  }
  return []
}

function getSvgDataUri(url: string, dark: boolean) {
  const svg = new QRCode({
    width: 60,
    height: 60,
    content: url,
    ecl: 'M',
    pretty: false,
    padding: 1,
    background: 'transparent',
    color: dark ? '#f8f8f2' : '#282a36',
  }).svg()

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function getTemplate(code: Root, url: string, dark: boolean, layer: string, qrcode: boolean) {
  const background = dark ? '#1e1e1e' : '#f0f0f0'
  const layerFont = dark ? '#2c2c2c' : '#f8f8f2'

  return (
    <div
      style={{
        background,
        height: '100%',
        width: '100%',
        display: 'flex',
        textAlign: 'left',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        flexWrap: 'nowrap',
        fontSize: 14,
        lineHeight: 1.4,
        padding: '40px 60px',
        fontWeight: 400,
        fontFamily: 'JetBrains Mono, HarmonyOS_Sans, sans-serif',
      }}
    >
      <div
        style={{
          color: layerFont,
          background: layer,
          padding: '16px 20px',
          borderRadius: 15,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            whiteSpace: 'pre-wrap',
            display: 'flex',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              paddingLeft: 32,
              display: 'flex',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {[<LineNumber n={1} darkMode={dark} key={`l-${randomKey()}`} />].concat(
                // @ts-expect-error fix this type in the future
                transform(code, dark ? '#2c2c2c' : '#f8f8f2', { l: 1 }, dark).flat(Infinity),
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              color: dark ? '#a6a79d' : '#4e4f47',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>仓颉 Playground</h2>
            <p style={{ margin: 0 }}>{url}</p>
          </div>

          {qrcode && (
            <img
              src={getSvgDataUri(url, dark)}
              alt="QR Code"
              style={{
                width: 60,
                height: 60,
                margin: '0',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function randomKey() {
  return Math.random().toString(36).substring(7)
}
