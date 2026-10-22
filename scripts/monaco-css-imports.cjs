// Monaco supports both CSS modules for Shadow DOM and ordinary document CSS.
// This app uses document roots, with Next extracting CSS and resolving assets.
// Next 16.4 rejects namespace imports from global CSS; preserve each side effect
// and supply an empty module to Monaco's optional Shadow DOM registration hook.
module.exports = function monacoCssImports(source) {
  return source.replace(
    /^import \* as ([\w$]+) from (['"])([^'"\n]+\.css)\2;?$/gm,
    (_, name, quote, path) => `import ${quote}${path}${quote}; const ${name} = {};`,
  )
}
