import { beforeEach, describe, expect, it } from 'vitest'
import { useTourEditorStore } from './tourEditor'

describe('tour editor output tabs', () => {
  beforeEach(() => {
    useTourEditorStore.setState(useTourEditorStore.getInitialState(), true)
  })

  it('reveals compiler errors after the real run setter sequence clears program output', () => {
    const store = useTourEditorStore.getState()
    store.setCompilerOutput('编译中')
    store.setProgramOutput('运行中')
    expect(useTourEditorStore.getState().activeTab).toBe('program')

    store.setCompilerOutput('syntax error\n----------\nexit code 1')
    store.setProgramOutput('')

    expect(useTourEditorStore.getState()).toMatchObject({
      compilerOutput: 'syntax error\n----------\nexit code 1',
      programOutput: '',
      activeTab: 'tool',
    })
  })

  it('selects program output after a successful run and resets to the empty program tab', () => {
    const store = useTourEditorStore.getState()
    store.setCompilerOutput('编译中')
    store.setProgramOutput('运行中')
    store.setCompilerOutput('\n----------\nexit code 0')
    store.setProgramOutput('hello\n----------\nexit code 0')
    expect(useTourEditorStore.getState().activeTab).toBe('program')

    store.resetOutputs()
    expect(useTourEditorStore.getState()).toMatchObject({ compilerOutput: '', programOutput: '', activeTab: 'program' })
  })
})
