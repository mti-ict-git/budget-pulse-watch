/* Namespace vendor classes to avoid Bootstrap !important utility collisions
 * with Tailwind. Keep canonical captured vendor assets unchanged. */
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const project = path.resolve(__dirname, '..');
const vendor = 'public/merdeka/services.merdekacoppergold.com/assets/v2/css';
let css = '/* Generated from public/merdeka; run node scripts/generate-merdeka-css.cjs. */\n@layer merdeka-source {\n';
for (const file of ['constant.css', 'apps.min-0c4941c9.css', 'custom.css']) {
  const filename = path.join(project, vendor, file);
  const ast = postcss.parse(fs.readFileSync(filename, 'utf8'), { from: filename });
  ast.walkAtRules(rule => { if (['import', 'charset'].includes(rule.name)) rule.remove(); });
  ast.walkComments(comment => { if (/sourceMappingURL/.test(comment.text)) comment.remove(); });
  ast.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    rule.selector = selectorParser(selectors => {
      selectors.walkClasses(node => { node.value = `mdka-v-${node.value}`; });
    }).processSync(rule.selector);
  });
  ast.walkDecls(decl => {
    decl.value = decl.value.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (match, quote, value) => {
      if (/^(data:|https?:|\/|#)/.test(value)) return match;
      return `url("${path.posix.normalize(`/merdeka/services.merdekacoppergold.com/assets/v2/css/${value}`)}")`;
    });
  });
  css += `/* ${file} */\n${ast.toString()}\n`;
}
fs.mkdirSync(path.join(project, 'src/styles'), { recursive: true });
fs.writeFileSync(path.join(project, 'src/styles/merdeka-vendor.generated.css'), css + '}\n');
console.log('Generated namespaced Merdeka CSS adapter');
