const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Rollup is already installed by the web/Vite lockfile; no new dependency.
const { parseAst } = require('../../web/node_modules/rollup/dist/parseAst.js');

const markers = [/GLTFLoader/, /THREE\./, /three\.module/i, /(?:^|["'])three\/(?:addons|src|build)\//i];

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

function inspectStaticGraph(entry, dist) {
  const visited = new Set();
  function inspect(file) {
    assert(file.startsWith(path.resolve(dist) + path.sep), 'Static import escapes production dist');
    if (visited.has(file)) return;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    const ast = parseAst(source);
    // Vite records lazy dependency filenames in the main entry. A filename is
    // not Three implementation code; actual static imports are followed below.
    const paths = [];
    walk(ast, node => {
      if (node.type === 'Literal' && typeof node.value === 'string' && /^(?:\.?\.?\/|assets\/)[^\s]+\.js$/.test(node.value)) paths.push([node.start, node.end]);
    });
    let code = source;
    for (const [start, end] of paths.sort((a, b) => b[0] - a[0])) code = code.slice(0, start) + ' '.repeat(end - start) + code.slice(end);
    const marker = markers.find(pattern => pattern.test(code));
    assert(!marker, `Three.js statically included in production entry graph: ${path.relative(dist, file)} (${marker})`);
    for (const node of ast.body) {
      if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) || !node.source) continue;
      const specifier = node.source.value;
      assert(specifier.startsWith('./') || specifier.startsWith('../'), `Non-local production static import: ${specifier}`);
      inspect(path.resolve(path.dirname(file), specifier));
    }
  }
  inspect(path.resolve(entry));
  return [...visited];
}
module.exports = { inspectStaticGraph };
