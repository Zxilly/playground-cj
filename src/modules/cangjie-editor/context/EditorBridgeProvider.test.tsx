import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useReducer } from 'react'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { useEditorBridge } from '@/modules/cangjie-editor/context/useEditorBridge'

function Consumer() {
  const { editor, lang } = useEditorBridge()
  const [, rerender] = useReducer((value: number, _action?: void) => value + 1, 0)

  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="editor">{editor.getEditor() ? 'set' : 'empty'}</span>
      <button
        type="button"
        onClick={() => {
          editor.setEditor({ id: 'editor' } as never)
          rerender()
        }}
      >
        set editor
      </button>
    </div>
  )
}

describe('editorBridgeProvider', () => {
  afterEach(cleanup)

  it('provides lang and a stable imperative editor bridge to descendants', () => {
    render(
      <EditorBridgeProvider lang="zh">
        <Consumer />
      </EditorBridgeProvider>,
    )

    expect(screen.getByTestId('lang').textContent).toBe('zh')
    expect(screen.getByTestId('editor').textContent).toBe('empty')

    fireEvent.click(screen.getByRole('button', { name: 'set editor' }))
    expect(screen.getByTestId('editor').textContent).toBe('set')
  })

  it('throws when the bridge hook is used outside its provider', () => {
    expect(() => render(<Consumer />)).toThrow('useEditorBridge must be used within <EditorBridgeProvider>')
  })
})
