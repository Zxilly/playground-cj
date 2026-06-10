export function compactPlainText(input: string, maxLength = 360): string {
  const text = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLength)
    return text
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}
