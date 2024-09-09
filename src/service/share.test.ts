import { generateDataShareUrl, loadShareCode } from '@/service/share'
import { expect, it } from 'vitest'

it.each([
  ['print(\'Hello, world!\')', 'http://localhost:3000/#data=A4JwlgdgLgFA5ACQKYBsUHsA0ACA7ukFAEwEI4BKIA'],
  ['print(\'中文代码\')', 'http://localhost:3000/#data=A4JwlgdgLgFA5IWjlDhpoY7lCAHnAlEA'],
])('test share serialization with code: %s', async (code, expectedUrl) => {
  const url = generateDataShareUrl(code)

  expect(url).toBe(expectedUrl)

  window.location.href = url
  const [newCode, success] = await loadShareCode()
  expect(newCode).toBe(code)
  expect(success).toBe(true)
})
