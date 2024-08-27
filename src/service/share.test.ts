import {expect, test} from 'vitest'
import {generateShareUrl, loadShareCode} from "@/service/share";

test("Test share serialization", () => {
  const code = "print('Hello, world!')"
  const url = generateShareUrl(code)

  expect(url).toBe("http://localhost:3000/#data=A4JwlgdgLgFA5ACQKYBsUHsA0ACA7ukFAEwEI4BKIA")

  window.location.href = url
  const newCode = loadShareCode()
  expect(newCode).toBe(code)
})
