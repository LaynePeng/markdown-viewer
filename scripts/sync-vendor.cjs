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
  ['node_modules/mermaid/dist/mermaid.min.js', 'mermaid.min.js']
];

for (const [src, dst] of files) {
  fs.copyFileSync(path.join(root, src), path.join(vendorDir, dst));
  console.log('copied', src, '->', 'renderer/vendor/' + dst);
}