import { expect, it } from 'vitest'
import { createCangjieFormatter } from './cangjie-formatter'

it('formats source using the real WASM formatter and preserves its own output', async () => {
  const formatter = createCangjieFormatter()
  const formatted = await formatter.format('main(){println("hello")}')
  expect(formatted).toBe('main() {\n    println("hello")\n}\n')
  expect(await formatter.format(formatted)).toBe(formatted)
})
