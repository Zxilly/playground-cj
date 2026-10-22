'use client'

import { useEffect, useRef } from 'react'
import type { OutputChannel } from 'vscode'
import { stripTerminalSequences } from '@/lib/compiler-output'
import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import { ensureExtensionHost } from '@/lib/monaco/vscode-api/extension-host'
import styles from './TourEditor.module.css'

type OutputTab = 'program' | 'tool'

interface TourNativeOutputProps {
  locale: string
  expanded: boolean
  revealRequest: number
  programOutput: string
  compilerOutput: string
  activeTab: OutputTab
  onActiveTabChange: (tab: OutputTab) => void
  onClose: () => void
}

type Channels = Record<OutputTab, OutputChannel>

interface OutputState {
  channels: Map<string, Channels>
  owner?: object
  parking?: HTMLDivElement
}

interface MountedOutput {
  updateContents: (program: string, compiler: string) => void
  updateVisibility: (expanded: boolean, tab: OutputTab, revealRequest: number) => void
}

// Like the LSP channel, these channels outlive React mounts: the extension API
// registers them asynchronously, so immediate disposal can race registration.
const outputState = hmrSlot<OutputState>(HMR_SLOT_KEYS.TOUR_OUTPUT_CHANNELS, () => ({
  channels: new Map(),
}))

/** Hosts VS Code's singleton Output panel after the code editor is ready. */
export function TourNativeOutput(props: TourNativeOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef<MountedOutput | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const locale = props.locale === 'en' ? 'en' : 'zh'

  useEffect(() => {
    const container = containerRef.current
    if (!container)
      return

    let cancelled = false
    let release: (() => void) | undefined
    const owner = {}

    async function mount() {
      await ensureExtensionHost()
      if (cancelled)
        return

      const [views, { getService, IOutputService }, { window }] = await Promise.all([
        import('@codingame/monaco-vscode-views-service-override'),
        import('@codingame/monaco-vscode-api/services'),
        import('@codingame/monaco-vscode-extension-api'),
      ])
      const outputService = await getService(IOutputService)
      if (cancelled)
        return

      let channels = outputState.channels.get(locale)
      if (!channels) {
        channels = {
          program: window.createOutputChannel(locale === 'en' ? 'Program Output' : '程序输出') as unknown as OutputChannel,
          tool: window.createOutputChannel(locale === 'en' ? 'Compiler Output' : '编译输出') as unknown as OutputChannel,
        }
        outputState.channels.set(locale, channels)
      }
      const ownedChannels = channels
      outputState.owner = owner
      const attachment = views.renderPanelPart(container!)
      const panel = container!.firstElementChild
      let ownVisibilityChange = false
      let expectedChannel: string | undefined
      let lastExpanded = false
      let lastTab: OutputTab | undefined
      let lastRevealRequest: number | undefined
      let lastProgram: string | undefined
      let lastCompiler: string | undefined

      const visibility = views.onPartVisibilityChange(views.Parts.PANEL_PART, (visible) => {
        if (!visible && !ownVisibilityChange && outputState.owner === owner && propsRef.current.expanded)
          propsRef.current.onClose()
        if (visible && !propsRef.current.expanded) {
          // A queued extension-host show request may finish after React closes.
          queueMicrotask(() => {
            if (!cancelled && outputState.owner === owner && !propsRef.current.expanded)
              mountedRef.current?.updateVisibility(false, propsRef.current.activeTab, propsRef.current.revealRequest)
          })
        }
      })
      const activeChannel = outputService.onActiveOutputChannel((id) => {
        if (outputState.owner !== owner || !propsRef.current.expanded)
          return
        const label = outputService.getChannelDescriptor(id)?.label
        // Registering the first channel also activates it. Ignore that bootstrap
        // event until the channel requested by React has become active.
        if (expectedChannel && label !== expectedChannel)
          return
        const tab = label === ownedChannels.program.name
          ? 'program'
          : label === ownedChannels.tool.name ? 'tool' : undefined
        if (!tab)
          return
        expectedChannel = undefined
        lastTab = tab
        if (tab !== propsRef.current.activeTab)
          propsRef.current.onActiveTabChange(tab)
      })

      const mounted: MountedOutput = {
        updateContents(program, compiler) {
          const update = (channel: OutputChannel, value: string) => {
            const text = stripTerminalSequences(value)
            if (text)
              channel.replace(text)
            else
              channel.clear()
          }
          // Do not replay unchanged props after the native Clear action or when
          // switching channels; the output model remains owned by VS Code.
          if (lastProgram !== program) {
            update(ownedChannels.program, program)
            lastProgram = program
          }
          if (lastCompiler !== compiler) {
            update(ownedChannels.tool, compiler)
            lastCompiler = compiler
          }
        },
        updateVisibility(expanded, tab, revealRequest) {
          if (outputState.owner !== owner)
            return
          // Each accepted run reveals its output even if the native selector is
          // showing another log channel while React's selected tab is unchanged.
          if (expanded && (!lastExpanded || lastTab !== tab || lastRevealRequest !== revealRequest)) {
            expectedChannel = outputService.getActiveChannel()?.label === ownedChannels[tab].name
              ? undefined
              : ownedChannels[tab].name
            ownedChannels[tab].show(true)
          }
          else if (!expanded) {
            expectedChannel = undefined
            ownVisibilityChange = true
            try {
              views.setPartVisibility(views.Parts.PANEL_PART, false)
            }
            finally {
              ownVisibilityChange = false
            }
          }
          lastExpanded = expanded
          lastTab = tab
          lastRevealRequest = revealRequest
        },
      }
      mountedRef.current = mounted
      release = () => {
        visibility.dispose()
        activeChannel.dispose()
        attachment.dispose()
        if (mountedRef.current === mounted)
          mountedRef.current = null
        if (outputState.owner !== owner)
          return
        outputState.owner = undefined
        views.setPartVisibility(views.Parts.PANEL_PART, false)
        // attachPart only releases its observer. Park the live singleton before
        // React removes this host, so route changes can attach it again.
        if (panel?.parentElement === container) {
          if (!outputState.parking) {
            outputState.parking = document.createElement('div')
            outputState.parking.hidden = true
            outputState.parking.dataset.tourOutputParking = ''
            document.body.append(outputState.parking)
          }
          outputState.parking.append(panel)
        }
      }
      const current = propsRef.current
      mounted.updateContents(current.programOutput, current.compilerOutput)
      mounted.updateVisibility(current.expanded, current.activeTab, current.revealRequest)
    }

    void mount().catch((error) => {
      release?.()
      if (!cancelled)
        console.error('[tour-output] Could not mount the native Output panel', error)
    })
    return () => {
      cancelled = true
      release?.()
    }
  }, [locale])

  useEffect(() => {
    mountedRef.current?.updateContents(props.programOutput, props.compilerOutput)
  }, [props.programOutput, props.compilerOutput])

  useEffect(() => {
    mountedRef.current?.updateVisibility(props.expanded, props.activeTab, props.revealRequest)
  }, [props.expanded, props.activeTab, props.revealRequest])

  return (
    <div
      ref={containerRef}
      data-tour-native-output
      className={styles.nativeOutput}
    />
  )
}
