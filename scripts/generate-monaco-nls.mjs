import { readFileSync, readdirSync, realpathSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
          throw new Error(`Non-static NLS index in ${filename}: ${node.getText(ast).slice(0,120)}`)
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

function javascriptFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules')
      continue
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...javascriptFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.js'))
      files.push(path)
  }
  return files.sort()
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

export async function generateMonacoNls(root = repository, outputDirectory = join(root, 'src/lib/monaco/generated')) {
  const packages = collectMonacoPackages(root)
  const languagePack = [...packages].find(([, pkg]) => pkg.name === '@codingame/monaco-vscode-language-pack-zh-hans')
  if (!languagePack)
    throw new Error('The Chinese VS Code language pack must be installed')
  const [languageDirectory, languageMetadata] = languagePack
  const used = new Set()
  let files = 0
  for (const [directory, metadata] of packages) {
    if (metadata.version !== languageMetadata.version)
      throw new Error(`NLS package versions differ: ${metadata.name}@${metadata.version}, language pack ${languageMetadata.version}`)
    for (const file of javascriptFiles(directory)) {
      files++
      for (const id of collectNlsIds(readFileSync(file, 'utf8'), file))
        used.add(id)
    }
  }
  const { default: original } = await import(pathToFileURL(join(languageDirectory, 'translations/main.i18n.json.js')).href)
  const messages = subsetNlsMessages(original, used)
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
  writeIfChanged(join(directory, 'zh-cn-messages.json'), `${JSON.stringify(messages)}\n`)
  writeIfChanged(join(directory, 'zh-cn-localization.json'), `${JSON.stringify({
    manifest,
    extensionTranslations: {
      'vscode.theme-defaults': `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(themeTranslations))}`,
    },
  }, null, 2)}\n`)
  const summary = {
    version: languageMetadata.version, packages: packages.size, files,
    usedMessages: used.size, totalMessages: original.length,
    originalBytes: Buffer.byteLength(JSON.stringify(original)),
    subsetBytes: Buffer.byteLength(JSON.stringify(messages)),
  }
  console.log(JSON.stringify(summary))
  return summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await generateMonacoNls()
