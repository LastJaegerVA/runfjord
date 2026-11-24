// node tools/check-locales.js  — verifies every locale has every key and the same {placeholders}
const path = require('path');
const I = require('../renderer/i18n.js');
const en = I.STRINGS.en; const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');
const enKeys = new Set(Object.keys(en).map(base));
let problems = 0;
for (const { code, name } of I.LANGUAGES) {
  const L = I.STRINGS[code]; const keys = new Set(Object.keys(L).map(base));
  const miss = [...enKeys].filter((k) => !keys.has(k)), extra = [...keys].filter((k) => !enKeys.has(k));
  const ph = Object.keys(L).filter((k) => {
    const ek = en[k] ?? en[base(k) + '_other']; if (ek == null) return false;
    const norm = (s) => (s.match(/\{\w+\}/g) || []).filter((x) => x !== '{file}' && x !== '{n}').sort().join();
    return norm(ek) !== norm(L[k]);
  });
  const empty = Object.keys(L).filter((k) => !String(L[k]).trim());
  const bad = miss.length + extra.length + ph.length + empty.length; problems += bad;
  console.log(`${code.padEnd(6)} ${name.padEnd(14)} ${Object.keys(L).length} ${bad ? `MISSING:${miss} EXTRA:${extra} PH:${ph} EMPTY:${empty}` : 'ok'}`);
}
console.log(I.LANGUAGES.length, 'languages,', problems, 'problems');
process.exit(problems ? 1 : 0);
