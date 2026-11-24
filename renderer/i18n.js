/* Runfjord — translation core
   Each language lives in renderer/locales/<code>.js and calls I18N.register(code, nativeName, strings).
   Works in the renderer (window.I18N) and in the main process (require + global.I18N).

   Add a language: copy locales/en.js to locales/<code>.js, translate the values, and add <code> to CODES below.
   Plural keys end in _one/_other, and may also have _zero/_two/_few/_many for languages that need them
   (the right form is picked with Intl.PluralRules). */
(function (root) {
  'use strict';

  // every shipped language, in file-name form
  const CODES = [
    'en', 'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'es', 'fa', 'fi', 'fr', 'he', 'hi', 'hr', 'hu', 'id', 'it',
    'ja', 'ko', 'ms', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sv', 'sw', 'th', 'tr', 'uk', 'vi', 'zh-CN', 'zh-TW',
  ];
  const RTL = new Set(['ar', 'he', 'fa']);

  const S = {};
  const NAMES = {};
  let current = 'en';

  function register(code, name, strings) { S[code] = strings; NAMES[code] = name; }
  const has = (c) => !!S[c];
  function languages() {
    const list = Object.keys(S).map((code) => ({ code, name: NAMES[code] }));
    return list.sort((a, b) => (a.code === 'en' ? -1 : b.code === 'en' ? 1 : a.name.localeCompare(b.name, 'en')));
  }

  // Map system locale tags (e.g. "nb-NO", "zh-Hant-TW", "pt-BR", "iw") to a shipped language
  function resolve(tags) {
    for (const raw of [].concat(tags || [])) {
      if (!raw) continue;
      const tag = String(raw).toLowerCase().replace(/_/g, '-');
      const parts = tag.split('-');
      const base = parts[0];
      if (base === 'zh') {
        const trad = parts.includes('hant') || parts.includes('tw') || parts.includes('hk') || parts.includes('mo');
        return has(trad ? 'zh-TW' : 'zh-CN') ? (trad ? 'zh-TW' : 'zh-CN') : 'en';
      }
      const alias = { no: 'nb', nn: 'nb', iw: 'he', in: 'id', fil: 'en', tl: 'en' }[base] || base;
      if (has(alias)) return alias;
    }
    return 'en';
  }
  function setLang(code) { current = has(code) ? code : 'en'; return current; }
  function getLang() { return current; }
  function isRTL(code = current) { return RTL.has(code); }

  function fill(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  function lookup(key) {
    if (S[current] && S[current][key] != null) return S[current][key];
    if (S.en && S.en[key] != null) return S.en[key];
    return null;
  }
  // t('key', {vars}) — falls back to English, then to the key itself
  function t(key, vars) { const s = lookup(key); return fill(s == null ? key : s, vars); }
  // tn('key', n, {vars}) — picks key_zero/_one/_two/_few/_many/_other using the language's plural rules
  function tn(key, n, vars) {
    let cat = 'other';
    try { cat = new Intl.PluralRules(current === 'zh-CN' || current === 'zh-TW' ? 'zh' : current).select(n); } catch {}
    const order = [cat, 'other', 'one'];
    let s = null;
    for (const c of order) {
      const v = S[current] && S[current][`${key}_${c}`];
      if (v != null) { s = v; break; }
    }
    if (s == null) s = (S.en && (S.en[`${key}_${n === 1 ? 'one' : 'other'}`])) || key;
    return fill(s, Object.assign({ n }, vars));
  }

  const I18N = { CODES, register, languages, resolve, setLang, getLang, isRTL, t, tn,
    get LANGUAGES() { return languages(); }, get STRINGS() { return S; } };

  if (typeof module !== 'undefined' && module.exports) {
    // main process: load every locale file
    global.I18N = I18N;
    const path = require('path');
    for (const c of CODES) { try { require(path.join(__dirname, 'locales', c + '.js')); } catch (e) { /* missing locale: skip */ } }
    module.exports = I18N;
  } else {
    root.I18N = I18N;
  }
})(typeof self !== 'undefined' ? self : this);
