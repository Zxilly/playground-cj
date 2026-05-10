export function buildTourAIChatSuggestions(lang: string) {
  if (lang === 'en') {
    return [
      { title: 'Explain the quiz', prompt: 'Explain what the current quiz is asking without solving it completely.' },
      { title: 'Read my code', prompt: 'Look at my editor code and explain the likely issue.' },
      { title: 'Go deeper', prompt: 'I want a deeper explanation of this concept.' },
    ]
  }

  return [
    { title: '解释题目', prompt: '解释一下当前 quiz 想考什么，不要直接给完整答案。' },
    { title: '看看代码', prompt: '读一下我编辑器里的代码，说明可能的问题。' },
    { title: '讲深一点', prompt: '我想把这个概念讲得更深入一些。' },
  ]
}
