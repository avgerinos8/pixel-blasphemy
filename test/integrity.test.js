// PixelBlasphemy Studio - Static Code & DOM Integrity Suite
// Checks: HTML tag balances, duplicate IDs, missing references, CSS syntax, root CSS variables.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'app', 'index.html');
const jsPath = path.join(ROOT, 'app', 'app.js');
const cssPath = path.join(ROOT, 'app', 'style.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function assert(desc, condition, details = null) {
  if (condition) {
    results.passed++;
    console.log(`  [PASS] ${desc}`);
  } else {
    results.failed++;
    console.error(`  [FAIL] ${desc}`);
    if (details) console.error(`         Details:`, details);
  }
}

function runIntegrityTests() {
  console.log('=== RUNNING CODE & DOM INTEGRITY TESTS ===\n');

  // 1. Check unclosed HTML tags
  let stack = [];
  const reTag = /<\/?([a-z0-9]+)(?:\s+[^>]*?)?(\/?)>/gi;
  let match;
  while ((match = reTag.exec(html)) !== null) {
    let [full, tag, selfClose] = match;
    tag = tag.toLowerCase();
    if (['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tag) || selfClose === '/') continue;
    if (full.startsWith('</')) {
      if (stack.length > 0 && stack[stack.length - 1].tag === tag) {
        stack.pop();
      } else {
        assert(`Unmatched closing tag </${tag}>`, false, { index: match.index });
      }
    } else {
      stack.push({ tag, index: match.index });
    }
  }
  assert('HTML tag nesting balance (zero unclosed tags)', stack.length === 0, stack);

  // 2. Duplicate IDs in HTML
  const htmlIds = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m => m[1]);
  const idCounts = {};
  htmlIds.forEach(id => { idCounts[id] = (idCounts[id] || 0) + 1; });
  const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
  assert('No duplicate element IDs in index.html', duplicates.length === 0, duplicates);

  // 3. Missing IDs referenced by JS
  const getElemMatches = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
  const querySelectorMatches = [...js.matchAll(/querySelector\(['"]#([^'"]+)['"]\)/g)].map(m => m[1]);
  const allReferencedIds = new Set([...getElemMatches, ...querySelectorMatches]);
  const htmlIdSet = new Set(htmlIds);
  const missingIds = [...allReferencedIds].filter(id => !htmlIdSet.has(id));
  assert('All element IDs referenced in JS exist in HTML', missingIds.length === 0, missingIds);

  // 4. CSS brace balance
  let cssDepth = 0;
  for (let ch of css) {
    if (ch === '{') cssDepth++;
    if (ch === '}') cssDepth--;
  }
  assert('CSS brace depth balance equals 0', cssDepth === 0, { finalDepth: cssDepth });

  // 5. CSS variables defined in :root
  const rootBlockMatch = css.match(/:root\s*\{([^}]+)\}/);
  const definedVars = new Set();
  if (rootBlockMatch) {
    const varMatches = [...rootBlockMatch[1].matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)];
    varMatches.forEach(m => definedVars.add(m[1]));
  }
  const usedVars = [...css.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  const undefinedVars = [...new Set(usedVars)].filter(v => !definedVars.has(v));
  assert('All var(--...) used in CSS are defined in :root', undefinedVars.length === 0, undefinedVars);

  // 6. Dangerous JS patterns
  const badPatterns = [
    { name: 'Unescaped literal bugs', pattern: /undefined\./ },
    { name: 'Accidental assignment in if condition', pattern: /if\s*\([^)=!<>]*(?<![=!<>])=(?!=)[^)]*\)/ }
  ];

  badPatterns.forEach(({ name, pattern }) => {
    const hits = js.match(pattern);
    assert(`No ${name}`, !hits, hits ? hits[0] : null);
  });

  console.log(`\nINTEGRITY TESTS: PASSED: ${results.passed} | FAILED: ${results.failed}`);
  if (results.failed > 0) process.exit(1);
}

if (require.main === module) {
  runIntegrityTests();
}

module.exports = { runIntegrityTests };
