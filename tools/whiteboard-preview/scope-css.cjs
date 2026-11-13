// Preserve reference declarations; isolate every selector from the formal site.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const selectors = require('postcss-selector-parser');
const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'apps/web/components/whiteboard/original/reference.unscoped.css.txt');
const css = postcss.parse(fs.readFileSync(source, 'utf8'));
css.walkRules(rule => {
  let parent = rule.parent;
  while (parent) { if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return; parent = parent.parent; }
  rule.selector = selectors(selectorsRoot => {
    selectorsRoot.each(selector => {
      let hasRoot = false;
      selector.walk(node => {
        if ((node.type === 'pseudo' && node.value === ':root') || (node.type === 'tag' && ['html','body'].includes(node.value))) {
          node.replaceWith(selectors.className({ value: 'wbr-preview' })); hasRoot = true;
        }
      });
      if (!hasRoot) selector.prepend(selectors.combinator({ value: ' ' })), selector.prepend(selectors.className({ value: 'wbr-preview' }));
    });
  }).processSync(rule.selector).replace(/\.wbr-preview\s+\.wbr-preview/g, '.wbr-preview');
});
css.walkDecls(decl => { decl.value = decl.value.replace(/\.\.\/\.\.\/fonts\//g,'/whiteboard-original/fonts/'); });
const reset = '.wbr-preview{isolation:isolate;display:block;min-height:100vh}.wbr-preview :where(*:not(svg,svg *)){all:revert;box-sizing:border-box}\n';
fs.writeFileSync(path.join(root, 'apps/web/public/whiteboard-original/reference.css'), reset + css.toString());
console.log('Scoped original CSS without changing its design values.');
