import { readFileSync, readdirSync, realpathSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]((?:@codingame\/|vscode\/)[^'"]+)['"]/g
const PKG_IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
const SKIP_ASSET_RE = /\.(?:css|json|wasm|ttf|woff2?|svg|png|html)$/i

export function collectNlsIds(source, filename = 'source.js') {
  if (!/\bfrom\s*['"][^'"]*\/nls(?:\.js)?['"]/.test(source))
    return new Set()
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const bindings = new Set()
  const namespaces = new Set()
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || !/\/nls(?:\.js)?$/.test(statement.moduleSpecifier.text))
      continue
    const named = statement.importClause?.namedBindings
    if (named && ts.isNamespaceImport(named))
      namespaces.add(named.name.text)
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        if (['localize', 'localize2'].includes(element.propertyName?.text ?? element.name.text))
          bindings.add(element.name.text)
      }
    }
  }
  const ids = new Set()
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const direct = ts.isIdentifier(expression) && bindings.has(expression.text)
      const namespaced = ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression) && namespaces.has(expression.expression.text)
        && ['localize', 'localize2'].includes(expression.name.text)
      if (direct || namespaced) {
        const first = node.arguments[0]
        if (first && ts.isNumericLiteral(first))
          ids.add(Number(first.text))
        else if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first) || ts.isObjectLiteralExpression(first))) {
          // These calls use the English message argument, not the indexed catalog.
        }
        else {
          throw new Error(`Non-static NLS index in ${filename}: ${node.getText(ast).slice(0, 120)}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return ids
}

function packageDirectory(name, require) {
  let entry
  try {
    entry = require.resolve(`${name}/package.json`)
  }
  catch {
    entry = require.resolve(name)
  }
  let directory = dirname(realpathSync(entry))
  while (!existsSync(join(directory, 'package.json'))) {
    const parent = dirname(directory)
    if (parent === directory)
      throw new Error(`Cannot locate package metadata for ${name}`)
    directory = parent
  }
  return directory
}

export function collectMonacoPackages(root = repository) {
  const rootMetadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const packages = new Map()
  const visit = (name, require) => {
    const directory = packageDirectory(name, require)
    if (packages.has(directory))
      return
    const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    packages.set(directory, metadata)
    const childRequire = createRequire(join(directory, 'package.json'))
    for (const dependency of Object.keys(metadata.dependencies ?? {}).sort()) {
      if (dependency.startsWith('@codingame/'))
        visit(dependency, childRequire)
    }
  }
  const require = createRequire(join(root, 'package.json'))
  for (const dependency of Object.keys({ ...rootMetadata.dependencies, ...rootMetadata.devDependencies }).sort()) {
    if (dependency.startsWith('@codingame/'))
      visit(dependency, require)
  }
  return packages
}

function walkFiles(directory, extensions, excludeTests = false) {
  if (!existsSync(directory))
    return []
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'generated')
      continue
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, extensions, excludeTests))
    }
    else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      if (excludeTests && /\.test\./.test(entry.name))
        continue
      files.push(fullPath)
    }
  }
  return files.sort()
}

function resolveEsmSpecifier(specifier, fromFile, cache) {
  const key = `${dirname(fromFile)}::${specifier}`
  if (cache.has(key))
    return cache.get(key)

  let resolved = null
  if (specifier.startsWith('.')) {
    const base = resolve(dirname(fromFile), specifier)
    for (const candidate of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js')]) {
      if (existsSync(candidate)) {
        resolved = realpathSync(candidate)
        break
      }
    }
  }
  else {
    const candidates = specifier === '@codingame/monaco-vscode-api'
      ? ['@codingame/monaco-vscode-api/services', specifier]
      : [specifier]
    for (const candidate of candidates) {
      try {
        const url = import.meta.resolve(candidate, pathToFileURL(fromFile).href)
        if (url.startsWith('file:')) {
          resolved = realpathSync(fileURLToPath(url))
          break
        }
      }
      catch {}
    }
  }

  cache.set(key, resolved)
  return resolved
}

/**
 * Traces only the Monaco/VS Code ESM modules reachable from `src/` so unused
 * workbench features (chat, debug, terminal, MCP, userDataSync, views, etc.)
 * do not bloat the shipped Chinese NLS catalog.
 */
export function collectReachableMonacoFiles(root = repository) {
  const srcDirectory = join(root, 'src')
  const sourceFiles = walkFiles(srcDirectory, ['.ts', '.tsx', '.js', '.mjs'], true)
  const entrySpecifiers = new Set()

  for (const file of sourceFiles) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(SRC_IMPORT_RE))
      entrySpecifiers.add(match[1])
  }

  const cache = new Map()
  const visited = new Set()
  const queue = []
  const rootAnchor = join(root, 'package.json')

  for (const specifier of [...entrySpecifiers].sort()) {
    const target = resolveEsmSpecifier(specifier, rootAnchor, cache)
    if (target && !visited.has(target)) {
      visited.add(target)
      queue.push(target)
    }
  }

  while (queue.length > 0) {
    const file = queue.pop()
    if (!file.endsWith('.js') && !file.endsWith('.mjs'))
      continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(PKG_IMPORT_RE)) {
      const specifier = match[1]
      if (!specifier.startsWith('.') && !specifier.startsWith('@codingame/') && !specifier.startsWith('vscode/'))
        continue
      if (SKIP_ASSET_RE.test(specifier))
        continue
      const next = resolveEsmSpecifier(specifier, file, cache)
      if (next && !visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }

  return [...visited].sort()
}

function writeIfChanged(path, content) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== content)
    writeFileSync(path, content)
}

export function subsetNlsMessages(original, used) {
  if (!Array.isArray(original) || !used.size)
    throw new Error('Expected an indexed VS Code language catalog and numeric localization calls')
  for (const id of used) {
    if (!Number.isInteger(id) || id < 0 || id >= original.length)
      throw new Error(`NLS index ${id} is outside the installed language catalog`)
  }
  // Keep the original numeric IDs. Missing entries retain VS Code's upstream
  // English fallback behavior; shifting IDs would translate unrelated labels.
  return original.map((value, index) => used.has(index) ? value : null)
}

export function encodeSparseNlsMessages(subset) {
  const entries = {}
  for (let index = 0; index < subset.length; index++) {
    const value = subset[index]
    if (value !== null && value !== undefined)
      entries[String(index)] = value
  }
  return { length: subset.length, entries }
}

export async function generateMonacoNls(root = repository, outputDirectory = join(root, 'src/lib/monaco/generated')) {
  const packages = collectMonacoPackages(root)
  const languagePack = [...packages].find(([, pkg]) => pkg.name === '@codingame/monaco-vscode-language-pack-zh-hans')
  if (!languagePack)
    throw new Error('The Chinese VS Code language pack must be installed')
  const [languageDirectory, languageMetadata] = languagePack
  for (const [, metadata] of packages) {
    if (metadata.version !== languageMetadata.version)
      throw new Error(`NLS package versions differ: ${metadata.name}@${metadata.version}, language pack ${languageMetadata.version}`)
  }

  const reachableFiles = collectReachableMonacoFiles(root)
  const filesToScan = reachableFiles.length > 0
    ? reachableFiles
    : [...packages.keys()].flatMap(directory => walkFiles(directory, ['.js']))

  const used = new Set()
  for (const file of filesToScan) {
    for (const id of collectNlsIds(readFileSync(file, 'utf8'), file))
      used.add(id)
  }

  const { default: original } = await import(pathToFileURL(join(languageDirectory, 'translations/main.i18n.json.js')).href)
  const subset = subsetNlsMessages(original, used)
  const encoded = encodeSparseNlsMessages(subset)
  const source = readFileSync(join(languageDirectory, 'index.js'), 'utf8')
  const manifestMatch = source.match(/^const manifest = (.+);$/m)
  if (!manifestMatch)
    throw new Error('Cannot read the official language pack manifest')
  const manifest = JSON.parse(manifestMatch[1])
  for (const localization of manifest.contributes.localizations)
    localization.translations = localization.translations.filter(item => ['vscode', 'vscode.theme-defaults'].includes(item.id))
  const themeTranslations = JSON.parse(readFileSync(join(languageDirectory, 'translations/extensions/vscode.theme-defaults.i18n.json'), 'utf8'))
  const directory = outputDirectory
  mkdirSync(directory, { recursive: true })
  const encodedJson = `${JSON.stringify(encoded)}\n`
  writeIfChanged(join(directory, 'zh-cn-messages.json'), encodedJson)
  writeIfChanged(join(directory, 'zh-cn-localization.json'), `${JSON.stringify({
    manifest,
    extensionTranslations: {
      'vscode.theme-defaults': `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(themeTranslations))}`,
    },
  }, null, 2)}\n`)
  const summary = {
    version: languageMetadata.version,
    packages: packages.size,
    files: filesToScan.length,
    usedMessages: used.size,
    totalMessages: original.length,
    originalBytes: Buffer.byteLength(JSON.stringify(original)),
    subsetBytes: Buffer.byteLength(encodedJson),
  }
  console.log(JSON.stringify(summary))
  return summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await generateMonacoNls()
