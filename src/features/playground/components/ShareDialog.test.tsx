import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShareDialog from '@/features/playground/components/ShareDialog'

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function MockDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return open
    ? (
        <div role="dialog">
          <button type="button" onClick={() => onOpenChange(false)}>close</button>
          {children}
        </div>
      )
    : null
}

function MockButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} />
}

function MockDialogContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

function MockDialogHeader({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

function MockDialogTitle({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>
}

vi.mock('@/components/ui/dialog', () => ({
  Dialog: MockDialog,
  DialogContent: MockDialogContent,
  DialogHeader: MockDialogHeader,
  DialogTitle: MockDialogTitle,
}))

vi.mock('@/components/ui/button', () => ({
  Button: MockButton,
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}))

describe('shareDialog', () => {
  beforeEach(() => {
    toastError.mockClear()
    toastSuccess.mockClear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(cleanup)

  it('shows the share URL and copies it to the clipboard', async () => {
    render(
      <Wrapper>
        <ShareDialog isOpen onClose={() => {}} url="https://example.test/share" />
      </Wrapper>,
    )

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByDisplayValue('https://example.test/share')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /复制/ }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.test/share')
    })
    expect(toastSuccess).toHaveBeenCalledWith('已复制分享链接')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('shows an error toast without success when clipboard copy fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('clipboard denied'))

    render(
      <Wrapper>
        <ShareDialog isOpen onClose={() => {}} url="https://example.test/share" />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: /复制/ }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1)
    })
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('calls onClose when the dialog close control is used', () => {
    const onClose = vi.fn()

    render(
      <Wrapper>
        <ShareDialog isOpen onClose={onClose} url="https://example.test/share" />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
