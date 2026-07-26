import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCollaborators } from './workspace-collaborators'

const mocks = vi.hoisted(() => ({
  enCache: {
    merge: vi.fn(),
    close: vi.fn(),
  },
  zhCache: {
    merge: vi.fn(),
    close: vi.fn(),
  },
  storage: {
    load: vi.fn(),
    save: vi.fn(),
    close: vi.fn(),
  },
  classroom: {
    open: vi.fn(),
    dispose: vi.fn(),
  },
  catalog: { id: 'catalog' },
  createCache: vi.fn(),
  createCatalog: vi.fn(),
  createClassroom: vi.fn(),
  createStorage: vi.fn(),
  fetchPacks: vi.fn(),
}))

vi.mock('@/lib/teach/classroom/content-pack-cache', () => ({
  createIndexedDBContentPackCache: mocks.createCache,
}))
vi.mock('@/lib/teach/classroom/content-catalog', () => ({
  createContentPackCatalog: mocks.createCatalog,
}))
vi.mock('@/lib/teach/classroom/content-pack-client', () => ({
  fetchCourseContentPacks: mocks.fetchPacks,
}))
vi.mock('@/lib/teach/classroom/storage', () => ({
  createIndexedDBClassroomStorage: mocks.createStorage,
}))
vi.mock('@/lib/teach/classroom/ai-classroom', () => ({
  createAIClassroom: mocks.createClassroom,
}))

const enResponse = {
  packs: [{ concept: { id: 'concept:test' }, version: 'en-current' }],
  currentVersions: { 'concept:test': 'en-current' },
}
const zhResponse = {
  packs: [{ concept: { id: 'concept:test' }, version: 'zh-current' }],
  currentVersions: { 'concept:test': 'zh-current' },
}
const enHistory = [
  ...enResponse.packs,
  { concept: { id: 'concept:test' }, version: 'en-historical' },
]
const zhHistory = [
  ...zhResponse.packs,
  { concept: { id: 'concept:test' }, version: 'zh-historical' },
]

async function flushMicrotasks(turns = 12): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1)
    await Promise.resolve()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createCache.mockImplementation(({ locale }: { locale: 'en' | 'zh' }) =>
    locale === 'en' ? mocks.enCache : mocks.zhCache)
  mocks.createStorage.mockReturnValue(mocks.storage)
  mocks.createCatalog.mockReturnValue(mocks.catalog)
  mocks.createClassroom.mockReturnValue(mocks.classroom)
  mocks.fetchPacks.mockImplementation((locale: 'en' | 'zh') =>
    Promise.resolve(locale === 'en' ? enResponse : zhResponse))
  mocks.enCache.merge.mockResolvedValue(enHistory)
  mocks.zhCache.merge.mockResolvedValue(zhHistory)
  mocks.enCache.close.mockResolvedValue(undefined)
  mocks.zhCache.close.mockResolvedValue(undefined)
  mocks.storage.close.mockResolvedValue(undefined)
  mocks.classroom.open.mockResolvedValue({ revision: 0 })
  mocks.classroom.dispose.mockResolvedValue(undefined)
})

