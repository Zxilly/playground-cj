import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ClassroomPersistenceBanner } from './ClassroomPersistenceBanner'
import { messages as enMessages } from '@/locales/en/messages.mjs'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function EnWrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  globalI18n.load({ en: enMessages })
  globalI18n.activate('en')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

describe('classroomPersistenceBanner', () => {
  afterEach(() => {
    cleanup()
  })

  it('stays hidden when persistence is healthy', () => {
    const { queryByTestId } = render(<ClassroomPersistenceBanner issue={null} />, { wrapper: Wrapper })

    expect(queryByTestId('classroom-persistence-banner')).toBeNull()
  })

  it('explains timeout recovery without blocking the classroom', () => {
    render(<ClassroomPersistenceBanner issue="timeout" />, { wrapper: Wrapper })

    const banner = screen.getByRole('region', { name: '学习记录加载时间过长，已先开启临时课堂。' })
    expect(banner).toBe(screen.getByTestId('classroom-persistence-banner'))
    expect(banner.getAttribute('aria-labelledby')).toBeTruthy()
    expect(banner.getAttribute('aria-describedby')).toBeTruthy()
    expect(banner.className).toContain('min-w-0')

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.className).toContain('min-w-0')
    expect(status.className).toContain('flex-1')
    const titleId = banner.getAttribute('aria-labelledby')
    const describedIds = banner.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
    expect(document.getElementById(titleId!)?.className).toContain('break-words')
    for (const id of describedIds)
      expect(document.getElementById(id)?.className).toContain('break-words')
    expect(status.textContent).toContain('学习记录加载时间过长，已先开启临时课堂。')
    expect(status.textContent).toContain('你可以继续学习；如果想恢复上次记录，请刷新后重试。')
    expect(status.textContent).toContain('临时课堂会在你继续学习后覆盖当前页面状态；如果需要找回旧记录，请先重新加载记录。')

    const action = screen.getByRole('button', { name: '重新加载记录' })
    expect(action.className).toContain('w-full')
    expect(action.className).toContain('max-w-full')
    expect(action.className).toContain('text-left')
    expect(action.className).toContain('sm:w-auto')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(action.querySelector('span')?.className).toContain('break-words')
    expect(action.getAttribute('aria-describedby')).toBe(banner.getAttribute('aria-describedby'))
    expect(describedByText(action)).toContain('你可以继续学习；如果想恢复上次记录，请刷新后重试。')
    expect(describedByText(action)).toContain('临时课堂会在你继续学习后覆盖当前页面状态')
    expect(action.getAttribute('title')).toContain('点击会重新加载页面，尝试读取上次学习记录。')
    expect(action.getAttribute('title')).toContain('临时课堂会在你继续学习后覆盖当前页面状态')
  })

  it('explains failed hydration recovery', () => {
    render(<ClassroomPersistenceBanner issue="failed" />, { wrapper: Wrapper })

    expect(screen.getByRole('region', { name: '无法加载本地学习记录，已先开启临时课堂。' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('无法加载本地学习记录，已先开启临时课堂。')
    expect(screen.getByTestId('classroom-persistence-risk').textContent).toContain('如果需要找回旧记录，请先重新加载记录。')
  })

  it('uses compiled English copy for hydration timeout recovery', () => {
    render(<ClassroomPersistenceBanner issue="timeout" />, { wrapper: EnWrapper })

    const banner = screen.getByRole('region', {
      name: 'Learning records are taking too long to load, so a temporary classroom has opened.',
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Learning records are taking too long to load, so a temporary classroom has opened.')
    expect(status.textContent).toContain('You can keep learning. To restore your previous record, refresh and try again.')
    expect(status.textContent).toContain('The temporary classroom will overwrite the current page state after you continue learning.')
    expect(status.textContent).toContain('Reload records first if you need to recover the old record.')
    expect(screen.queryByText('学习记录加载时间过长，已先开启临时课堂。')).toBeNull()

    const action = screen.getByRole('button', { name: 'Reload records' })
    expect(action.getAttribute('aria-describedby')).toBe(banner.getAttribute('aria-describedby'))
    expect(describedByText(action)).toContain('To restore your previous record, refresh and try again.')
    expect(describedByText(action)).toContain('Reload records first if you need to recover the old record.')
    expect(action.getAttribute('title')).toContain('Click to reload the page and try reading the previous learning record.')
  })

  it('uses compiled English copy for failed hydration recovery', () => {
    render(<ClassroomPersistenceBanner issue="failed" />, { wrapper: EnWrapper })

    const banner = screen.getByRole('region', {
      name: 'Local learning records could not be loaded, so a temporary classroom has opened.',
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Local learning records could not be loaded, so a temporary classroom has opened.')
    expect(status.textContent).toContain('You can keep learning. To restore your previous record, refresh and try again.')
    expect(status.textContent).toContain('The temporary classroom will overwrite the current page state after you continue learning.')
    expect(screen.queryByText('无法加载本地学习记录，已先开启临时课堂。')).toBeNull()

    const action = screen.getByRole('button', { name: 'Reload records' })
    expect(action.getAttribute('aria-describedby')).toBe(banner.getAttribute('aria-describedby'))
    expect(describedByText(action)).toContain('Reload records first if you need to recover the old record.')
    expect(action.getAttribute('title')).toContain('Click to reload the page and try reading the previous learning record.')
  })

  it('explains save failure recovery and confirms the retry while saving', async () => {
    const retry = createDeferred()
    const onRetrySave = vi.fn(() => retry.promise)
    render(<ClassroomPersistenceBanner issue={null} saveIssue="failed" onRetrySave={onRetrySave} />, { wrapper: Wrapper })

    expect(screen.getByRole('region', { name: '当前学习进度暂时无法保存。' })).toBeTruthy()
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('当前学习进度暂时无法保存。')
    expect(status.textContent).toContain('你可以继续学习；刷新或关闭页面前，请先重新尝试保存。')

    const action = screen.getByRole('button', { name: '重新尝试保存' })
    expect(describedByText(action)).toContain('你可以继续学习；刷新或关闭页面前，请先重新尝试保存。')
    expect(describedByText(action)).toContain('本次课堂内容、练习结果和复习笔记可能不会出现在下次打开时')
    expect(describedByText(action)).toContain('代码草稿仍会尽量保留在本机。')
    expect(action.getAttribute('title')).toContain('点击会重新尝试保存当前课堂；不会清除已生成内容、练习结果或复习笔记。')
    expect(action.getAttribute('title')).toContain('代码草稿仍会尽量保留在本机。')
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    expect(action.querySelector('span')?.className).toContain('break-words')

    fireEvent.click(action)

    expect(onRetrySave).toHaveBeenCalledTimes(1)
    const retryingAction = screen.getByRole('button', { name: '正在保存...' }) as HTMLButtonElement
    expect(retryingAction.disabled).toBe(true)
    expect(screen.getByRole('region', { name: '当前学习进度暂时无法保存。' }).getAttribute('aria-busy')).toBe('true')
    expect(retryingAction.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(retryingAction.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(retryingAction.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(retryingAction.querySelector('span')?.className).toContain('break-words')
    expect(status.textContent).toContain('正在保存当前课堂；完成前请保持页面打开。')
    expect(describedByText(retryingAction)).toContain('正在保存当前课堂；完成前请保持页面打开。')
    expect(describedByText(retryingAction)).toContain('本次课堂内容、练习结果和复习笔记可能不会出现在下次打开时')
    expect(retryingAction.getAttribute('title')).toContain('正在保存，完成前不会重复提交。')

    fireEvent.click(retryingAction)
    expect(onRetrySave).toHaveBeenCalledTimes(1)

    retry.resolve()
    await waitFor(() => {
      expect((screen.getByRole('button', { name: '重新尝试保存' }) as HTMLButtonElement).disabled).toBe(false)
    })
    expect(screen.getByRole('region', { name: '当前学习进度暂时无法保存。' }).getAttribute('aria-busy')).toBeNull()
  })

  it('uses compiled English copy for save failure recovery', async () => {
    const retry = createDeferred()
    const onRetrySave = vi.fn(() => retry.promise)
    render(<ClassroomPersistenceBanner issue={null} saveIssue="failed" onRetrySave={onRetrySave} />, { wrapper: EnWrapper })

    const banner = screen.getByRole('region', { name: 'Your current learning progress could not be saved yet.' })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Your current learning progress could not be saved yet.')
    expect(status.textContent).toContain('You can keep learning. Before refreshing or closing the page, try saving again.')
    expect(status.textContent).toContain('This classroom content, exercise results, and review notes may not appear next time.')
    expect(screen.queryByText('当前学习进度暂时无法保存。')).toBeNull()

    const action = screen.getByRole('button', { name: 'Try saving again' })
    expect(action.getAttribute('aria-describedby')).toBe(banner.getAttribute('aria-describedby'))
    expect(describedByText(action)).toContain('Before refreshing or closing the page, try saving again.')
    expect(describedByText(action)).toContain('Code drafts will still be kept locally when possible.')
    expect(action.getAttribute('title')).toContain('Click to retry saving the current classroom.')

    fireEvent.click(action)

    expect(onRetrySave).toHaveBeenCalledTimes(1)
    const retryingAction = screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement
    expect(retryingAction.disabled).toBe(true)
    expect(banner.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toContain('Saving the current classroom. Keep the page open until it finishes.')
    expect(retryingAction.getAttribute('title')).toContain('Saving is in progress. It will not submit again before completion.')

    retry.resolve()
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Try saving again' }) as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('briefly confirms when a save retry recovers', async () => {
    const retry = createDeferred()
    const onRetrySave = vi.fn(() => retry.promise)
    const { rerender } = render(
      <ClassroomPersistenceBanner issue={null} saveIssue="failed" onRetrySave={onRetrySave} />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '重新尝试保存' }))
    retry.resolve()
    rerender(<ClassroomPersistenceBanner issue={null} saveIssue={null} onRetrySave={onRetrySave} />)

    const banner = await screen.findByRole('region', { name: '学习进度已保存。' })
    expect(banner).toBe(screen.getByTestId('classroom-persistence-banner'))
    expect(banner.className).toContain('classroom-success')
    expect(screen.getByRole('status').textContent).toContain('当前课堂内容、练习结果和复习笔记已保存到本机。')
    expect(screen.getByRole('status').textContent).toContain('可以继续学习；下次打开时会优先恢复这次课堂。')
    expect(screen.queryByRole('button', { name: '重新尝试保存' })).toBeNull()
    expect(banner.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('unlocks the retry action when retrying the save still fails', async () => {
    const onRetrySave = vi.fn(() => Promise.reject(new Error('idb still full')))
    render(<ClassroomPersistenceBanner issue={null} saveIssue="failed" onRetrySave={onRetrySave} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: '重新尝试保存' }))

    expect(onRetrySave).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: '正在保存...' }) as HTMLButtonElement).disabled).toBe(true)

    await waitFor(() => {
      expect((screen.getByRole('button', { name: '重新尝试保存' }) as HTMLButtonElement).disabled).toBe(false)
    })
    const retryAction = screen.getByRole('button', { name: '重新尝试保存' })
    screen.getByText('这次重试仍未保存成功。你可以继续学习；刷新或关闭页面前，请再试一次。')
    expect(describedByText(retryAction)).toContain('这次重试仍未保存成功。你可以继续学习；刷新或关闭页面前，请再试一次。')
    expect(describedByText(retryAction)).toContain('代码草稿仍会尽量保留在本机。')
    expect(retryAction.getAttribute('title')).toContain('这次重试仍未保存成功。你可以继续学习；刷新或关闭页面前，请再试一次。')
    expect(retryAction.getAttribute('title')).toContain('点击会重新尝试保存当前课堂；不会清除已生成内容、练习结果或复习笔记。')

    fireEvent.click(retryAction)

    expect(onRetrySave).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status').textContent).toContain('正在保存当前课堂；完成前请保持页面打开。')
  })

  it('explains when resetting could not clear the old persisted classroom', async () => {
    const retry = createDeferred()
    const onRetrySave = vi.fn(() => retry.promise)
    render(<ClassroomPersistenceBanner issue={null} saveIssue="clear_failed" onRetrySave={onRetrySave} />, { wrapper: Wrapper })

    const banner = screen.getByRole('region', { name: '旧课堂记录暂时无法清除。' })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('旧课堂记录暂时无法清除。')
    expect(status.textContent).toContain('当前页面已重置为新课堂，但本地旧记录可能仍在')

    const action = screen.getByRole('button', { name: '保存当前课堂' })
    expect(action.className).toContain('w-full')
    expect(action.getAttribute('aria-describedby')).toBe(banner.getAttribute('aria-describedby'))
    expect(describedByText(action)).toContain('当前页面已重置为新课堂，但本地旧记录可能仍在；刷新或关闭页面前，请重新尝试保存当前课堂。')
    expect(describedByText(action)).toContain('如果现在刷新，旧课堂记录可能再次出现；当前新课堂的内容、练习结果和复习笔记也可能还没保存。')
    expect(action.getAttribute('title')).toContain('点击会保存当前新课堂，降低刷新后旧记录回来的风险。')
    expect(action.getAttribute('title')).toContain('当前新课堂的内容、练习结果和复习笔记也可能还没保存。')

    fireEvent.click(action)

    expect(onRetrySave).toHaveBeenCalledTimes(1)
    const retryingAction = screen.getByRole('button', { name: '正在保存...' }) as HTMLButtonElement
    expect(retryingAction.disabled).toBe(true)
    expect(banner.getAttribute('aria-busy')).toBe('true')
    expect(retryingAction.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(retryingAction.getAttribute('title')).toContain('正在保存，完成前不会重复提交。')

    retry.resolve()
    await waitFor(() => {
      expect((screen.getByRole('button', { name: '保存当前课堂' }) as HTMLButtonElement).disabled).toBe(false)
    })
    expect(banner.getAttribute('aria-busy')).toBeNull()
    await screen.findByText('这次保存当前课堂仍未成功。本地旧记录可能还在；请再试一次。')
  })

  it('uses compiled English copy when the old classroom record could not be cleared', async () => {
    const retry = createDeferred()
    const onRetrySave = vi.fn(() => retry.promise)
    render(<ClassroomPersistenceBanner issue={null} saveIssue="clear_failed" onRetrySave={onRetrySave} />, { wrapper: EnWrapper })

    const banner = screen.getByRole('region', { name: 'Old classroom record cannot be cleared yet.' })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('This page has been reset to a new classroom, but the old local record may still exist.')
    expect(status.textContent).toContain('If you refresh now, the old classroom record may appear again')
    expect(screen.queryByText('旧课堂记录暂时无法清除。')).toBeNull()

    const action = screen.getByRole('button', { name: 'Save current classroom' })
    expect(action.getAttribute('aria-describedby')).toBe(banner.getAttribute('aria-describedby'))
    expect(describedByText(action)).toContain('Retry saving the current classroom before refreshing or closing the page.')
    expect(action.getAttribute('title')).toContain('Click to save the current new classroom')

    fireEvent.click(action)

    expect(onRetrySave).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true)
    retry.resolve()
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Save current classroom' }) as HTMLButtonElement).disabled).toBe(false)
    })
    await screen.findByText('Saving the current classroom still did not succeed. The old local record may still be present; please try again.')
  })
})
