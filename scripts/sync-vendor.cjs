const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'renderer', 'vendor');
fs.mkdirSync(vendorDir, { recursive: true });

const files = [
  ['node_modules/github-markdown-css/github-markdown.css', 'github-markdown.css'],
  ['node_modules/highlight.js/styles/github.css', 'highlight-github.css'],
  ['node_modules/highlight.js/styles/github-dark.css', 'highlight-github-dark.css'],
  ['node_modules/marked/lib/marked.umd.js', 'marked.umd.js'],
  ['node_modules/mermaid/dist/mermaid.min.js', 'mermaid.min.js'],
  ['node_modules/turndown/dist/turndown.js', 'turndown.js'],
  ['node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js', 'turndown-plugin-gfm.js'],
  ['node_modules/@plantuml/core/plantuml.js', 'plantuml.js'],
  ['node_modules/@plantuml/core/viz-global.js', 'viz-global.js'],
  ['node_modules/katex/dist/katex.min.js', 'katex.min.js'],
  ['node_modules/katex/dist/katex.min.css', 'katex.min.css']
];

for (const [src, dst] of files) {
  fs.copyFileSync(path.join(root, src), path.join(vendorDir, dst));
  console.log('copied', src, '->', 'renderer/vendor/' + dst);
}

const katexFontsSrc = path.join(root, 'node_modules/katex/dist/fonts');
const katexFontsDst = path.join(vendorDir, 'fonts');
fs.rmSync(katexFontsDst, { recursive: true, force: true });
fs.mkdirSync(katexFontsDst, { recursive: true });
for (const name of fs.readdirSync(katexFontsSrc)) {
  if (name.endsWith('.woff2')) fs.copyFileSync(path.join(katexFontsSrc, name), path.join(katexFontsDst, name));
}
console.log('copied', 'node_modules/katex/dist/fonts/*.woff2', '->', 'renderer/vendor/fonts');