describe('workspace collaborators bilingual Content Pack history', () => {
  it('fetches and caches both locales while selecting only the UI locale current map', async () => {
    const collaborators = await createWorkspaceCollaborators('en')

    expect(mocks.fetchPacks).toHaveBeenCalledTimes(2)
    expect(mocks.fetchPacks).toHaveBeenCalledWith('en', {
      signal: expect.any(AbortSignal),
    })
    expect(mocks.fetchPacks).toHaveBeenCalledWith('zh', {
      signal: expect.any(AbortSignal),
    })
    expect(mocks.createCache).toHaveBeenCalledTimes(2)
    expect(mocks.createCache).toHaveBeenCalledWith({ locale: 'en' })
    expect(mocks.createCache).toHaveBeenCalledWith({ locale: 'zh' })
    expect(mocks.enCache.merge).toHaveBeenCalledWith(enResponse)
    expect(mocks.zhCache.merge).toHaveBeenCalledWith(zhResponse)
    expect(mocks.createCatalog).toHaveBeenCalledWith(
      [...enHistory, ...zhHistory],
      enResponse.currentVersions,
    )
    expect(mocks.createStorage).toHaveBeenCalledWith({ scope: 'classroom' })
    expect(mocks.createClassroom).toHaveBeenCalledWith(expect.objectContaining({
      catalog: mocks.catalog,
      storage: mocks.storage,
    }))
    expect(mocks.classroom.open).toHaveBeenCalledOnce()

    await collaborators.dispose()
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('uses one storage scope across language switches and never merges competing current maps', async () => {
    const english = await createWorkspaceCollaborators('en')
    await english.dispose()
    const chinese = await createWorkspaceCollaborators('zh')

    expect(mocks.createStorage).toHaveBeenNthCalledWith(1, { scope: 'classroom' })
    expect(mocks.createStorage).toHaveBeenNthCalledWith(2, { scope: 'classroom' })
    expect(mocks.createCatalog).toHaveBeenNthCalledWith(
      1,
      [...enHistory, ...zhHistory],
      enResponse.currentVersions,
    )
    expect(mocks.createCatalog).toHaveBeenNthCalledWith(
      2,
      [...enHistory, ...zhHistory],
      zhResponse.currentVersions,
    )
    expect(mocks.createCatalog.mock.calls[0]?.[1]).toBe(enResponse.currentVersions)
    expect(mocks.createCatalog.mock.calls[1]?.[1]).toBe(zhResponse.currentVersions)

    await chinese.dispose()
  })

  it('fails closed and closes both caches when either required locale cannot load', async () => {
    const unavailable = new Error('zh approved manifest unavailable')
    mocks.fetchPacks.mockImplementation((locale: 'en' | 'zh') =>
      locale === 'zh' ? Promise.reject(unavailable) : Promise.resolve(enResponse))

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(unavailable)
    expect(mocks.enCache.merge).not.toHaveBeenCalled()
    expect(mocks.zhCache.merge).not.toHaveBeenCalled()
    expect(mocks.createClassroom).not.toHaveBeenCalled()
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('waits for both cache merges and closes every resource after immutable history failure', async () => {
    const collision = new Error('immutable version collision')
    mocks.enCache.merge.mockRejectedValue(collision)

    await expect(createWorkspaceCollaborators('zh')).rejects.toBe(collision)
    expect(mocks.enCache.merge).toHaveBeenCalledOnce()
    expect(mocks.zhCache.merge).toHaveBeenCalledOnce()
    expect(mocks.createClassroom).not.toHaveBeenCalled()
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('keeps caller abort distinct and retains the lease until ignored content loading settles', async () => {
    const controller = new AbortController()
    let releaseContentLoading!: (value: typeof enResponse) => void
    const pendingContentLoading = new Promise<typeof enResponse>((resolve) => {
      releaseContentLoading = resolve
    })
    mocks.fetchPacks.mockReturnValue(pendingContentLoading)

    const creating = createWorkspaceCollaborators('en', {
      signal: controller.signal,
      timeoutMs: 1_000,
    })
    await vi.waitFor(() => {
      expect(mocks.fetchPacks).toHaveBeenCalledTimes(2)
    })
    controller.abort()

    await expect(creating).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()

    mocks.fetchPacks.mockImplementation((locale: 'en' | 'zh') =>
      Promise.resolve(locale === 'en' ? enResponse : zhResponse))
    const creatingNext = createWorkspaceCollaborators('zh')
    await flushMicrotasks()
    expect(mocks.createStorage).toHaveBeenCalledOnce()

    releaseContentLoading(enResponse)
    const next = await creatingNext
    expect(mocks.createStorage).toHaveBeenCalledTimes(2)
    await next.dispose()
  })

  it('closes the first cache if creating the second cache fails', async () => {
    const setupError = new Error('cannot create zh cache')
    mocks.createCache.mockImplementation(({ locale }: { locale: 'en' | 'zh' }) => {
      if (locale === 'zh')
        throw setupError
      return mocks.enCache
    })

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(setupError)
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.createStorage).not.toHaveBeenCalled()
    expect(mocks.fetchPacks).not.toHaveBeenCalled()
  })

  it('attempts every close even when one disposer fails', async () => {
    const collaborators = await createWorkspaceCollaborators('en')
    const closeError = new Error('en cache close failed')
    mocks.enCache.close.mockRejectedValueOnce(closeError)

    await expect(collaborators.dispose()).rejects.toBe(closeError)
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('closes storage and caches after a drain failure and reports every release error', async () => {
    const collaborators = await createWorkspaceCollaborators('en')
    const drainError = new Error('classroom drain failed')
    const storageError = new Error('storage close failed')
    mocks.classroom.dispose.mockRejectedValueOnce(drainError)
    mocks.storage.close.mockRejectedValueOnce(storageError)

    const failure = await collaborators.dispose().catch(error => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([
      drainError,
      storageError,
    ])
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
  })

  it('waits for the aggregate to drain before closing storage and disposes idempotently', async () => {
    let releaseClassroom!: () => void
    const classroomDrained = new Promise<void>((resolve) => {
      releaseClassroom = resolve
    })
    mocks.classroom.dispose.mockReturnValueOnce(classroomDrained)
    const collaborators = await createWorkspaceCollaborators('en')

    const firstDisposal = collaborators.dispose()
    const secondDisposal = collaborators.dispose()
    expect(secondDisposal).toBe(firstDisposal)
    await Promise.resolve()

    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.storage.close).not.toHaveBeenCalled()
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()

    releaseClassroom()
    await expect(firstDisposal).resolves.toBeUndefined()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('does not open the next locale runtime until the previous runtime releases its lease', async () => {
    let releaseFirst!: () => void
    const firstDrain = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstClassroom = {
      open: vi.fn().mockResolvedValue({ revision: 0 }),
      dispose: vi.fn().mockReturnValue(firstDrain),
    }
    const secondClassroom = {
      open: vi.fn().mockResolvedValue({ revision: 0 }),
      dispose: vi.fn().mockResolvedValue(undefined),
    }
    mocks.createClassroom
      .mockReturnValueOnce(firstClassroom)
      .mockReturnValueOnce(secondClassroom)

    const english = await createWorkspaceCollaborators('en')
    const disposingEnglish = english.dispose()
    const creatingChinese = createWorkspaceCollaborators('zh')
    await Promise.resolve()

    expect(mocks.createStorage).toHaveBeenCalledOnce()
    expect(secondClassroom.open).not.toHaveBeenCalled()

    releaseFirst()
    await disposingEnglish
    const chinese = await creatingChinese
    expect(mocks.createStorage).toHaveBeenCalledTimes(2)
    expect(secondClassroom.open).toHaveBeenCalledOnce()
    await chinese.dispose()
  })

  it('releases an aborted waiting lease so a later runtime can still open', async () => {
    const english = await createWorkspaceCollaborators('en')
    const controller = new AbortController()
    const aborted = createWorkspaceCollaborators('zh', {
      signal: controller.signal,
    })
    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })

    const creatingNext = createWorkspaceCollaborators('zh')
    await Promise.resolve()
    expect(mocks.createStorage).toHaveBeenCalledOnce()

    await english.dispose()
    const next = await creatingNext
    expect(mocks.createStorage).toHaveBeenCalledTimes(2)
    await next.dispose()
  })

  it('releases the lease after failed initialization', async () => {
    const setupError = new Error('cannot create first cache')
    mocks.createCache.mockImplementationOnce(() => {
      throw setupError
    })

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(setupError)
    const collaborators = await createWorkspaceCollaborators('zh')
    expect(mocks.createStorage).toHaveBeenCalledOnce()
    await collaborators.dispose()
  })

  it('bounds the caller wait but keeps ownership until ignored content loading settles', async () => {
    vi.useFakeTimers()
    try {
      let releaseContentLoading!: (value: typeof enResponse) => void
      const pendingContentLoading = new Promise<typeof enResponse>((resolve) => {
        releaseContentLoading = resolve
      })
      mocks.fetchPacks.mockReturnValue(pendingContentLoading)
      const creating = createWorkspaceCollaborators('en', { timeoutMs: 25 })
      const failure = creating.catch(error => error)
      await vi.advanceTimersByTimeAsync(25)

      await expect(failure).resolves.toMatchObject({
        name: 'TimeoutError',
        timeoutMs: 25,
      })
      expect(mocks.enCache.close).toHaveBeenCalledOnce()
      expect(mocks.zhCache.close).toHaveBeenCalledOnce()
      expect(mocks.storage.close).toHaveBeenCalledOnce()

      mocks.fetchPacks.mockImplementation((locale: 'en' | 'zh') =>
        Promise.resolve(locale === 'en' ? enResponse : zhResponse))
      const creatingNext = createWorkspaceCollaborators('zh', {
        timeoutMs: 100,
      })
      await vi.advanceTimersByTimeAsync(0)
      await flushMicrotasks()
      expect(mocks.createStorage).toHaveBeenCalledOnce()

      releaseContentLoading(enResponse)
      await vi.advanceTimersByTimeAsync(0)
      const next = await creatingNext
      expect(mocks.createStorage).toHaveBeenCalledTimes(2)
      expect(mocks.classroom.open).toHaveBeenCalledOnce()
      await next.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('retains cache and storage ownership until a late IndexedDB merge settles', async () => {
    vi.useFakeTimers()
    try {
      let releaseMerge!: (value: typeof enHistory) => void
      const pendingMerge = new Promise<typeof enHistory>((resolve) => {
        releaseMerge = resolve
      })
      mocks.enCache.merge.mockReturnValue(pendingMerge)
      const failure = createWorkspaceCollaborators('en', { timeoutMs: 30 })
        .catch(error => error)
      await vi.advanceTimersByTimeAsync(30)

      await expect(failure).resolves.toMatchObject({ name: 'TimeoutError' })
      expect(mocks.enCache.close).toHaveBeenCalledOnce()
      expect(mocks.zhCache.close).toHaveBeenCalledOnce()
      expect(mocks.storage.close).toHaveBeenCalledOnce()

      mocks.enCache.merge.mockResolvedValue(enHistory)
      const creatingNext = createWorkspaceCollaborators('en', {
        timeoutMs: 100,
      })
      await vi.advanceTimersByTimeAsync(0)
      await flushMicrotasks()
      expect(mocks.createStorage).toHaveBeenCalledOnce()

      releaseMerge(enHistory)
      await vi.advanceTimersByTimeAsync(0)
      const next = await creatingNext
      expect(mocks.createStorage).toHaveBeenCalledTimes(2)
      await next.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('asks every resource to close but retains the lease until open and disposal settle', async () => {
    vi.useFakeTimers()
    try {
      let releaseOpen!: (value: { revision: number }) => void
      let releaseDisposal!: () => void
      mocks.classroom.open.mockReturnValue(new Promise((resolve) => {
        releaseOpen = resolve
      }))
      mocks.classroom.dispose.mockReturnValue(new Promise<void>((resolve) => {
        releaseDisposal = resolve
      }))
      const failure = createWorkspaceCollaborators('en', { timeoutMs: 35 })
        .catch(error => error)
      await vi.advanceTimersByTimeAsync(35)

      await expect(failure).resolves.toMatchObject({ name: 'TimeoutError' })
      expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
      expect(mocks.storage.close).toHaveBeenCalledOnce()
      expect(mocks.enCache.close).toHaveBeenCalledOnce()
      expect(mocks.zhCache.close).toHaveBeenCalledOnce()

      mocks.classroom.open.mockResolvedValue({ revision: 0 })
      mocks.classroom.dispose.mockResolvedValue(undefined)
      const creatingNext = createWorkspaceCollaborators('zh', {
        timeoutMs: 100,
      })
      await vi.advanceTimersByTimeAsync(0)
      await flushMicrotasks()
      expect(mocks.createStorage).toHaveBeenCalledOnce()

      releaseOpen({ revision: 0 })
      releaseDisposal()
      await vi.advanceTimersByTimeAsync(0)
      const next = await creatingNext
      expect(mocks.createStorage).toHaveBeenCalledTimes(2)
      await next.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('removes a timed-out FIFO reservation so it cannot block the next runtime', async () => {
    vi.useFakeTimers()
    try {
      let releaseFirst!: () => void
      mocks.classroom.dispose.mockReturnValueOnce(new Promise<void>((resolve) => {
        releaseFirst = resolve
      }))
      const first = await createWorkspaceCollaborators('en')
      const firstDisposal = first.dispose()

      const timedOut = createWorkspaceCollaborators('zh', { timeoutMs: 40 })
        .catch(error => error)
      await vi.advanceTimersByTimeAsync(40)
      await expect(timedOut).resolves.toMatchObject({ name: 'TimeoutError' })

      const creatingNext = createWorkspaceCollaborators('zh')
      releaseFirst()
      await firstDisposal
      const next = await creatingNext
      expect(mocks.createStorage).toHaveBeenCalledTimes(2)
      await next.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
