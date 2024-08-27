export function saveAsFile(content: string, fileName: string = 'main.cj'): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })

  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = fileName

  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
  })
  a.dispatchEvent(clickEvent)

  URL.revokeObjectURL(url)
}
