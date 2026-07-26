import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  PLAYGROUND_WORKSPACE_V2_DATABASE_NAME,
  PlaygroundWorkspaceRevisionConflictError,
} from './playground-workspace-storage'
import type {
  PersistedPlaygroundWorkspace,
  PlaygroundWorkspaceStorage,
} from './playground-workspace-storage'
import { createPlaygroundWorkspace } from './playground-workspace'

describe('playground workspace concurrency', () => {
  it('rebases concurrent additions from different browser tabs without duplicate ids or lost drafts', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })

    await Promise.all([first.open(), second.open()])
    const firstId = first.openTab({ title: 'First', code: 'first()' })!
    const secondId = second.openTab({ title: 'Second', code: 'second()' })!
    expect(firstId).not.toBe(secondId)

    await Promise.all([first.whenIdle(), second.whenIdle()])
    await Promise.all([first.refresh(), second.refresh()])

    for (const workspace of [first, second]) {
      expect(workspace.snapshot().tabs).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: firstId, code: 'first()' }),
        expect.objectContaining({ id: secondId, code: 'second()' }),
      ]))
      expect(new Set(workspace.snapshot().tabs.map(tab => tab.id)).size)
        .toBe(workspace.snapshot().tabs.length)
    }

    await Promise.all([first.close(), second.close()])
  })

  it('keeps a valid remote workspace readable when two valid additions exceed the shared tab cap', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    await Promise.all([first.open(), second.open()])
    while (first.snapshot().tabs.length < 15)
      expect(first.openTab()).not.toBeNull()
    await first.whenIdle()
    await second.refresh()

    const firstDraftId = first.openTab({
      title: 'First local draft',
      code: 'first_local()',
    })!
    const secondDraftId = second.openTab({
      title: 'Second local draft',
      code: 'second_local()',
    })!
    await Promise.all([first.whenIdle(), second.whenIdle()])

    const conflicted = [first, second].find(
      workspace => workspace.snapshot().error === 'conflict',
    )
    const winner = conflicted === first ? second : first
    const losingDraftId = conflicted === first ? firstDraftId : secondDraftId
    const winningDraftId = conflicted === first ? secondDraftId : firstDraftId

    expect(conflicted).toBeDefined()
    expect(conflicted!.snapshot()).toMatchObject({
      status: 'ready',
      error: 'conflict',
      dirty: true,
      conflict: {
        tabId: losingDraftId,
        kind: 'capacity',
      },
    })
    expect(conflicted!.snapshot().conflict?.localTab.code)
      .toMatch(/_local\(\)$/)
    expect(conflicted!.snapshot().error).not.toBe('corrupt_workspace')

    expect(conflicted!.resolveConflict('use_remote')).toBeNull()
    await conflicted!.whenIdle()
    expect(conflicted!.snapshot()).toMatchObject({
      status: 'ready',
      error: null,
      dirty: false,
    })
    expect(conflicted!.snapshot().tabs).toHaveLength(16)
    expect(conflicted!.snapshot().tabs.some(tab => tab.id === winningDraftId))
      .toBe(true)
    expect(conflicted!.snapshot().tabs.some(tab => tab.id === losingDraftId))
      .toBe(false)

    await Promise.all([conflicted!.close(), winner.close()])
  })

  it('keeps an oversized rebase recoverable until space is released for a local copy', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    await Promise.all([first.open(), second.open()])
    const disposableIds = Array.from({ length: 3 }, (_, index) =>
      first.openTab({
        title: `Large base ${index}`,
        code: `${index}`.repeat(210_000),
      })!)
    const firstEditedId = first.openTab({ title: 'First edit target' })!
    const secondEditedId = first.openTab({ title: 'Second edit target' })!
    await first.whenIdle()
    await second.refresh()

    expect(first.setTabCode(firstEditedId, 'a'.repeat(230_000))).toBe(true)
    expect(second.setTabCode(secondEditedId, 'b'.repeat(230_000))).toBe(true)
    await Promise.all([first.whenIdle(), second.whenIdle()])

    const conflicted = [first, second].find(
      workspace => workspace.snapshot().error === 'conflict',
    )!
    const winner = conflicted === first ? second : first
    const localCode = conflicted.snapshot().conflict!.localTab.code
    expect(conflicted.snapshot()).toMatchObject({
      status: 'ready',
      error: 'conflict',
      dirty: true,
      conflict: { kind: 'capacity' },
    })
    expect(conflicted.snapshot().error).not.toBe('corrupt_workspace')
    expect(conflicted.resolveConflict('keep_copy')).toBeNull()
    expect(conflicted.snapshot().conflict?.localTab.code).toBe(localCode)

    expect(conflicted.closeTab(disposableIds[0]!)).toBe(true)
    const recoveredId = conflicted.resolveConflict('keep_copy')
    expect(recoveredId).not.toBeNull()
    await conflicted.whenIdle()
    await winner.refresh()

    expect(conflicted.snapshot()).toMatchObject({
      status: 'ready',
      error: null,
      dirty: false,
    })
    expect(conflicted.snapshot().tabs.find(tab => tab.id === recoveredId)?.code)
      .toBe(localCode)
    expect(conflicted.snapshot().tabs.some(tab => tab.id === disposableIds[0]))
      .toBe(false)

    await Promise.all([conflicted.close(), winner.close()])
  })

  it('rejects concurrent edits to the same tab and can recover the losing draft as a new tab', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    await Promise.all([first.open(), second.open()])
    const tabId = first.snapshot().tabs[0]!.id

    expect(first.setTabCode(tabId, 'first writer')).toBe(true)
    expect(second.setTabCode(tabId, 'second writer')).toBe(true)
    await Promise.all([first.whenIdle(), second.whenIdle()])

    const conflicted = [first, second].find(
      workspace => workspace.snapshot().error === 'conflict',
    )
    const winner = conflicted === first ? second : first
    expect(conflicted).toBeDefined()
    expect(conflicted!.snapshot().conflict).toMatchObject({
      tabId,
      kind: 'content',
    })
    let localCode = conflicted!.snapshot().conflict!.localTab.code
    const remoteCode = conflicted!.snapshot().conflict!.remoteTab!.code
    expect(new Set([localCode, remoteCode])).toEqual(
      new Set(['first writer', 'second writer']),
    )

    localCode = `${localCode} continued before recovery`
    expect(conflicted!.setTabCode(tabId, localCode)).toBe(true)
    expect(conflicted!.snapshot().conflict?.localTab.code).toBe(localCode)

    const recoveredId = conflicted!.resolveConflict('keep_copy')
    expect(recoveredId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    await conflicted!.whenIdle()
    await winner.refresh()

    for (const workspace of [conflicted!, winner]) {
      expect(workspace.snapshot().tabs.find(tab => tab.id === tabId)?.code)
        .toBe(remoteCode)
      expect(workspace.snapshot().tabs.find(tab => tab.id === recoveredId)?.code)
        .toBe(localCode)
      expect(workspace.snapshot().error).toBeNull()
    }

    await Promise.all([first.close(), second.close()])
  })

  it('keeps a conflicting draft recoverable when the tab cap initially blocks a copy', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    await Promise.all([first.open(), second.open()])
    const tabId = first.snapshot().tabs[0]!.id
    for (let index = 1; index < 16; index += 1)
      expect(first.openTab({ title: `Tab ${index}` })).not.toBeNull()
    await first.whenIdle()
    await second.refresh()

    first.setTabCode(tabId, 'first full-workspace edit')
    second.setTabCode(tabId, 'second full-workspace edit')
    await Promise.all([first.whenIdle(), second.whenIdle()])
    const conflicted = [first, second].find(
      workspace => workspace.snapshot().error === 'conflict',
    )!
    const winner = conflicted === first ? second : first
    const localCode = conflicted.snapshot().conflict!.localTab.code

    expect(conflicted.resolveConflict('keep_copy')).toBeNull()
    expect(conflicted.snapshot().conflict?.localTab.code).toBe(localCode)

    const disposableTabId = conflicted.snapshot().tabs.find(
      tab => tab.id !== tabId,
    )!.id
    expect(conflicted.closeTab(disposableTabId)).toBe(true)
    const recoveredId = conflicted.resolveConflict('keep_copy')
    expect(recoveredId).not.toBeNull()
    await conflicted.whenIdle()
    await winner.refresh()

    expect(conflicted.snapshot().tabs).toHaveLength(16)
    expect(conflicted.snapshot().tabs.find(tab => tab.id === recoveredId)?.code)
      .toBe(localCode)
    expect(conflicted.snapshot().conflict).toBeNull()

    await Promise.all([first.close(), second.close()])
  })

  it('refreshes another browser tab after a committed revision notification', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    await Promise.all([first.open(), second.open()])

    const addedId = first.openTab({ code: 'notified()' })!
    await first.whenIdle()

    await vi.waitFor(() => {
      expect(second.snapshot().tabs.find(tab => tab.id === addedId)?.code)
        .toBe('notified()')
      expect(second.snapshot().revision).toBe(first.snapshot().revision)
    })

    await Promise.all([first.close(), second.close()])
  })

  it('treats revision notifications as hints instead of spinning on an absent revision', async () => {
    const tabId = crypto.randomUUID()
    const stored: PersistedPlaygroundWorkspace = {
      schemaVersion: 2,
      revision: 1,
      tabs: [{
        id: tabId,
        title: 'Playground 1',
        code: '',
        titleVersion: crypto.randomUUID(),
        contentVersion: crypto.randomUUID(),
      }],
    }
    let loadCalls = 0
    let notifyRevision: ((revision: number) => void) | null = null
    const storage: PlaygroundWorkspaceStorage = {
      load: async () => {
        loadCalls += 1
        return structuredClone(stored)
      },
      save: async () => {
        throw new Error('unexpected save')
      },
      subscribe: (listener) => {
        notifyRevision = listener
        return () => {}
      },
      close: async () => {},
    }
    const workspace = createPlaygroundWorkspace({ storage })
    await workspace.open()

    notifyRevision!(Number.MAX_SAFE_INTEGER)
    await workspace.whenIdle()

    expect(loadCalls).toBe(2)
    expect(workspace.snapshot()).toMatchObject({
      revision: 1,
      error: null,
    })
    await workspace.close()
  })

  it('replays concurrent edits to different tabs without discarding either change', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    const second = createPlaygroundWorkspace({
      storage: createIndexedDBPlaygroundWorkspaceStorage({
        databaseName,
        scope: 'workspace',
      }),
    })
    await Promise.all([first.open(), second.open()])
    const firstTab = first.openTab({ code: 'first base' })!
    const secondTab = first.openTab({ code: 'second base' })!
    await first.whenIdle()
    await second.refresh()

    first.setTabCode(firstTab, 'first concurrent edit')
    second.setTabCode(secondTab, 'second concurrent edit')
    await Promise.all([first.whenIdle(), second.whenIdle()])
    await Promise.all([first.refresh(), second.refresh()])

    for (const workspace of [first, second]) {
      expect(workspace.snapshot().error).toBeNull()
      expect(workspace.snapshot().tabs.find(tab => tab.id === firstTab)?.code)
        .toBe('first concurrent edit')
      expect(workspace.snapshot().tabs.find(tab => tab.id === secondTab)?.code)
        .toBe('second concurrent edit')
    }

    await Promise.all([first.close(), second.close()])
  })

  it('parks the first over-capacity pending mutation after an earlier mutation rebases successfully', async () => {
    let stored: PersistedPlaygroundWorkspace | null = null
    let holdNextSave = false
    let announceSaveStarted!: () => void
    let finishSave!: () => void
    const saveStarted = new Promise<void>((resolve) => {
      announceSaveStarted = resolve
    })
    const storage: PlaygroundWorkspaceStorage = {
      load: async () => stored == null ? null : structuredClone(stored),
      save: async (snapshot, expectedRevision) => {
        if (holdNextSave) {
          holdNextSave = false
          await new Promise<void>((resolve) => {
            finishSave = resolve
            announceSaveStarted()
          })
        }
        const actualRevision = stored?.revision ?? 0
        if (actualRevision !== expectedRevision) {
          throw new PlaygroundWorkspaceRevisionConflictError(
            expectedRevision,
            actualRevision,
          )
        }
        stored = structuredClone(snapshot)
      },
      subscribe: () => () => {},
      close: async () => {},
    }
    const workspace = createPlaygroundWorkspace({ storage })
    await workspace.open()
    for (let index = 0; index < 3; index += 1) {
      expect(workspace.openTab({
        title: `Large base ${index}`,
        code: `${index}`.repeat(210_000),
      })).not.toBeNull()
    }
    const activeTabId = workspace.openTab({ title: 'Active local edit' })!
    const pendingTabId = workspace.openTab({ title: 'Pending local edit' })!
    const remoteTabId = workspace.openTab({ title: 'Remote edit' })!
    await workspace.whenIdle()

    holdNextSave = true
    expect(workspace.setTabCode(activeTabId, 'a'.repeat(100_000))).toBe(true)
    await saveStarted
    expect(workspace.setTabCode(pendingTabId, 'p'.repeat(200_000))).toBe(true)
    stored = {
      ...stored!,
      revision: stored!.revision + 1,
      tabs: stored!.tabs.map(tab => tab.id === remoteTabId
        ? {
            ...tab,
            code: 'r'.repeat(200_000),
            contentVersion: crypto.randomUUID(),
          }
        : tab),
    }
    finishSave()
    await workspace.whenIdle()

    expect(workspace.snapshot()).toMatchObject({
      status: 'ready',
      error: 'conflict',
      dirty: true,
      conflict: {
        tabId: pendingTabId,
        kind: 'capacity',
        localTab: { code: 'p'.repeat(200_000) },
      },
    })
    expect(workspace.resolveConflict('use_remote')).toBeNull()
    await workspace.whenIdle()
    expect(workspace.snapshot()).toMatchObject({
      status: 'ready',
      error: null,
      dirty: false,
    })
    expect(workspace.snapshot().tabs.find(tab => tab.id === activeTabId)?.code)
      .toBe('a'.repeat(100_000))
    expect(workspace.snapshot().tabs.find(tab => tab.id === remoteTabId)?.code)
      .toBe('r'.repeat(200_000))
    expect(workspace.snapshot().tabs.find(tab => tab.id === pendingTabId)?.code)
      .toBe('')
    await workspace.close()
  })

  it('coalesces rapid source changes while one durable write is still owned', async () => {
    let stored: PersistedPlaygroundWorkspace | null = null
    let holdWrites = false
    let finishHeldWrite: (() => void) | null = null
    let saveCalls = 0
    const storage: PlaygroundWorkspaceStorage = {
      load: async () => stored == null ? null : structuredClone(stored),
      save: async (snapshot, expectedRevision) => {
        saveCalls += 1
        const actualRevision = stored?.revision ?? 0
        if (actualRevision !== expectedRevision) {
          throw new PlaygroundWorkspaceRevisionConflictError(
            expectedRevision,
            actualRevision,
          )
        }
        if (holdWrites) {
          holdWrites = false
          await new Promise<void>((resolve) => {
            finishHeldWrite = resolve
          })
        }
        stored = structuredClone(snapshot)
      },
      subscribe: () => () => {},
      close: async () => {},
    }
    const workspace = createPlaygroundWorkspace({ storage })
    await workspace.open()
    holdWrites = true
    const tabId = workspace.snapshot().tabs[0]!.id

    workspace.setTabCode(tabId, 'edit 0')
    for (let index = 1; index <= 100; index += 1)
      workspace.setTabCode(tabId, `edit ${index}`)
    expect(finishHeldWrite).not.toBeNull()
    finishHeldWrite!()
    await workspace.whenIdle()

    expect(workspace.snapshot().tabs[0]!.code).toBe('edit 100')
    expect(saveCalls).toBe(3)
    await workspace.close()
  })

  it('does not create a revision for no-op source or title updates', async () => {
    let stored: PersistedPlaygroundWorkspace | null = null
    let saveCalls = 0
    const storage: PlaygroundWorkspaceStorage = {
      load: async () => stored == null ? null : structuredClone(stored),
      save: async (snapshot) => {
        saveCalls += 1
        stored = structuredClone(snapshot)
      },
      subscribe: () => () => {},
      close: async () => {},
    }
    const workspace = createPlaygroundWorkspace({ storage })
    await workspace.open()
    const tab = workspace.snapshot().tabs[0]!

    expect(workspace.setTabCode(tab.id, tab.code)).toBe(true)
    expect(workspace.renameTab(tab.id, tab.title)).toBe(true)
    await workspace.whenIdle()

    expect(workspace.snapshot()).toMatchObject({
      revision: 1,
      dirty: false,
    })
    expect(saveCalls).toBe(1)
    await workspace.close()
  })
})
