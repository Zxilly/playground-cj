import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCollaborators } from './workspace-collaborators'

const mocks = vi.hoisted(() => ({
  repository: {
    open: vi.fn(),
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
  createRepository: vi.fn(),
  createClassroom: vi.fn(),
  createStorage: vi.fn(),
}))

vi.mock('@/lib/teach/classroom/content-pack-repository', () => ({
  createCourseContentPackRepository: mocks.createRepository,
}))
vi.mock('@/lib/teach/classroom/storage', () => ({
  createIndexedDBClassroomStorage: mocks.createStorage,
}))
vi.mock('@/lib/teach/classroom/ai-classroom', () => ({
  createAIClassroom: mocks.createClassroom,
}))

async function flushMicrotasks(turns = 12): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1)
    await Promise.resolve()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createRepository.mockReturnValue(mocks.repository)
  mocks.createStorage.mockReturnValue(mocks.storage)
  mocks.createClassroom.mockReturnValue(mocks.classroom)
  mocks.repository.open.mockResolvedValue(mocks.catalog)
  mocks.repository.close.mockResolvedValue(undefined)
  mocks.storage.close.mockResolvedValue(undefined)
  mocks.classroom.open.mockResolvedValue({ revision: 0 })
  mocks.classroom.dispose.mockResolvedValue(undefined)
})

