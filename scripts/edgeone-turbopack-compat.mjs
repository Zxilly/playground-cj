import { createHash } from 'node:crypto'
const originalHash = 'f45add8b2aa122b943e1af19c5bed74af1340a8d28cd56ecc51021593cf34d77'
const signature = 'function installCompressedModuleFactories(chunkModules, offset) {'

// Match Next 16.4's compressed module format: an optional strict group followed
// by flat groups. Preserve one factory identity across aliases and duplicate
// chunks. This is limited to EdgeOne's generated runtime, not application chunks.
const replacement = `function installCompressedModuleFactories(chunkModules, offset) {
  // playground-cj: Next 16.4 strict groups and factory aliases.
  let i = offset || 0;
  if (Array.isArray(chunkModules[i])) {
    installCompressedModuleFactories(chunkModules[i], 0);
    i++;
  }
  while (i < chunkModules.length) {
    let end = i + 1;
    while (end < chunkModules.length && typeof chunkModules[end] !== 'function') {
      end++;
    }
    if (end === chunkModules.length) {
      throw new Error('malformed chunk format, expected a factory function');
    }
    let factory = chunkModules[end];
    for (let j = i; j < end; j++) {
      if (moduleFactories.has(chunkModules[j])) {
        factory = moduleFactories.get(chunkModules[j]);
        break;
      }
    }
    for (; i < end; i++) {
      if (!moduleFactories.has(chunkModules[i])) {
        moduleFactories.set(chunkModules[i], factory);
      }
    }
    i = end + 1;
  }
}`

export function transformEdgeOneTurbopack(source) {
  source = source.replaceAll('\r\n', '\n')
  const start = source.indexOf(signature)
  const end = source.indexOf('\n}\n', start) + 2
  if (start < 0 || end < start || source.indexOf(signature, start + 1) >= 0)
    throw new Error('Unrecognized EdgeOne Turbopack installer; review the adapter before deploying')
  const original = source.slice(start, end)
  if (original === replacement)
    return source
  if (createHash('sha256').update(original).digest('hex') !== originalHash)
    throw new Error('EdgeOne Turbopack installer changed; review the adapter before deploying')
  return source.slice(0, start) + replacement + source.slice(end)
}
