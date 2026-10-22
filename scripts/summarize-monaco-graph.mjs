import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path)
  throw new Error('Usage: node scripts/summarize-monaco-graph.mjs <analyzer-export.jsonl>')
const records = readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse)
const modules = new Map(records.filter(record => record.type === 'module').map(record => [record.ident, record]))
const root = [...modules.values()].find(record => record.path.endsWith('/EditorWrapper.tsx') && record.ident.includes('[app-client]'))
if (!root)
  throw new Error('The export does not contain the client EditorWrapper module')

function closure(id, skip = () => false, seen = new Set()) {
  if (seen.has(id) || skip(modules.get(id)))
    return seen
  seen.add(id)
  for (const dependency of modules.get(id)?.dependencies.sync ?? [])
    closure(dependency, skip, seen)
  return seen
}

const initial = closure(root.ident)
const withoutHost = closure(root.ident, module => module && /\/(?:extension\.api|localExtensionHost)\.js$/.test(module.path))
const exclusive = [...initial].filter(id => !withoutHost.has(id))
const initialPaths = new Set([...initial].map(id => modules.get(id)?.path))
const exclusivePaths = new Set(exclusive.map(id => modules.get(id)?.path))
// The analyzer repeats parts in multiple groups. Count each emitted file and
// source-path pair once; these are analyzer bytes, not HTTP transfer sizes.
const parts = [...new Map(records
  .filter(record => record.type === 'part' && record.filename.startsWith('[client-fs]') && initialPaths.has(record.source_path))
  .map(record => [`${record.filename}|${record.source_path}`, record])).values()]
console.log(JSON.stringify({
  root: root.path,
  synchronousModules: initial.size,
  extensionHostExclusiveModules: exclusive.length,
  extensionHostExclusiveAnalyzerBytes: parts.filter(part => exclusivePaths.has(part.source_path)).reduce((sum, part) => sum + part.size, 0),
  largestSynchronousParts: parts.sort((a, b) => b.size - a.size).slice(0, 20).map(part => ({ path: part.source_path, bytes: part.size })),
}, null, 2))