describe('workspace collaborator ownership', () => {
  it('opens one bilingual repository and transfers its catalog to the classroom', async () => {
    const collaborators = await createWorkspaceCollaborators('en')

    expect(mocks.createRepository).toHaveBeenCalledOnce()
    expect(mocks.repository.open).toHaveBeenCalledWith('en', {
      signal: expect.any(AbortSignal),
    })
    expect(mocks.createStorage).toHaveBeenCalledWith({ scope: 'classroom' })
    expect(mocks.createClassroom).toHaveBeenCalledWith(expect.objectContaining({
      catalog: mocks.catalog,
      storage: mocks.storage,
    }))
    expect(mocks.classroom.open).toHaveBeenCalledOnce()

    await collaborators.dispose()
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.repository.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('uses one storage scope while selecting the requested UI locale', async () => {
    const english = await createWorkspaceCollaborators('en')
    await english.dispose()
    const chinese = await createWorkspaceCollaborators('zh')

    expect(mocks.repository.open).toHaveBeenNthCalledWith(1, 'en', {
      signal: expect.any(AbortSignal),
    })
    expect(mocks.repository.open).toHaveBeenNthCalledWith(2, 'zh', {
      signal: expect.any(AbortSignal),
    })
    expect(mocks.createStorage).toHaveBeenNthCalledWith(1, { scope: 'classroom' })
    expect(mocks.createStorage).toHaveBeenNthCalledWith(2, { scope: 'classroom' })

    await chinese.dispose()
  })

  it('closes repository and storage after curriculum initialization fails', async () => {
    const unavailable = new Error('approved manifest unavailable')
    mocks.repository.open.mockRejectedValueOnce(unavailable)

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(unavailable)
    expect(mocks.createClassroom).not.toHaveBeenCalled()
    expect(mocks.repository.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('retains the lease until an abort-ignoring repository open settles', async () => {
    const controller = new AbortController()
    let releaseContentLoading!: (value: typeof mocks.catalog) => void
    mocks.repository.open.mockReturnValueOnce(new Promise((resolve) => {
      releaseContentLoading = resolve
    }))

    const creating = createWorkspaceCollaborators('en', {
      signal: controller.signal,
      timeoutMs: 1_000,
    })
    await vi.waitFor(() => {
      expect(mocks.repository.open).toHaveBeenCalledOnce()
    })
    controller.abort()

    await expect(creating).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.repository.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()

    mocks.createRepository.mockReturnValue({
      open: vi.fn().mockResolvedValue(mocks.catalog),
      close: vi.fn().mockResolvedValue(undefined),
    })
    const creatingNext = createWorkspaceCollaborators('zh')
    await flushMicrotasks()
    expect(mocks.createStorage).toHaveBeenCalledOnce()

    releaseContentLoading(mocks.catalog)
    const next = await creatingNext
    expect(mocks.createStorage).toHaveBeenCalledTimes(2)
    await next.dispose()
  })

  it('releases the lease after repository construction fails', async () => {
    const setupError = new Error('cannot create repository')
    mocks.createRepository.mockImplementationOnce(() => {
      throw setupError
    })

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(setupError)
    const collaborators = await createWorkspaceCollaborators('zh')
    expect(mocks.createStorage).toHaveBeenCalledOnce()
    await collaborators.dispose()
  })

  it('attempts every independent close when one release fails', async () => {
    const collaborators = await createWorkspaceCollaborators('en')
    const closeError = new Error('repository close failed')
    mocks.repository.close.mockRejectedValueOnce(closeError)

    await expect(collaborators.dispose()).rejects.toBe(closeError)
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.repository.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('reports aggregate and storage release failures together', async () => {
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
    expect(mocks.repository.close).toHaveBeenCalledOnce()
  })

  it('drains the classroom before closing storage and disposes idempotently', async () => {
    let releaseClassroom!: () => void
    mocks.classroom.dispose.mockReturnValueOnce(new Promise<void>((resolve) => {
      releaseClassroom = resolve
    }))
    const collaborators = await createWorkspaceCollaborators('en')

    const firstDisposal = collaborators.dispose()
    const secondDisposal = collaborators.dispose()
    expect(secondDisposal).toBe(firstDisposal)
    await Promise.resolve()

    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.repository.close).toHaveBeenCalledOnce()
    expect(mocks.storage.close).not.toHaveBeenCalled()

    releaseClassroom()
    await expect(firstDisposal).resolves.toBeUndefined()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('does not open the next locale until the current classroom releases its lease', async () => {
    let releaseFirst!: () => void
    const firstClassroom = {
      open: vi.fn().mockResolvedValue({ revision: 0 }),
      dispose: vi.fn().mockReturnValue(new Promise<void>((resolve) => {
        releaseFirst = resolve
      })),
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

  it('removes an aborted waiting reservation from the FIFO lease', async () => {
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

  it('bounds caller wait while retaining ownership until repository open settles', async () => {
    vi.useFakeTimers()
    try {
      let releaseContentLoading!: (value: typeof mocks.catalog) => void
      mocks.repository.open.mockReturnValueOnce(new Promise((resolve) => {
        releaseContentLoading = resolve
      }))
      const failure = createWorkspaceCollaborators('en', { timeoutMs: 25 })
        .catch(error => error)
      await vi.advanceTimersByTimeAsync(25)

      await expect(failure).resolves.toMatchObject({
        name: 'TimeoutError',
        timeoutMs: 25,
      })

      mocks.createRepository.mockReturnValue({
        open: vi.fn().mockResolvedValue(mocks.catalog),
        close: vi.fn().mockResolvedValue(undefined),
      })
      const creatingNext = createWorkspaceCollaborators('zh', {
        timeoutMs: 100,
      })
      await vi.advanceTimersByTimeAsync(0)
      await flushMicrotasks()
      expect(mocks.createStorage).toHaveBeenCalledOnce()

      releaseContentLoading(mocks.catalog)
      await vi.advanceTimersByTimeAsync(0)
      const next = await creatingNext
      expect(mocks.createStorage).toHaveBeenCalledTimes(2)
      await next.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('retains ownership until late aggregate open and disposal both settle', async () => {
    vi.useFakeTimers()
    try {
      let releaseOpen!: (value: { revision: number }) => void
      let releaseDisposal!: () => void
      mocks.classroom.open.mockReturnValueOnce(new Promise((resolve) => {
        releaseOpen = resolve
      }))
      mocks.classroom.dispose.mockReturnValueOnce(new Promise<void>((resolve) => {
        releaseDisposal = resolve
      }))
      const failure = createWorkspaceCollaborators('en', { timeoutMs: 35 })
        .catch(error => error)
      await vi.advanceTimersByTimeAsync(35)

      await expect(failure).resolves.toMatchObject({ name: 'TimeoutError' })
      expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
      expect(mocks.repository.close).toHaveBeenCalledOnce()
      expect(mocks.storage.close).toHaveBeenCalledOnce()

      mocks.createRepository.mockReturnValue({
        open: vi.fn().mockResolvedValue(mocks.catalog),
        close: vi.fn().mockResolvedValue(undefined),
      })
      mocks.createClassroom.mockReturnValue({
        open: vi.fn().mockResolvedValue({ revision: 0 }),
        dispose: vi.fn().mockResolvedValue(undefined),
      })
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
})
