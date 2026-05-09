import type { EditorBridge } from '@/modules/cangjie-editor/context/editor-bridge-context'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { NewChatAnnotation } from '@/lib/ai/classroom/editor-annotations'

export type UILang = 'zh' | 'en'

export interface AIClassroomStateBridge {
  getSession: () => ClassroomSession
  dispatch: (action: ClassroomAction) => void
  replaceChatAnnotations: (annotations: NewChatAnnotation[]) => void
  clearChatAnnotations: () => void
}

export interface AIClassroomBridgeValue {
  editor: EditorBridge
  lang: string
  uiLang: UILang
  classroom?: AIClassroomStateBridge
}
