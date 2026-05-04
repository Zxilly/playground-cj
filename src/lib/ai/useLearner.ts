'use client'

import { useEffect, useState } from 'react'
import { useAIBridge } from '@/components/tour/EditorBridgeContext'
import { readLearner } from '@/lib/ai/learner-model'
import type { LearnerModel } from '@/lib/ai/learner-model'

function shallowEqualSnapshot(a: LearnerModel, b: LearnerModel): boolean {
  // Cheap structural compare keyed off the writes the learner-model performs.
  // Concept records are mutated in place; comparing references after read+JSON.parse
  // would always return false, so use a cheap stringify on the typically small payload.
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useLearner(): { learner: LearnerModel } {
  const bridge = useAIBridge()
  const [learner, setLearner] = useState<LearnerModel>(() => readLearner())

  useEffect(() => {
    return bridge.subscribeLearnerChange(() => {
      setLearner((prev) => {
        const next = readLearner()
        return shallowEqualSnapshot(prev, next) ? prev : next
      })
    })
  }, [bridge])

  return { learner }
}
