import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.argv[2])
  throw new Error('Usage: node scripts/verify-edgeone-middleware.mjs <installed edgeone package directory>')
const require = createRequire(join(resolve(process.argv[2]), 'package.json'))
const packagePath = require.resolve('@edgeone/opennextjs-pages/package.json')
const compilerPath = join(dirname(packagePath), 'dist/build/functions/middleware/compiler.js')
const { compile } = await import(pathToFileURL(compilerPath).href)
const result = await compile('.next/server/middleware.js')
if (result.errors.length || result.warnings.length)
  throw new Error(JSON.stringify(result))

const cases = [
  { path: 'https://play.cj.zxilly.com/en', status: 200, header: ['x-middleware-next', '1'] },
  { path: 'https://play.cj.zxilly.com/', status: 307, header: ['location', 'https://play.cj.zxilly.com/en/'] },
  { path: 'https://play.cj.zxilly.com/', cookie: 'locale=zh', status: 307, header: ['location', 'https://play.cj.zxilly.com/zh/'] },
  { path: 'https://play.cj.zxilly.com/api/run', status: null },
  { path: 'https://play.cj.zxilly.com/_next/static/a.js', status: null },
  { path: 'https://tour.cj.zxilly.dev/en/guide/step', status: 200, header: ['x-middleware-rewrite', 'https://tour.cj.zxilly.dev/en/tour/guide/step'] },
  { path: 'https://tour.cj.zxilly.dev/en/tour/guide/step', status: 307, header: ['location', 'https://tour.cj.zxilly.dev/en/guide/step'] },
  { path: 'https://playground.cj.zxilly.dev/en', country: 'CN', env: { VERCEL: '1' }, status: 302, header: ['location', 'https://play.cj.zxilly.com/en'] },
]

for (const test of cases) {
  const errors = []
  const context = vm.createContext({
    console: {
      log() {},
      warn() {},
      error(...args) { errors.push(args.map(String).join(' ').slice(0, 250)) },
    },
    EventTarget, Event, Request, Response, Headers, URL, URLSearchParams,
    TextEncoder, TextDecoder, ReadableStream, WritableStream, TransformStream,
    AbortController, AbortSignal, crypto: webcrypto, performance,
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => new Response('origin'),
  })
  vm.runInContext(result.code, context)
  const headers = { host: new URL(test.path).host, 'accept-language': 'en-US' }
  if (test.cookie)
    headers.cookie = test.cookie
  if (test.country)
    headers['x-vercel-ip-country'] = test.country
  const response = await context.executeMiddleware({
    request: new Request(test.path, { headers }), env: test.env ?? {},
  })
  const status = response?.status ?? null
  const header = test.header && response?.headers.get(test.header[0])
  const resolvedHeader = test.header?.[0] === 'location' && header
    ? new URL(header, test.path).href
    : header
  console.log(JSON.stringify({ path: test.path, cookie: test.cookie, status, header, errors }))
  if (status !== test.status || (test.header && resolvedHeader !== test.header[1]) || errors.length)
    process.exitCode = 1
}
