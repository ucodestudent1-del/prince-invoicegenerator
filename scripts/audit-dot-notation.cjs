// Audit dot-notation access patterns in src/
// Scans .ts and .tsx files for `<ident>.<prop>(` style or `<ident>.<prop>(` followed by access
const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/New User/Desktop/prince-invoice-generator/src';
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);
const EXT = new Set(['.ts', '.tsx']);

// Identifiers that often hold optional/null-prone values
const WATCH = new Set([
  'user','project','invoice','estimate','customer','expense','item',
  'state','input','form','organization','prisma','db','result','data',
  'error','params','searchParams','session','address','client','team',
  'recurring','changeOrder','portal','report','catalog','feature','setting',
  'billing','vendor','supplier','token','cookie','header','body',
  'config','env','options','meta','args','props','children','style',
  'theme','locale','message','messages','dictionary','translations',
  'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(e.name))) yield p;
  }
}

// Heuristic: only flag if the LHS is in WATCH, and the property access
// does not use optional chaining `?.` and is followed by a safe character
// (i.e. NOT preceded by a guard, and the property is non-static).
// We then categorise by line context.
const re = /(?<![?$.A-Za-z0-9_])([A-Za-z_$][A-Za-z0-9_$]*)\.([A-Za-z_$][A-Za-z0-9_$]*)\b/g;

let totalFiles = 0;
let totalHits = 0;
const byFile = {};

for (const f of walk(SRC)) {
  totalFiles++;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const [, lhs, prop] = m;
      if (!WATCH.has(lhs)) continue;
      // Skip well-known safe non-null accessors
      if (prop === 'length' || prop === 'name' || prop === 'toString' || prop === 'valueOf' || prop === 'constructor') continue;
      if (prop === 'toFixed' || prop === 'toUpperCase' || prop === 'toLowerCase' || prop === 'trim' || prop === 'replace' || prop === 'split' || prop === 'join' || prop === 'map' || prop === 'filter' || prop === 'forEach' || prop === 'find' || prop === 'some' || prop === 'every' || prop === 'reduce' || prop === 'push' || prop === 'pop' || prop === 'shift' || prop === 'unshift' || prop === 'slice' || prop === 'splice' || prop === 'concat' || prop === 'indexOf' || prop === 'includes' || prop === 'startsWith' || prop === 'endsWith' || prop === 'sort' || prop === 'reverse' || prop === 'entries' || prop === 'keys' || prop === 'values' || prop === 'then' || prop === 'catch' || prop === 'finally') continue;
      // Skip obvious non-object access: console.log, Math, etc.
      if (lhs === 'console' || lhs === 'Math' || lhs === 'JSON' || lhs === 'Object' || lhs === 'Array' || lhs === 'String' || lhs === 'Number' || lhs === 'Date' || lhs === 'Promise' || lhs === 'Boolean') continue;
      totalHits++;
      if (!byFile[f]) byFile[f] = [];
      byFile[f].push({ line: i + 1, lhs, prop, text: line.trim() });
    }
  }
}

const out = [];
out.push(`# Dot-notation audit`);
out.push(`Scanned ${totalFiles} files in src/`);
out.push(`Total suspect hits: ${totalHits}`);
out.push('');
for (const [f, hits] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  out.push(`## ${f.replace(SRC, 'src')}`);
  out.push(`Hits: ${hits.length}`);
  for (const h of hits) {
    out.push(`- L${h.line}  \`${h.lhs}.${h.prop}\`  — ${h.text}`);
  }
  out.push('');
}
fs.writeFileSync('C:/Users/New User/Desktop/prince-invoice-generator/docs/audits/dot-notation-audit.md', out.join('\n'));
console.log('Wrote audit. Total hits:', totalHits);
console.log('Files with hits:', Object.keys(byFile).length);
