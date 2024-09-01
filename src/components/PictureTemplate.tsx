import { QRCodeSVG } from 'qrcode.react'
import type { ReactNode } from 'react'

interface CodeSnippetProps {
  code: ReactNode
  url: string
}

// eslint-disable-next-line react-refresh/only-export-components
function CodeSnippet({ code, url }: CodeSnippetProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        padding: '40px',
        fontFamily: 'HarmonyOS_Sans, JetBrains Mono, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            overflow: 'hidden',
          }}
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            {code}
          </pre>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, marginRight: '20px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>仓颉 Playground</h2>
            <p style={{ margin: 0, fontSize: '14px', wordBreak: 'break-all' }}>
              {url}
            </p>
          </div>
          <QRCodeSVG
            value={url}
            size={100}
            level="L"
            style={{
              width: '100px',
              height: '100px',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function getCodeSnippet(code: ReactNode, url: string) {
  return <CodeSnippet code={code} url={url} />
}
