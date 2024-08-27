import {expect, test} from 'vitest'
import {generateDataShareUrl, loadShareCode} from "@/service/share";

test.each([
  ["print('Hello, world!')", "http://localhost:3000/#data=A4JwlgdgLgFA5ACQKYBsUHsA0ACA7ukFAEwEI4BKIA"],
  ["print('中文代码')", "http://localhost:3000/#data=A4JwlgdgLgFA5IWjlDhpoY7lCAHnAlEA"]
])("Test share serialization with code: %s", (code, expectedUrl) => {
  const url = generateDataShareUrl(code)

  expect(url).toBe(expectedUrl)

  window.location.href = url
  const newCode = loadShareCode()
  expect(newCode).toBe(code)
})
