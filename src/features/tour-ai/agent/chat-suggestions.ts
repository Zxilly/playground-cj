export interface LocalSuggestion {
  title: string
  prompt: string
  description: string
}

export function buildTourAIChatSuggestions(lang: string): LocalSuggestion[] {
  if (lang === 'en') {
    return [
      {
        title: 'Explain the current focus',
        description: 'Uses classroom context only.',
        prompt: 'Explain the current classroom focus. If there is an exercise, explain what it asks without solving it completely.',
      },
      {
        title: 'Read my code',
        description: 'No code changes or progress updates.',
        prompt: 'Look at my editor code and explain the likely issue before suggesting any change.',
      },
      {
        title: 'Slow down',
        description: 'Stays within validated content.',
        prompt: 'Slow the explanation down and connect it to the validated course content we have already seen.',
      },
    ]
  }

  return [
    {
      title: '解释当前内容',
      description: '只使用课堂上下文。',
      prompt: '解释当前课堂正在学什么；如果有练习，请说明题目想考什么，不要直接给完整答案。',
    },
    {
      title: '看看代码',
      description: '不会改代码或记录进度。',
      prompt: '读一下我编辑器里的代码，先说明可能的问题，再建议怎么改。',
    },
    {
      title: '讲慢一点',
      description: '限定在已验证内容内。',
      prompt: '把当前概念放慢讲一遍，并关联已经看过的课程内容。',
    },
  ]
}
