export function formatResetMoment(nextResetAt: number): string {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return formatter.format(new Date(nextResetAt))
  }
  catch {
    return new Date(nextResetAt).toISOString()
  }
}
