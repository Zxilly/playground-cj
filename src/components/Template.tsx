/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import type { Root } from 'hast'
import QRCode from 'qrcode-svg'

interface LineNumberProps {
  n: number
}

function LineNumber({ n }: LineNumberProps) {
  return (
    <span
      style={{
        width: 0.001,
        transform: 'translateX(-32px)',
        opacity: 0.3,
        color: '#4e4f47',
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

function transform(node: Node, color: string, context: Context): React.ReactNode[] {
  switch (node.type) {
    case 'element':
    {
      const elColor = getColor(node.properties?.style)
      return node.children?.map(el =>
        transform(el, elColor || color || '#f8f8f2', context),
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
                <LineNumber n={++context.l} key={`line-${context.l}`} />,
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
        return node.children.map(el => transform(el, color, context)) ?? []
      }
  }
  return []
}

function getSvgDataUri(url: string) {
  const svg = new QRCode({
    width: 60,
    height: 60,
    content: url,
    ecl: 'M',
    pretty: false,
    padding: 1,
  }).svg()

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function getTemplate(code: Root, url: string) {
  return (
    <div
      style={{
        background: '#f0f0f0',
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
          color: '#f8f8f2',
          background: 'white',
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
              {[<LineNumber n={1} key={`l-${randomKey()}`} />].concat(
                // @ts-expect-error fix this type in the future
                transform(code, '#f8f8f2', { l: 1 }).flat(Infinity),
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
              color: '#4e4f47',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>仓颉 Playground</h2>
            <p style={{ margin: 0 }}>{url}</p>
          </div>

          <img
            src={getSvgDataUri(url)}
            alt="QR Code"
            style={{
              width: 60,
              height: 60,
              margin: '0',
            }}
          />
        </div>
      </div>
    </div>

  )
}

function randomKey() {
  return Math.random().toString(36).substring(7)
}