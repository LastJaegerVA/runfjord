'use strict';
/* ================================================================
   Runfjord — renderer
   ================================================================ */
/* window.api is exposed by preload.js */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- constants ----------
const LANGS = {
  sh:   { label: 'SH',  name: 'Bash',        color: '#3ccf8e' },
  bash: { label: 'SH',  name: 'Bash',        color: '#3ccf8e' },
  zsh:  { label: 'ZSH', name: 'Zsh',         color: '#34d3a0' },
  fish: { label: 'FSH', name: 'Fish',        color: '#2fd3d3' },
  py:   { label: 'PY',  name: 'Python',      color: '#4b9fff' },
  js:   { label: 'JS',  name: 'JavaScript',  color: '#f2d343' },
  mjs:  { label: 'JS',  name: 'JavaScript',  color: '#f2d343' },
  cjs:  { label: 'JS',  name: 'JavaScript',  color: '#f2d343' },
  ts:   { label: 'TS',  name: 'TypeScript',  color: '#3d8bff' },
  ps1:  { label: 'PS',  name: 'PowerShell',  color: '#38b6f0' },
  bat:  { label: 'BAT', name: 'Batch',       color: '#c49bff' },
  cmd:  { label: 'CMD', name: 'Batch',       color: '#c49bff' },
  rb:   { label: 'RB',  name: 'Ruby',        color: '#ff5d6c' },
  pl:   { label: 'PL',  name: 'Perl',        color: '#9aa6ff' },
  lua:  { label: 'LUA', name: 'Lua',         color: '#6c7cff' },
  php:  { label: 'PHP', name: 'PHP',         color: '#8892ff' },
};
const NEW_TEMPLATES = [
  { ext: 'sh',  tpl: (d) => `#!/usr/bin/env bash\n# ${d}\n\nset -euo pipefail\n\necho "Hello from $(basename "$0")"\n` },
  { ext: 'py',  tpl: (d) => `#!/usr/bin/env python3\n"""${d}"""\n\n\ndef main():\n    print("Hello!")\n\n\nif __name__ == "__main__":\n    main()\n` },
  { ext: 'js',  tpl: (d) => `#!/usr/bin/env node\n// ${d}\n\nconsole.log('Hello!');\n` },
  { ext: 'ps1', tpl: (d) => `<#\n  ${d}\n#>\n\nWrite-Host "Hello!"\n` },
  { ext: 'bat', tpl: (d) => `@echo off\nREM ${d}\n\necho Hello!\n` },
  { ext: 'fish',tpl: (d) => `#!/usr/bin/env fish\n# ${d}\n\necho "Hello!"\n` },
];
const CAT_COLORS = ['#7c6cff', '#3ccf8e', '#4b9fff', '#f5b84a', '#ff5d6c', '#2fd3d3', '#ff7ad9', '#a3e635', '#ff9548', '#9aa6ff'];
const ACCENTS = ['#7c6cff', '#4b9fff', '#2fc6c6', '#3ccf8e', '#f5a524', '#ff6b6b', '#ff5fb8', '#a06bff'];
const EMOJIS = ['', '⚙️', '🚀', '🧹', '💾', '🔄', '📦', '🔧', '🖥️', '🌐', '🔒', '📊', '🎮', '🎵', '📁', '🐧', '🪟', '⚡', '🧪', '🗑️'];

// ---------- state ----------
let lib = { scripts: [], categories: [], settings: {} };
const ui = {
  view: 'all', selectedId: null, search: '', sort: 'name', tab: 'overview',
  outputs: {}, running: new Set(), exitInfo: {}, missing: new Set(), code: {},
  platform: 'linux',
};

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const basename = (p) => p.split(/[\\/]/).pop();
const dirname = (p) => p.replace(/[\\/][^\\/]*$/, '');
const extOf = (p) => { const m = basename(p).match(/\.([^.]+)$/); return m ? m[1].toLowerCase() : ''; };
const { t, tn } = window.I18N;
const langOf = (p) => LANGS[extOf(p)] || { label: (extOf(p) || 'bin').slice(0, 3).toUpperCase(), name: extOf(p) ? t('ext_file', { ext: extOf(p).toUpperCase() }) : t('executable'), color: '#a3abc2' };
const prettyName = (p) => basename(p).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const getScript = (id) => lib.scripts.find((s) => s.id === id);
const catColor = (name) => (lib.categories.find((c) => c.name === name) || {}).color || '#a3abc2';
const MARK = (id) => `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, var(--accent) 55%, #ffffff)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient><clipPath id="${id}c"><rect width="64" height="64" rx="15"/></clipPath></defs><g clip-path="url(#${id}c)"><rect width="64" height="64" fill="#0c1222"/><g fill="none" stroke-linecap="round" stroke-width="1.6" style="stroke:var(--accent)" stroke-opacity=".45"><path d="M0 12 C8 12 13 13.5 18 15 L60 26"/><path d="M0 52 C8 52 13 50.5 18 49 L60 38"/></g><path d="M0 18 C6 18 11 19.5 16 21 L50 29.5 Q54 32 50 34.5 L16 43 C11 44.5 6 46 0 46 Z" fill="url(#${id})"/><rect x="7" y="27" width="18" height="3.4" rx="1.7" fill="#fff" fill-opacity=".92"/><rect x="7" y="33.6" width="12" height="3.4" rx="1.7" fill="#fff" fill-opacity=".6"/></g></svg>`;
const icon = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  open: '<path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3M14.5 12v6M11.5 15h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  cmd: '<path d="M5 8l4 4-4 4M12 16h7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
  clear: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};

function timeAgo(ts) {
  if (!ts) return t('never');
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return t('just_now');
  const m = Math.floor(s / 60); if (m < 60) return t('min_ago', { n: m });
  const h = Math.floor(m / 60); if (h < 24) return t('h_ago', { n: h });
  const d = Math.floor(h / 24); if (d < 7) return tn('days_ago', d);
  return fmtDate(ts);
}
const KEY = () => (window.I18N.getLang() === 'de' ? 'Strg' : 'Ctrl');
const themeName = (th) => t('theme_' + th.id);
const fmtDate = (ts) => new Date(ts).toLocaleDateString(window.I18N.getLang());
const fmtMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} m ${Math.round((ms % 60000) / 1000)} s`);
const fmtSize = (b) => (b == null ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2800);
}

let saveTimer;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => api.saveLibrary(lib), 250); }

function badgeHTML(s, size = '') {
  const L = langOf(s.path);
  const c = s.color || L.color;
  const inner = s.icon ? `<span class="emoji">${esc(s.icon)}</span>` : esc(L.label);
  return `<div class="badge ${size}" style="--c:${c}">${inner}${ui.running.has(s.id) ? '<span class="run-dot"></span>' : ''}</div>`;
}

// Pull a description out of a script's leading comment block
function parseHeader(text) {
  if (!text) return '';
  let lines = text.split(/\r?\n/);
  if (lines[0]?.startsWith('#!')) lines = lines.slice(1);
  while (lines.length && !lines[0].trim()) lines.shift();
  if (!lines.length) return '';
  const first = lines[0].trim();
  const out = [];
  const docq = first.match(/^[rRuU]?("""|''')/);
  if (docq) {
    const q = docq[1];
    let rest = first.slice(first.indexOf(q) + 3);
    if (rest.includes(q)) return rest.slice(0, rest.indexOf(q)).trim();
    out.push(rest);
    for (const l of lines.slice(1)) { if (l.includes(q)) { out.push(l.slice(0, l.indexOf(q))); break; } out.push(l); }
  } else if (first.startsWith('<#')) {
    out.push(first.slice(2));
    for (const l of lines.slice(1)) { if (l.includes('#>')) { out.push(l.slice(0, l.indexOf('#>'))); break; } out.push(l); }
  } else if (first.startsWith('/*')) {
    out.push(first.slice(2));
    for (const l of lines.slice(1)) { if (l.includes('*/')) { out.push(l.slice(0, l.indexOf('*/'))); break; } out.push(l.replace(/^\s*\*\s?/, '')); }
  } else {
    const re = /^\s*(#|\/\/|--|;|REM\b|::)\s?/i;
    for (const l of lines) {
      if (/^\s*@?echo off/i.test(l)) continue;
      if (!re.test(l)) break;
      out.push(l.replace(re, ''));
    }
  }
  const cleaned = out.map((l) => l.trim()).filter((l) => !/^[-=#*_\s]{3,}$/.test(l));
  // stop at first blank line after content (first paragraph-ish, keep up to ~6 lines)
  const para = [];
  for (const l of cleaned) { if (!l && para.length) break; if (l) para.push(l); if (para.length >= 6) break; }
  return para.join('\n').replace(/^(description|desc)\s*:\s*/i, '').trim();
}

// ================================================================
// filtering
// ================================================================
function visibleScripts() {
  let arr = lib.scripts.slice();
  const v = ui.view;
  if (v === 'fav') arr = arr.filter((s) => s.favorite);
  else if (v === 'recent') arr = arr.filter((s) => s.lastRun);
  else if (v === 'running') arr = arr.filter((s) => ui.running.has(s.id));
  else if (v.startsWith('cat:')) arr = arr.filter((s) => (s.category || '') === v.slice(4));
  const q = ui.search.trim().toLowerCase();
  if (q) {
    const terms = q.split(/\s+/);
    arr = arr.filter((s) => {
      const hay = [s.name, s.description, s.purpose, s.category, (s.tags || []).join(' '), basename(s.path), langOf(s.path).name].join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  const sort = v === 'recent' ? 'recent' : ui.sort;
  arr.sort((a, b) => {
    if (sort === 'recent') return (b.lastRun || 0) - (a.lastRun || 0);
    if (sort === 'used') return (b.runCount || 0) - (a.runCount || 0) || a.name.localeCompare(b.name);
    if (sort === 'added') return (b.createdAt || 0) - (a.createdAt || 0);
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return arr;
}

// ================================================================
// render: sidebar
// ================================================================
function renderSidebar() {
  const n = lib.scripts.length;
  $('#brandSub').textContent = tn('n_scripts', n);
  $('#cntAll').textContent = n;
  $('#cntFav').textContent = lib.scripts.filter((s) => s.favorite).length;
  $('#cntRecent').textContent = lib.scripts.filter((s) => s.lastRun).length;
  const r = $('#cntRunning'); r.textContent = ui.running.size; r.classList.toggle('on', ui.running.size > 0);
  $$('#nav .nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));

  const uncats = lib.scripts.filter((s) => !s.category).length;
  const cats = lib.categories.map((c) => {
    const count = lib.scripts.filter((s) => s.category === c.name).length;
    return `<button class="nav-item ${ui.view === 'cat:' + c.name ? 'active' : ''}" data-view="cat:${esc(c.name)}" data-cat="${esc(c.name)}">
      <span class="cat-dot" style="background:${c.color}"></span><span>${esc(c.name)}</span>
      <em class="hide-on-hover">${count}</em>
      <div class="cat-actions">
        <span class="mini-btn" data-act="rename" title="${t('rename')}">${icon(I.pencil)}</span>
        <span class="mini-btn" data-act="delete" title="${t('delete_category')}">${icon(I.x)}</span>
      </div></button>`;
  }).join('');
  const unc = uncats ? `<button class="nav-item ${ui.view === 'cat:' ? 'active' : ''}" data-view="cat:" data-cat=""><span class="cat-dot" style="background:var(--text3)"></span><span>${t('uncategorized')}</span><em>${uncats}</em></button>` : '';
  $('#cats').innerHTML = cats + unc || `<div class="hint" style="padding:4px 10px">${t('no_categories')}</div>`;
}

// ================================================================
// render: list
// ================================================================
function viewTitle() {
  const v = ui.view;
  if (v === 'all') return t('nav_all');
  if (v === 'fav') return t('nav_fav');
  if (v === 'recent') return t('nav_recent');
  if (v === 'running') return t('view_running');
  return v.slice(4) || t('uncategorized');
}

function renderList() {
  $('#listTitle').textContent = viewTitle();
  const arr = visibleScripts();
  const list = $('#list');
  if (!arr.length) {
    const msg = ui.search ? t('empty_search', { q: esc(ui.search) })
      : ui.view === 'fav' ? t('empty_fav')
      : ui.view === 'running' ? t('empty_running')
      : ui.view === 'recent' ? t('empty_recent')
      : lib.scripts.length ? t('empty_cat')
      : t('empty_lib');
    list.innerHTML = `<div class="list-empty">${icon(I.list)}<br>${msg}</div>`;
    return;
  }
  list.innerHTML = arr.map((s) => {
    const chips = [];
    if (s.category && !ui.view.startsWith('cat:')) chips.push(`<span class="chip cat" style="--c:${catColor(s.category)}">${esc(s.category)}</span>`);
    (s.tags || []).slice(0, 3).forEach((t) => chips.push(`<span class="chip">#${esc(t)}</span>`));
    if (ui.missing.has(s.id)) chips.push(`<span class="chip warn">${t('file_missing')}</span>`);
    return `<div class="card ${s.id === ui.selectedId ? 'selected' : ''}" data-id="${s.id}" draggable="true">
      ${badgeHTML(s)}
      <div class="meta">
        <div class="name"><span>${esc(s.name)}</span></div>
        <div class="desc ${s.description ? '' : 'empty'}">${esc(s.description || t('no_desc'))}</div>
        ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
      </div>
      <div class="side">
        <button class="star ${s.favorite ? 'on' : ''}" data-star="${s.id}" title="${t('favorite')}">${icon(I.star)}</button>
        <button class="quick-run" data-run="${s.id}" title="${ui.running.has(s.id) ? t('stop') : t('run')}">${icon(ui.running.has(s.id) ? I.stop : I.play)}</button>
      </div>
    </div>`;
  }).join('');
}

// ================================================================
// render: detail
// ================================================================
function renderDetail() {
  const d = $('#detail');
  const s = getScript(ui.selectedId);
  if (!s) {
    d.innerHTML = `<div class="empty-detail"><div class="empty-card">
      <div class="empty-art">${MARK('lg2')}</div>
      <h2>${lib.scripts.length ? t('pick_script') : t('welcome')}</h2>
      <p>${lib.scripts.length ? t('pick_script_text') : t('welcome_text')}</p>
      <div class="row">
        <button class="btn btn-primary" data-act="add">${icon(I.plus)} ${t('add_scripts')}</button>
        <button class="btn" data-act="new">${icon(I.file)} ${t('create_new')}</button>
      </div>
      ${lib.scripts.length ? '' : `<button class="btn btn-ghost" data-act="scan" style="margin-top:10px">${icon(I.search)} ${t('find_scripts_tip')}</button>`}
      <div class="shortcuts">
        <kbd>${KEY()} N</kbd><span>${t('sc_add')}</span>
        <kbd>${KEY()} Shift N</kbd><span>${t('sc_new')}</span>
        <kbd>${KEY()} F</kbd><span>${t('sc_search')}</span>
        <kbd>${KEY()} Enter</kbd><span>${t('sc_run')}</span>
        <kbd>${KEY()} E</kbd><span>${t('sc_edit')}</span>
        <kbd>${KEY()} T</kbd><span>${t('sc_theme')}</span>
        <kbd>↑ ↓</kbd><span>${t('sc_move')}</span>
      </div>
    </div></div>`;
    return;
  }
  const isRun = ui.running.has(s.id);
  const missing = ui.missing.has(s.id);
  const codeDirty = ui.code[s.id]?.dirty;
  d.innerHTML = `
    <div class="d-head">
      <div class="d-title-row">
        ${badgeHTML(s, 'lg')}
        <div class="d-title">
          <h1 title="${esc(s.name)}">${esc(s.name)}</h1>
          <div class="d-sub">
            ${s.category ? `<span class="chip cat" style="--c:${catColor(s.category)}">${esc(s.category)}</span>` : ''}
            <span class="chip">${esc(langOf(s.path).name)}</span>
            ${missing ? `<span class="chip warn">${icon(I.warn)} ${t('file_not_found')}</span>` : ''}
            <span class="path-pill" data-act="copypath" title="${t('copy_path_tip')}">${esc(s.path)}</span>
          </div>
        </div>
      </div>
      <div class="d-actions">
        ${isRun
          ? `<button class="btn btn-stop btn-run" data-act="stop">${icon(I.stop)} ${t('stop')}</button>`
          : `<button class="btn btn-primary btn-run" data-act="run" ${missing ? 'disabled' : ''} title="${t('run_tip')}">${icon(I.play)} ${t('run')}</button>`}
        <button class="btn" data-act="terminal" title="${t('run_terminal_tip')}">${icon(I.term)} <span class="lbl">${t('run_terminal')}</span></button>
        <button class="btn" data-act="edit" title="${t('edit_details_tip')}">${icon(I.edit)} <span class="lbl">${t('edit_details')}</span></button>
        <button class="btn btn-ghost btn-icon" data-act="openext" title="${t('open_editor_tip')}">${icon(I.open)}</button>
        <button class="btn btn-ghost btn-icon" data-act="folder" title="${t('show_folder')}">${icon(I.folder)}</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-icon star ${s.favorite ? 'on' : ''}" style="opacity:1" data-act="fav" title="${t('favorite')}">${icon(I.star)}</button>
        <button class="btn btn-ghost btn-icon" data-act="more" title="${t('more')}">${icon(I.more)}</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${ui.tab === 'overview' ? 'active' : ''}" data-tab="overview">${t('tab_overview')}</button>
      <button class="tab ${ui.tab === 'code' ? 'active' : ''}" data-tab="code">${t('tab_code')} ${codeDirty ? `<span class="mod" title="${t('unsaved')}"></span>` : ''}</button>
      <button class="tab ${ui.tab === 'output' ? 'active' : ''}" data-tab="output">${t('tab_output')} ${isRun ? '<span class="dot"></span>' : ''}</button>
    </div>
    <div class="tab-body ${ui.tab === 'overview' ? '' : 'flush'}" id="tabBody"></div>`;
  fitActions();
  renderTab(s);
}

// Collapse secondary button labels to icons when they don't fit on one row (long translations, small windows)
function fitActions() {
  const row = $('.d-actions'); if (!row) return;
  row.classList.remove('compact');
  const btns = [...row.querySelectorAll('.btn')];
  if (btns.length && btns.some((b) => b.offsetTop > btns[0].offsetTop + 4)) row.classList.add('compact');
}
new ResizeObserver(() => fitActions()).observe(document.getElementById('detail'));

function renderTab(s) {
  const body = $('#tabBody');
  if (!body) return;
  if (ui.tab === 'overview') renderOverview(s, body);
  else if (ui.tab === 'code') renderCode(s, body);
  else renderOutput(s, body);
}

function renderOverview(s, body) {
  const ex = s.lastExit;
  const resultChip = ex == null ? '—'
    : ex.code === 0 ? `<span class="chip ok">${t('success')}</span>`
    : ex.signal ? `<span class="chip warn">${t('stopped')}</span>`
    : `<span class="chip err">${t('exit_code', { code: ex.code })}</span>`;
  body.innerHTML = `
    <div class="ov-grid">
      <div>
        <div class="box">
          <h3>${icon(I.info)} ${t('what_it_does')}</h3>
          <div class="prose ${s.description ? '' : 'empty'}">${esc(s.description || t('no_desc_long'))}</div>
        </div>
        <div class="box">
          <h3>${icon(I.target)} ${t('what_its_for')}</h3>
          <div class="prose ${s.purpose ? '' : 'empty'}">${esc(s.purpose || t('no_purpose'))}</div>
        </div>
        ${(s.tags || []).length ? `<div class="box"><h3>${icon(I.tag)} ${t('tags')}</h3><div class="tags-row">${s.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</div></div>` : ''}
      </div>
      <div>
        <div class="box">
          <h3>${icon(I.cmd)} ${t('runs_as')}</h3>
          <div class="cmd-preview" id="cmdPreview">…</div>
          ${s.terminal ? `<div class="hint">${t('opens_terminal_default')}</div>` : ''}
        </div>
        <div class="box">
          <h3>${icon(I.list)} ${t('details')}</h3>
          <dl class="kv">
            <dt>${t('language')}</dt><dd>${esc(langOf(s.path).name)}</dd>
            <dt>${t('times_run')}</dt><dd>${s.runCount || 0}</dd>
            <dt>${t('last_run')}</dt><dd>${timeAgo(s.lastRun)}</dd>
            <dt>${t('last_result')}</dt><dd>${resultChip}</dd>
            <dt>${t('last_duration')}</dt><dd>${fmtMs(ex?.ms)}</dd>
            <dt>${t('working_folder')}</dt><dd class="${s.cwd ? 'mono' : ''}" title="${esc(s.cwd || dirname(s.path))}">${esc(s.cwd || t('scripts_folder'))}</dd>
            <dt>${t('arguments')}</dt><dd class="mono">${esc(s.args || '—')}</dd>
            <dt>${t('file_size')}</dt><dd id="fsize">—</dd>
            <dt>${t('added')}</dt><dd>${s.createdAt ? fmtDate(s.createdAt) : '—'}</dd>
          </dl>
        </div>
      </div>
    </div>`;
  api.preview(s).then((c) => { const el = $('#cmdPreview'); if (el) el.textContent = c; });
  api.stat(s.path).then((st) => { const el = $('#fsize'); if (el) el.textContent = st ? fmtSize(st.size) : t('missing'); });
}

async function renderCode(s, body) {
  body.innerHTML = `
    <div class="code-bar">
      <div class="info" id="codeInfo">${t('loading')}</div>
      <button class="btn btn-sm" data-act="reload" title="${t('reload_tip')}">${t('reload')}</button>
      <button class="btn btn-sm btn-primary" data-act="savecode" title="${t('save_tip')}">${icon(I.save)} ${t('save')}</button>
    </div>
    <div class="editor"><div class="gutter" id="gutter"></div><textarea id="codeArea" spellcheck="false" wrap="off"></textarea></div>`;
  if (!ui.code[s.id]) {
    const r = await api.readFile(s.path);
    if (!r.ok) { $('#codeInfo') && ($('#codeInfo').textContent = r.error); return; }
    ui.code[s.id] = { content: r.content, dirty: false };
  }
  if (ui.selectedId !== s.id || ui.tab !== 'code') return;
  const ta = $('#codeArea');
  ta.value = ui.code[s.id].content;
  updateGutter();
  updateCodeInfo(s);
  ta.addEventListener('input', () => {
    ui.code[s.id].content = ta.value;
    if (!ui.code[s.id].dirty) { ui.code[s.id].dirty = true; markCodeTab(true); }
    updateGutter(); updateCodeInfo(s);
  });
  ta.addEventListener('scroll', () => { $('#gutter').scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const st = ta.selectionStart, en = ta.selectionEnd;
      const ins = /\.(py|ya?ml)$/i.test(s.path) ? '    ' : '\t';
      ta.setRangeText(ins, st, en, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
}
function updateGutter() {
  const ta = $('#codeArea'); if (!ta) return;
  const n = ta.value.split('\n').length;
  $('#gutter').innerHTML = Array.from({ length: n }, (_, i) => i + 1).join('<br>');
  $('#gutter').scrollTop = ta.scrollTop;
}
function updateCodeInfo(s) {
  const c = ui.code[s.id]; const el = $('#codeInfo'); if (!el || !c) return;
  el.textContent = t('code_info', { n: c.content.split('\n').length, lang: langOf(s.path).name }) + (c.dirty ? ' · ' + t('unsaved_lc') : '');
}
function markCodeTab(dirty) {
  const t = $('.tab[data-tab="code"]'); if (!t) return;
  t.innerHTML = `${window.I18N.t('tab_code')} ${dirty ? `<span class="mod" title="${window.I18N.t('unsaved')}"></span>` : ''}`;
}
async function saveCode(id) {
  const s = getScript(id); const c = ui.code[id];
  if (!s || !c || !c.dirty) return true;
  const r = await api.writeFile(s.path, c.content);
  if (!r.ok) { toast(t('could_not_save', { err: r.error }), 'err'); return false; }
  c.dirty = false; markCodeTab(false); updateCodeInfo(s);
  toast(t('saved'), 'ok');
  return true;
}

function renderOutput(s, body) {
  const isRun = ui.running.has(s.id);
  const ex = ui.exitInfo[s.id];
  let status = t('not_run_yet');
  if (isRun) status = `${t('running_status')}${ex?.pid ? ` · PID ${ex.pid}` : ''}`;
  else if (ex?.done) status = ex.signal ? t('stopped_after', { t: fmtMs(ex.ms) }) : t('finished_code', { code: ex.code, t: fmtMs(ex.ms) });
  body.innerHTML = `
    <div class="out-bar">
      <div class="info" id="outInfo">${esc(status)}</div>
      <button class="btn btn-sm" data-act="copyout">${icon(I.copy)} ${t('copy')}</button>
      <button class="btn btn-sm" data-act="clearout">${icon(I.clear)} ${t('clear')}</button>
      ${isRun ? `<button class="btn btn-sm btn-stop" data-act="stop">${icon(I.stop)} ${t('stop')}</button>` : `<button class="btn btn-sm btn-primary" data-act="run">${icon(I.play)} ${t('run')}</button>`}
    </div>
    <div class="console" id="console"></div>
    <div class="stdin-row">
      <input id="stdin" placeholder="${isRun ? t('stdin_ph') : t('stdin_disabled')}" ${isRun ? '' : 'disabled'} spellcheck="false" />
    </div>`;
  const con = $('#console');
  const chunks = ui.outputs[s.id] || [];
  if (!chunks.length) con.innerHTML = `<div class="console-empty">${t('output_empty', { run: esc(t('run')) })}</div>`;
  else { con.innerHTML = chunks.map(chunkHTML).join(''); con.scrollTop = con.scrollHeight; }
  const inp = $('#stdin');
  inp.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const v = inp.value; inp.value = '';
      pushOut(s.id, 'stdin', v + '\n');
      await api.stdin(s.id, v + '\n');
    }
  });
  if (isRun) inp.focus();
}
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;
function chunkHTML(c) {
  const cls = { stderr: 'err', sys: 'sys', ok: 'ok', bad: 'bad', stdin: 'sys' }[c.type] || '';
  const txt = esc(c.text.replace(ANSI, '').replace(/\r\n/g, '\n'));
  return cls ? `<span class="${cls}">${txt}</span>` : txt;
}
function pushOut(id, type, text) {
  const arr = (ui.outputs[id] ||= []);
  const c = { type, text };
  arr.push(c);
  if (arr.length > 4000) arr.splice(0, arr.length - 4000);
  if (ui.selectedId === id && ui.tab === 'output') {
    const con = $('#console'); if (!con) return;
    const empty = con.querySelector('.console-empty'); if (empty) empty.remove();
    const atBottom = con.scrollHeight - con.scrollTop - con.clientHeight < 40;
    con.insertAdjacentHTML('beforeend', chunkHTML(c));
    if (atBottom) con.scrollTop = con.scrollHeight;
  }
}

function renderAll() { renderSidebar(); renderList(); renderDetail(); }

// ================================================================
// actions
// ================================================================
function select(id, tab) {
  if (id !== ui.selectedId) ui.tab = tab || (ui.running.has(id) ? 'output' : 'overview');
  else if (tab) ui.tab = tab;
  ui.selectedId = id;
  renderList(); renderDetail();
  const card = $(`.card[data-id="${id}"]`); card?.scrollIntoView({ block: 'nearest' });
}

async function runScript(id) {
  const s = getScript(id); if (!s) return;
  if (ui.running.has(id)) return;
  if (s.terminal) return runInTerminal(id);
  if (ui.code[id]?.dirty && !(await saveCode(id))) return;
  ui.outputs[id] = [];
  const r = await api.run(s);
  if (!r.ok) { toast(r.error, 'err'); return; }
  ui.running.add(id);
  ui.exitInfo[id] = { pid: r.pid, started: Date.now() };
  s.runCount = (s.runCount || 0) + 1; s.lastRun = Date.now(); persist();
  pushOut(id, 'sys', `$ ${r.command}\n  ${t('out_in', { cwd: r.cwd })}\n\n`);
  if (ui.selectedId === id) ui.tab = 'output';
  renderAll();
}
async function runInTerminal(id) {
  const s = getScript(id); if (!s) return;
  if (ui.code[id]?.dirty && !(await saveCode(id))) return;
  const r = await api.runInTerminal(s);
  if (!r.ok) return toast(r.error, 'err');
  s.runCount = (s.runCount || 0) + 1; s.lastRun = Date.now(); persist();
  toast(t('opened_in', { term: r.terminal || t('terminal_word') }), 'ok');
  renderSidebar(); if (ui.tab === 'overview') renderDetail();
}
function stopScript(id) { api.stop(id); }

api.onRunEvent(({ id, type, data }) => {
  if (type === 'stdout' || type === 'stderr') return pushOut(id, type, data);
  if (type === 'exit') {
    ui.running.delete(id);
    const info = ui.exitInfo[id] || {};
    Object.assign(info, { done: true, code: data.code, signal: data.signal, ms: data.ms });
    ui.exitInfo[id] = info;
    const s = getScript(id);
    if (s) { s.lastExit = { code: data.code, signal: data.signal, ms: data.ms }; persist(); }
    const ok = data.code === 0;
    pushOut(id, ok ? 'ok' : 'bad', `\n${data.signal ? t('stopped_sig', { sig: data.signal }) : ok ? t('finished_ok') : t('exited_code', { code: data.code })} · ${fmtMs(data.ms)}\n`);
    if (ui.selectedId !== id && s) toast(ok ? t('toast_finished', { name: s.name }) : data.signal ? t('toast_stopped', { name: s.name }) : t('toast_failed', { name: s.name, code: data.code }), ok ? 'ok' : 'err');
    renderSidebar(); renderList();
    if (ui.selectedId === id) {
      // refresh head + output bar without wiping console scroll
      const con = $('#console'); const top = con?.scrollTop;
      renderDetail();
      const c2 = $('#console'); if (c2 && top != null) c2.scrollTop = c2.scrollHeight;
    }
  }
});

function toggleFav(id) { const s = getScript(id); if (!s) return; s.favorite = !s.favorite; persist(); renderAll(); }

async function removeScript(id) {
  const s = getScript(id); if (!s) return;
  const ok = await confirmDialog(t('remove_q'), t('remove_text', { name: s.name }), t('remove'));
  if (!ok) return;
  if (ui.running.has(id)) api.stop(id);
  lib.scripts = lib.scripts.filter((x) => x.id !== id);
  delete ui.code[id]; delete ui.outputs[id];
  if (ui.selectedId === id) ui.selectedId = null;
  persist(); renderAll(); toast(t('removed'));
}
function duplicateScript(id) {
  const s = getScript(id); if (!s) return;
  const copy = { ...structuredClone(s), id: uid(), name: t('copy_name', { name: s.name }), createdAt: Date.now(), runCount: 0, lastRun: null, lastExit: null, favorite: false };
  lib.scripts.push(copy); persist(); select(copy.id); renderSidebar();
  toast(t('duplicated'));
}

function ensureCategory(name) {
  name = (name || '').trim();
  if (!name) return '';
  if (!lib.categories.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
    lib.categories.push({ name, color: CAT_COLORS[lib.categories.length % CAT_COLORS.length] });
  }
  return lib.categories.find((c) => c.name.toLowerCase() === name.toLowerCase()).name;
}

async function addPaths(paths) {
  paths = paths.filter(Boolean);
  if (!paths.length) return;
  const known = new Set(lib.scripts.map((s) => s.path));
  const fresh = paths.filter((p) => !known.has(p));
  if (!fresh.length) { toast(t('already_in')); const s = lib.scripts.find((x) => x.path === paths[0]); if (s) select(s.id); return; }
  const defaultCat = ui.view.startsWith('cat:') ? ui.view.slice(4) : '';
  if (fresh.length === 1) {
    const p = fresh[0];
    const r = await api.readFile(p);
    const desc = r.ok ? parseHeader(r.content) : '';
    return openEditor({ id: null, path: p, name: prettyName(p), description: desc, purpose: '', category: defaultCat, tags: [] });
  }
  // multiple: quick batch dialog
  const html = `
    <div class="m-head"><h2>${t('add_n_scripts', { n: fresh.length })}</h2></div>
    <div class="m-body">
      <div class="field"><label>${t('files')}</label><div class="file-list">${fresh.map((p) => esc(basename(p))).join('<br>')}</div></div>
      <div class="field"><label>${t('put_in_cat')}</label>${catSelect(defaultCat, 'batchCat')}</div>
      <div class="hint">${t('batch_hint')}</div>
    </div>
    <div class="m-foot"><button class="btn" data-close>${t('cancel')}</button><button class="btn btn-primary" id="batchOk">${t('add_scripts')}</button></div>`;
  openModal(html);
  wireCatSelect('batchCat');
  $('#batchOk').onclick = async () => {
    const cat = await readCatSelect('batchCat');
    for (const p of fresh) {
      const r = await api.readFile(p);
      lib.scripts.push(newScriptObj({ path: p, name: prettyName(p), description: r.ok ? parseHeader(r.content) : '', category: cat }));
    }
    persist(); closeModal(); checkMissing(); renderAll();
    toast(t('added_n', { n: fresh.length }), 'ok');
  };
}
// ---------- find scripts already on this computer ----------
const SHEBANG_EXT = { bash: 'sh', sh: 'sh', dash: 'sh', zsh: 'zsh', fish: 'fish', python: 'py', python3: 'py', python2: 'py', node: 'js', deno: 'ts', bun: 'js', ruby: 'rb', perl: 'pl', lua: 'lua', php: 'php', pwsh: 'ps1' };
function scanLang(f) {
  if (extOf(f.path)) return langOf(f.path);
  const first = (f.head || '').split(/\r?\n/)[0];
  if (!first.startsWith('#!')) return langOf(f.path);
  const parts = first.slice(2).trim().split(/\s+/);
  let prog = (parts[0] || '').split('/').pop();
  if (prog === 'env') prog = parts.slice(1).find((x) => !x.startsWith('-') && !x.includes('=')) || '';
  prog = prog.replace(/[\d.]+$/, '');
  const ext = SHEBANG_EXT[prog];
  return ext ? LANGS[ext] : langOf(f.path);
}
const scanState = { folders: null, files: [], picked: new Set(), sort: 'lang', busy: false };
api.onScanProgress((n) => { const el = $('#scanCount'); if (el) el.textContent = t('scan_searching', { n }); });

async function openScan() {
  if (!scanState.folders) scanState.folders = lib.settings?.scanFolders?.length ? [...lib.settings.scanFolders] : await api.scanDefaults();
  scanState.files = []; scanState.picked = new Set();
  renderScanFolders();
}
function saveScanFolders() { lib.settings = lib.settings || {}; lib.settings.scanFolders = [...scanState.folders]; persist(); }
function renderScanFolders() {
  openModal(`
    <div class="m-head"><h2>${t('scan_title')}</h2></div>
    <div class="m-body">
      <div class="field"><label>${t('scan_where')}</label>
        <div class="scan-folders">${scanState.folders.map((f, i) => `<div class="scan-folder">${icon(I.folder)}<span dir="ltr">${esc(f)}</span><button class="mini-btn" data-rm="${i}" title="${t('remove')}">×</button></div>`).join('') || `<div class="hint">—</div>`}</div>
        <button class="btn btn-ghost" id="scanAddDir" style="margin-top:8px">${icon(I.plus)} ${t('scan_add_folder')}</button>
      </div>
      <div class="hint">${t('scan_hint')}</div>
    </div>
    <div class="m-foot"><button class="btn" data-close>${t('cancel')}</button><button class="btn btn-primary" id="scanGo" ${scanState.folders.length ? '' : 'disabled'}>${icon(I.search)} ${t('scan_start')}</button></div>`, 'wide');
  $$('[data-rm]').forEach((b) => (b.onclick = () => { scanState.folders.splice(+b.dataset.rm, 1); saveScanFolders(); renderScanFolders(); }));
  $('#scanAddDir').onclick = async () => { const p = await api.pickFolder(); if (p && !scanState.folders.includes(p)) { scanState.folders.push(p); saveScanFolders(); } renderScanFolders(); };
  $('#scanGo').onclick = runScan;
}
async function runScan() {
  if (scanState.busy) return; scanState.busy = true;
  $('#modal .m-body').innerHTML = `<div class="scan-progress"><div class="spinner"></div><div id="scanCount">${t('scan_searching', { n: 0 })}</div></div>`;
  $('#scanGo').disabled = true;
  let res;
  try { res = await api.scan(scanState.folders); } finally { scanState.busy = false; }
  const known = new Set(lib.scripts.map((s) => s.path));
  scanState.files = res.files.filter((f) => !known.has(f.path)).map((f) => ({ ...f, lang: scanLang(f), desc: parseHeader(f.head) }))
    .sort((a, b) => a.lang.name.localeCompare(b.lang.name) || basename(a.path).localeCompare(basename(b.path)));
  scanState.picked = new Set(scanState.files.map((f) => f.path));
  renderScanResults();
}
function scanCategory(f) {
  if (scanState.sort === 'lang') return f.lang.name;
  if (scanState.sort === 'folder') return f.folder ? f.folder.charAt(0).toUpperCase() + f.folder.slice(1) : '';
  return '';
}
function renderScanResults() {
  const files = scanState.files;
  if (!files.length) {
    $('#modal .m-body').innerHTML = `<div class="scan-progress">${icon(I.list)}<div>${t('scan_none')}</div></div>`;
    $('#modal .m-foot').innerHTML = `<button class="btn" data-close>${t('cancel')}</button><button class="btn" id="scanBack">${t('scan_again')}</button>`;
    $$('[data-close]', $('#modal')).forEach((b) => (b.onclick = closeModal));
    $('#scanBack').onclick = renderScanFolders; return;
  }
  $('#modal .m-body').innerHTML = `
    <div class="scan-bar">
      <strong>${t('scan_found', { n: files.length })}</strong>
      <span class="grow"></span>
      <label>${t('scan_sort')}</label>
      <select class="select-sm" id="scanSort">
        <option value="lang" ${scanState.sort === 'lang' ? 'selected' : ''}>${t('scan_by_lang')}</option>
        <option value="folder" ${scanState.sort === 'folder' ? 'selected' : ''}>${t('scan_by_folder')}</option>
        <option value="none" ${scanState.sort === 'none' ? 'selected' : ''}>${t('scan_no_sort')}</option>
      </select>
      <button class="btn btn-ghost btn-sm" id="scanAll">${t('scan_all')}</button>
      <button class="btn btn-ghost btn-sm" id="scanNone">${t('scan_none_sel')}</button>
    </div>
    <div class="scan-list">${files.map((f, i) => `
      <label class="scan-row">
        <input type="checkbox" data-i="${i}" ${scanState.picked.has(f.path) ? 'checked' : ''}>
        <div class="badge" style="--c:${f.lang.color}">${esc(f.lang.label)}</div>
        <div class="scan-txt">
          <div class="scan-name">${esc(prettyName(f.path))} <span class="scan-cat">${esc(scanCategory(f))}</span></div>
          <div class="scan-path" dir="ltr">${esc(f.path)}</div>
          ${f.desc ? `<div class="scan-desc">${esc(f.desc)}</div>` : ''}
        </div>
      </label>`).join('')}</div>`;
  $('#modal .m-foot').innerHTML = `<button class="btn" data-close>${t('cancel')}</button><button class="btn" id="scanBack">${t('scan_again')}</button><button class="btn btn-primary" id="scanAdd">${t('scan_add', { n: scanState.picked.size })}</button>`;
  $$('[data-close]', $('#modal')).forEach((b) => (b.onclick = closeModal));
  const upd = () => { const b = $('#scanAdd'); b.textContent = t('scan_add', { n: scanState.picked.size }); b.disabled = !scanState.picked.size; };
  upd();
  $$('.scan-list input').forEach((cb) => (cb.onchange = () => { const p = files[+cb.dataset.i].path; cb.checked ? scanState.picked.add(p) : scanState.picked.delete(p); upd(); }));
  $('#scanSort').onchange = (e) => { scanState.sort = e.target.value; const top = $('.scan-list').scrollTop; renderScanResults(); $('.scan-list').scrollTop = top; };
  $('#scanAll').onclick = () => { scanState.picked = new Set(files.map((f) => f.path)); renderScanResults(); };
  $('#scanNone').onclick = () => { scanState.picked.clear(); renderScanResults(); };
  $('#scanBack').onclick = renderScanFolders;
  $('#scanAdd').onclick = () => {
    const chosen = files.filter((f) => scanState.picked.has(f.path));
    for (const f of chosen) lib.scripts.push(newScriptObj({ path: f.path, name: prettyName(f.path), description: f.desc, category: ensureCategory(scanCategory(f)) }));
    persist(); closeModal(); checkMissing(); renderAll();
    toast(t('added_n', { n: chosen.length }), 'ok');
  };
}
function newScriptObj(o) {
  return { id: uid(), name: '', path: '', description: '', purpose: '', category: '', tags: [], args: '', cwd: '', command: '', terminal: false, icon: '', favorite: false, runCount: 0, lastRun: null, lastExit: null, createdAt: Date.now(), ...o };
}

// ================================================================
// modals
// ================================================================
let modalResolve = null;
function openModal(html, cls = '') {
  const m = $('#modal'); m.className = `modal ${cls}`; m.innerHTML = html;
  $('#modalBackdrop').classList.add('show');
  $$('[data-close]', m).forEach((b) => (b.onclick = closeModal));
  setTimeout(() => m.querySelector('[autofocus], input:not([type=checkbox]), textarea')?.focus(), 30);
}
function closeModal() {
  $('#modalBackdrop').classList.remove('show');
  if (modalResolve) { modalResolve(false); modalResolve = null; }
}
$('#modalBackdrop').addEventListener('mousedown', (e) => { if (e.target.id === 'modalBackdrop') closeModal(); });

function confirmDialog(title, text, okLabel = t('ok'), danger = true) {
  return new Promise((res) => {
    openModal(`<div class="m-head"><h2>${esc(title)}</h2></div>
      <div class="m-body"><p style="margin:0;color:var(--text2);line-height:1.6">${esc(text)}</p></div>
      <div class="m-foot"><button class="btn" data-close>${t('cancel')}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cfOk">${esc(okLabel)}</button></div>`, 'sm');
    modalResolve = res;
    $('#cfOk').onclick = () => { modalResolve = null; $('#modalBackdrop').classList.remove('show'); res(true); };
    $('#cfOk').focus();
  });
}
function promptDialog(title, label, value = '') {
  return new Promise((res) => {
    openModal(`<div class="m-head"><h2>${esc(title)}</h2></div>
      <div class="m-body"><div class="field"><label>${esc(label)}</label><input class="input" id="pdIn" value="${esc(value)}" /></div></div>
      <div class="m-foot"><button class="btn" data-close>${t('cancel')}</button><button class="btn btn-primary" id="pdOk">${t('ok')}</button></div>`, 'sm');
    modalResolve = res;
    const done = () => { const v = $('#pdIn').value.trim(); modalResolve = null; $('#modalBackdrop').classList.remove('show'); res(v || false); };
    $('#pdOk').onclick = done;
    $('#pdIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    $('#pdIn').select();
  });
}

function catSelect(current, id) {
  return `<select id="${id}" class="input">
    <option value="">${t('no_category')}</option>
    ${lib.categories.map((c) => `<option ${c.name === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    <option value="__new__">${t('new_category_opt')}</option>
  </select>`;
}
function wireCatSelect(id) {
  const sel = $('#' + id);
  sel.addEventListener('change', async () => {
    if (sel.value !== '__new__') return;
    const inp = document.createElement('input');
    inp.className = 'input'; inp.placeholder = t('new_category_name'); inp.id = id + 'New'; inp.style.marginTop = '8px';
    if (!$('#' + id + 'New')) sel.after(inp);
    inp.focus();
  });
}
async function readCatSelect(id) {
  const sel = $('#' + id);
  if (sel.value === '__new__') return ensureCategory($('#' + id + 'New')?.value || '');
  return sel.value;
}

function openEditor(s) {
  const isNew = !s.id;
  const tags = [...(s.tags || [])];
  let emoji = s.icon || '';
  const L = langOf(s.path);
  const html = `
    <div class="m-head">
      <div id="edBadge">${badgeHTML({ ...s, icon: emoji })}</div>
      <h2>${isNew ? t('add_script') : t('edit_details')}</h2>
    </div>
    <div class="m-body">
      <div class="field"><label>${t('name')}</label><input class="input" id="edName" value="${esc(s.name)}" autofocus /></div>
      <div class="field-row">
        <div class="field"><label>${t('category')}</label>${catSelect(s.category, 'edCat')}</div>
        <div class="field"><label>${t('tags')} <small>${t('tags_hint')}</small></label><div class="tag-input" id="edTags"><input id="edTagIn" placeholder="${t('tags_ph')}" /></div></div>
      </div>
      <div class="field"><label>${t('q_what_does')} <small>${t('shown_on_card')}</small></label>
        <textarea class="textarea" id="edDesc" placeholder="${t('desc_ph')}">${esc(s.description)}</textarea></div>
      <div class="field"><label>${t('q_what_for')} <small>${t('when_why')}</small></label>
        <textarea class="textarea" id="edPurpose" placeholder="${t('purpose_ph')}">${esc(s.purpose)}</textarea></div>

      <details class="adv">
        <summary>${t('icon')}</summary>
        <div class="field"><div class="emoji-row" id="edEmoji">${EMOJIS.map((e) => `<button class="emoji-opt ${e === emoji ? 'sel' : ''}" data-e="${e}" title="${e ? '' : t('language_badge')}">${e || `<span style="font:700 10px var(--mono);color:${L.color}">${esc(L.label)}</span>`}</button>`).join('')}</div></div>
      </details>
      <details class="adv" ${s.args || s.cwd || s.command || s.terminal ? 'open' : ''}>
        <summary>${t('how_to_run')}</summary>
        <div class="field"><label>${t('script_file')}</label>
          <div class="input-group"><input class="input mono" id="edPath" value="${esc(s.path)}" /><button class="btn" id="edBrowse">${t('browse')}</button></div></div>
        <div class="field-row">
          <div class="field"><label>${t('arguments')}</label><input class="input mono" id="edArgs" value="${esc(s.args || '')}" placeholder="--verbose 10" /></div>
          <div class="field"><label>${t('working_folder')}</label>
            <div class="input-group"><input class="input mono" id="edCwd" value="${esc(s.cwd || '')}" placeholder="${t('cwd_ph')}" /><button class="btn btn-icon" id="edCwdBrowse" title="${t('browse')}">${icon(I.folder)}</button></div></div>
        </div>
        <div class="field"><label>${t('custom_cmd')} <small>${t('optional')}</small></label>
          <input class="input mono" id="edCmd" value="${esc(s.command || '')}" placeholder="${esc(t('auto_cmd', { cmd: autoHint(s.path) }))}" />
          <div class="hint">${t('custom_cmd_hint')}</div></div>
        <div class="field"><label class="check"><input type="checkbox" id="edTerm" ${s.terminal ? 'checked' : ''}/> ${t('always_terminal')}</label></div>
      </details>
    </div>
    <div class="m-foot">
      <span class="left">${isNew ? t('tip_header') : ''}</span>
      <button class="btn" data-close>${t('cancel')}</button>
      <button class="btn btn-primary" id="edSave">${isNew ? t('add_to_lib') : t('save')}</button>
    </div>`;
  openModal(html);
  wireCatSelect('edCat');

  const tagBox = $('#edTags'), tagIn = $('#edTagIn');
  const drawTags = () => {
    $$('.chip', tagBox).forEach((c) => c.remove());
    tags.forEach((t, i) => {
      const c = document.createElement('span'); c.className = 'chip';
      c.innerHTML = `#${esc(t)}<button data-i="${i}">✕</button>`;
      tagBox.insertBefore(c, tagIn);
    });
  };
  drawTags();
  tagBox.onclick = (e) => { const i = e.target.dataset?.i; if (i != null) { tags.splice(+i, 1); drawTags(); } tagIn.focus(); };
  const commitTag = () => { const v = tagIn.value.trim().replace(/^#/, '').replace(/,$/, ''); if (v && !tags.includes(v)) tags.push(v); tagIn.value = ''; drawTags(); };
  tagIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(); }
    else if (e.key === 'Backspace' && !tagIn.value && tags.length) { tags.pop(); drawTags(); }
  });
  $('#edEmoji').onclick = (e) => {
    const b = e.target.closest('.emoji-opt'); if (!b) return;
    emoji = b.dataset.e;
    $$('.emoji-opt').forEach((x) => x.classList.toggle('sel', x === b));
    $('#edBadge').innerHTML = badgeHTML({ ...s, path: $('#edPath').value, icon: emoji });
  };
  $('#edBrowse').onclick = async () => { const p = await api.pickFiles(); if (p[0]) { $('#edPath').value = p[0]; $('#edCmd').placeholder = t('auto_cmd', { cmd: autoHint(p[0]) }); } };
  $('#edCwdBrowse').onclick = async () => { const p = await api.pickFolder(); if (p) $('#edCwd').value = p; };
  $('#edSave').onclick = async () => {
    commitTag();
    const name = $('#edName').value.trim();
    const path = $('#edPath').value.trim();
    if (!name) { $('#edName').focus(); return toast(t('need_name'), 'err'); }
    if (!path) return toast(t('pick_file'), 'err');
    const data = {
      name, path, description: $('#edDesc').value.trim(), purpose: $('#edPurpose').value.trim(),
      category: await readCatSelect('edCat'), tags, icon: emoji,
      args: $('#edArgs').value.trim(), cwd: $('#edCwd').value.trim(), command: $('#edCmd').value.trim(), terminal: $('#edTerm').checked,
    };
    let id = s.id;
    if (isNew) { const obj = newScriptObj(data); lib.scripts.push(obj); id = obj.id; }
    else { const t = getScript(id); if (t.path !== path) delete ui.code[id]; Object.assign(t, data); }
    persist(); closeModal(); await checkMissing();
    ui.selectedId = null; select(id, s._openCode ? 'code' : undefined); renderSidebar();
    toast(isNew ? t('added_to_lib') : t('saved'), 'ok');
  };
  $('#modal').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#edSave').click(); });
}
function autoHint(p) {
  if (!p) return '';
  const e = extOf(p);
  const map = { sh: 'bash', bash: 'bash', zsh: 'zsh', fish: 'fish', py: ui.platform === 'win32' ? 'python' : 'python3', js: 'node', mjs: 'node', ts: 'npx tsx', ps1: ui.platform === 'win32' ? 'powershell' : 'pwsh', bat: 'cmd /c', cmd: 'cmd /c', rb: 'ruby', pl: 'perl', lua: 'lua', php: 'php' };
  return map[e] ? `${map[e]} ${basename(p)}` : t('run_directly', { f: basename(p) });
}

function openNewScript() {
  let ext = ui.platform === 'win32' ? 'ps1' : 'sh';
  const html = `
    <div class="m-head"><h2>${t('create_script_title')}</h2></div>
    <div class="m-body">
      <div class="field"><label>${t('language')}</label>
        <div class="lang-grid" id="nsLang">${NEW_TEMPLATES.map((t) => { const L = LANGS[t.ext]; return `<button class="lang-opt ${t.ext === ext ? 'sel' : ''}" data-ext="${t.ext}"><div class="badge" style="--c:${L.color}">${L.label}</div><span>${L.name}</span></button>`; }).join('')}</div></div>
      <div class="field-row">
        <div class="field"><label>${t('name')}</label><input class="input" id="nsName" placeholder="${t('new_name_ph')}" autofocus /></div>
        <div class="field"><label>${t('category')}</label>${catSelect(ui.view.startsWith('cat:') ? ui.view.slice(4) : '', 'nsCat')}</div>
      </div>
      <div class="field"><label>${t('q_what_will')}</label><textarea class="textarea" id="nsDesc" placeholder="${t('new_desc_ph')}"></textarea></div>
    </div>
    <div class="m-foot"><span class="left">${t('choose_save_next')}</span><button class="btn" data-close>${t('cancel')}</button><button class="btn btn-primary" id="nsOk">${t('create')}</button></div>`;
  openModal(html);
  wireCatSelect('nsCat');
  $('#nsLang').onclick = (e) => { const b = e.target.closest('.lang-opt'); if (!b) return; ext = b.dataset.ext; $$('.lang-opt').forEach((x) => x.classList.toggle('sel', x === b)); };
  $('#nsOk').onclick = async () => {
    const name = $('#nsName').value.trim() || t('new_script_default');
    const desc = $('#nsDesc').value.trim();
    const cat = await readCatSelect('nsCat');
    const file = name.toLowerCase().replace(/[^a-z0-9æøå]+/gi, '-').replace(/^-|-$/g, '') || 'new-script';
    const p = await api.saveNew(`${file}.${ext}`);
    if (!p) return;
    const tpl = NEW_TEMPLATES.find((t) => t.ext === ext).tpl(desc || name);
    const w = await api.writeFile(p, tpl);
    if (!w.ok) return toast(w.error, 'err');
    const obj = newScriptObj({ name, path: p, description: desc, category: cat });
    lib.scripts.push(obj); persist(); closeModal();
    ui.selectedId = null; select(obj.id, 'code'); renderSidebar();
    toast(t('script_created'), 'ok');
  };
}

// ================================================================
// themes
// ================================================================
// keys: bg bg2 panel panel2 hover line line2 text text2 text3 console ctext accent
const THEMES = [
  { id: 'midnight',  name: 'Midnight',      mode: 'dark',  bg: '#0d0f15', bg2: '#12151d', panel: '#161a24', panel2: '#1b2030', hover: '#20263a', line: '#242a3a', line2: '#2e3550', text: '#e8ebf4', text2: '#a3abc2', text3: '#6c7593', console: '#0a0c11', ctext: '#cfd5e7', accent: '#7c6cff' },
  { id: 'daylight',  name: 'Daylight',      mode: 'light', bg: '#eef0f6', bg2: '#f6f7fb', panel: '#ffffff', panel2: '#f4f5fa', hover: '#eceef6', line: '#e1e4ee', line2: '#d3d7e5', text: '#171a26', text2: '#4d5470', text3: '#7c829a', console: '#12141b', ctext: '#d3d8ea', accent: '#5b4be6' },
  { id: 'nordlys',   name: 'Nordlys',       mode: 'dark',  bg: '#0e141b', bg2: '#121a23', panel: '#16212c', panel2: '#1b2835', hover: '#213242', line: '#22303e', line2: '#2c3e50', text: '#e4eef5', text2: '#9fb3c4', text3: '#6a8194', console: '#0a1016', ctext: '#c9e6ee', accent: '#3fd6b8' },
  { id: 'fjord',     name: 'Fjord',         mode: 'light', bg: '#e6edf3', bg2: '#eff4f8', panel: '#fbfdff', panel2: '#edf3f8', hover: '#e2eaf2', line: '#d6e0ea', line2: '#c4d2df', text: '#122333', text2: '#3f566b', text3: '#6c8195', console: '#0f1c28', ctext: '#d0e2f0', accent: '#2a78d4' },
  { id: 'forest',    name: 'Forest',        mode: 'dark',  bg: '#0d1310', bg2: '#111915', panel: '#16201b', panel2: '#1b2822', hover: '#22322a', line: '#23302a', line2: '#2e3f36', text: '#e5efe9', text2: '#a1b6aa', text3: '#6b8275', console: '#090e0b', ctext: '#cfe5d6', accent: '#4fc77f' },
  { id: 'ember',     name: 'Ember',         mode: 'dark',  bg: '#14100d', bg2: '#1a1410', panel: '#211a15', panel2: '#29201a', hover: '#33281f', line: '#33281f', line2: '#45372b', text: '#f3ebe4', text2: '#c2ad9c', text3: '#8d7766', console: '#0f0b08', ctext: '#efd9c6', accent: '#ff8a3d' },
  { id: 'synthwave', name: 'Synthwave',     mode: 'dark',  bg: '#120d20', bg2: '#171028', panel: '#1d1533', panel2: '#251b40', hover: '#2e224f', line: '#2d2248', line2: '#3d2e60', text: '#f2eaff', text2: '#b7a6d9', text3: '#8170a6', console: '#0c0817', ctext: '#f5c9ff', accent: '#ff4fa3' },
  { id: 'terminal',  name: 'Terminal',      mode: 'dark',  bg: '#050806', bg2: '#080c09', panel: '#0c120e', panel2: '#101812', hover: '#15201a', line: '#16231b', line2: '#1f3326', text: '#c8f7d4', text2: '#86c99a', text3: '#558a66', console: '#020403', ctext: '#4dff88', accent: '#33e070', mono: true },
  { id: 'paper',     name: 'Paper',         mode: 'light', bg: '#efe9dd', bg2: '#f6f1e7', panel: '#fffcf5', panel2: '#f4eee2', hover: '#ece4d4', line: '#e2d8c5', line2: '#d4c7b0', text: '#2a2118', text2: '#5f5040', text3: '#8a7a66', console: '#2a2118', ctext: '#f3e7d3', accent: '#c25a2c' },
  { id: 'contrast',  name: 'High contrast', mode: 'dark',  bg: '#000000', bg2: '#000000', panel: '#0b0b0b', panel2: '#141414', hover: '#262626', line: '#5c5c5c', line2: '#8a8a8a', text: '#ffffff', text2: '#e6e6e6', text3: '#c2c2c2', console: '#000000', ctext: '#ffffff', accent: '#ffd400' },
];
const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
function activeTheme() {
  const id = lib.settings.themeId || 'midnight';
  if (id === 'auto') return themeById(darkMQ.matches ? 'midnight' : 'daylight');
  return themeById(id);
}
function applySettings() {
  const st = lib.settings;
  // migrate settings from v1.0.0 (dark/light + accent)
  if (!st.themeId) { st.themeId = st.theme === 'light' ? 'daylight' : 'midnight'; if (st.accent === '#7c6cff') st.accent = ''; }
  const t = activeTheme();
  const r = document.documentElement;
  r.dataset.theme = t.mode;
  r.dataset.themeId = t.id;
  for (const k of ['bg', 'bg2', 'panel', 'panel2', 'hover', 'line', 'line2', 'text', 'text2', 'text3', 'console']) r.style.setProperty('--' + k, t[k]);
  r.style.setProperty('--console-text', t.ctext);
  r.style.setProperty('--accent', st.accent || t.accent);
  r.style.setProperty('--on-accent', isLight(st.accent || t.accent) ? '#111111' : '#ffffff');
  r.style.setProperty('--shadow', t.mode === 'light' ? '0 20px 60px rgba(20,25,50,.18)' : '0 20px 60px rgba(0,0,0,.55)');
  r.style.setProperty('--font', t.mono ? 'var(--mono)' : '"Inter", "Segoe UI Variable", "Segoe UI", -apple-system, "Noto Sans", Ubuntu, Cantarell, sans-serif');
}
darkMQ.addEventListener('change', () => { if (lib.settings.themeId === 'auto') applySettings(); });
function isLight(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false;
  const n = parseInt(m[1], 16); const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
}
function themePreview(t, label, id, sel) {
  const ac = t.accent;
  return `<button class="theme-card ${sel ? 'sel' : ''}" data-theme-id="${id}" title="${esc(label)}">
    <div class="tp" style="background:${t.bg}">
      <div class="tp-side" style="background:${t.bg2};border-color:${t.line}">
        <i style="background:${ac}"></i><b style="background:${t.line2}"></b><b style="background:${t.line2}"></b><b style="background:${t.line2}"></b>
      </div>
      <div class="tp-main">
        <div class="tp-card" style="background:${t.panel};border-color:${t.line}"><s style="background:${ac}"></s><span style="background:${t.text2}"></span></div>
        <div class="tp-card" style="background:${t.panel};border-color:${t.line}"><s style="background:${t.text3}"></s><span style="background:${t.text3}"></span></div>
        <div class="tp-run" style="background:${ac}"></div>
      </div>
    </div>
    <div class="tp-name">${esc(label)}${sel ? icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>') : ''}</div>
  </button>`;
}

// ================================================================
// language
// ================================================================
function systemLang() { return window.I18N.resolve(ui.sysLangs || []); }
function applyLanguage() {
  const want = lib.settings.language && lib.settings.language !== 'auto' ? lib.settings.language : systemLang();
  const code = window.I18N.setLang(want);
  document.documentElement.lang = code;
  document.documentElement.dir = window.I18N.isRTL(code) ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $$('#sortSel option').forEach((o) => { o.textContent = t('sort_' + o.value); });
  $('#searchKbd').textContent = `${KEY()} F`;
  api.setLanguage(code);
}

function openSettings() {
  const st = lib.settings;
  const cur = st.themeId || 'midnight';
  const autoT = { ...themeById('midnight'), bg2: themeById('daylight').bg2 };
  const html = `
    <div class="m-head"><h2>${t('settings')}</h2></div>
    <div class="m-body">
      <div class="field"><label>${t('theme')} <small>${t('click_apply')}</small></label>
        <div class="theme-grid" id="stThemes">
          ${themePreview(autoT, t('auto_system'), 'auto', cur === 'auto')}
          ${THEMES.map((th) => themePreview(th, themeName(th), th.id, cur === th.id)).join('')}
        </div></div>
      <div class="field"><label>${t('accent')} <small>${t('accent_hint')}</small></label>
        <div class="swatches" id="stAccent">
          <button class="swatch swatch-default ${!st.accent ? 'sel' : ''}" data-c="" title="${t('theme_default')}" style="background:conic-gradient(${THEMES.slice(2, 8).map((th) => th.accent).join(',')})"></button>
          ${ACCENTS.map((c) => `<button class="swatch ${c === st.accent ? 'sel' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}
          <label class="swatch swatch-custom" title="${t('pick_any')}"><input type="color" id="stCustom" value="${esc(st.accent || activeTheme().accent)}" /></label>
        </div></div>
      <div class="field"><label>${t('language_setting')}</label>
        <select class="input" id="stLang" style="max-width:320px">
          <option value="auto">${esc(t('lang_auto', { lang: (window.I18N.LANGUAGES.find((l) => l.code === systemLang()) || {}).name || 'English' }))}</option>
          ${window.I18N.LANGUAGES.map((l) => `<option value="${l.code}" ${st.language === l.code ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
        <div class="hint">${t('lang_hint')}</div></div>
      <div class="field"><label>${t('backup')}</label>
        <div style="display:flex;gap:8px"><button class="btn" id="stExport">${icon(I.save)} ${t('export_lib')}</button><button class="btn" id="stImport">${icon(I.open)} ${t('import_lib')}</button></div>
        <div class="hint">${t('backup_hint')}</div></div>
    </div>
    <div class="m-foot"><span class="left">Runfjord v${esc(ui.version || '1.0.0')}</span><button class="btn btn-primary" data-close>${t('done')}</button></div>`;
  openModal(html, 'wide');
  $('#stThemes').onclick = (e) => {
    const b = e.target.closest('.theme-card'); if (!b) return;
    st.themeId = b.dataset.themeId; applySettings(); persist();
    $$('#stThemes .theme-card').forEach((x) => {
      const on = x === b; x.classList.toggle('sel', on);
      const nm = x.querySelector('.tp-name'); nm.querySelector('svg')?.remove();
      if (on) nm.insertAdjacentHTML('beforeend', icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'));
    });
  };
  const markAccent = (val) => $$('#stAccent .swatch').forEach((x) => x.classList.toggle('sel', !x.classList.contains('swatch-custom') && x.dataset.c === val));
  $('#stAccent').onclick = (e) => { const b = e.target.closest('button.swatch'); if (!b) return; st.accent = b.dataset.c; applySettings(); persist(); markAccent(st.accent); };
  $('#stCustom').addEventListener('input', (e) => { st.accent = e.target.value; applySettings(); markAccent(null); $('.swatch-custom').classList.add('sel'); });
  $('#stCustom').addEventListener('change', () => persist());
  $('#stLang').addEventListener('change', (e) => {
    st.language = e.target.value; persist(); applyLanguage(); renderAll();
    closeModal(); openSettings();
  });
  $('#stExport').onclick = async () => { const p = await api.exportLib(JSON.stringify(lib, null, 2)); if (p) toast(t('lib_exported'), 'ok'); };
  $('#stImport').onclick = async () => {
    const txt = await api.importLib(); if (!txt) return;
    try {
      const inc = JSON.parse(txt);
      const known = new Set(lib.scripts.map((s) => s.path));
      let n = 0;
      (inc.categories || []).forEach((c) => ensureCategory(typeof c === 'string' ? c : c.name));
      (inc.scripts || []).forEach((s) => { if (s.path && !known.has(s.path)) { lib.scripts.push(newScriptObj({ ...s, id: uid() })); n++; } });
      persist(); await checkMissing(); renderAll(); toast(tn('imported_n', n), 'ok');
    } catch { toast(t('invalid_import'), 'err'); }
  };
}

// ---------- context menu ----------
function showContext(x, y, id) {
  closeContext();
  const s = getScript(id); if (!s) return;
  const run = ui.running.has(id);
  const m = document.createElement('div'); m.className = 'ctx'; m.id = 'ctx';
  m.innerHTML = `
    <button data-c="${run ? 'stop' : 'run'}">${icon(run ? I.stop : I.play)} ${run ? t('stop') : t('run')}</button>
    <button data-c="terminal">${icon(I.term)} ${t('run_terminal')}</button>
    <hr>
    <button data-c="edit">${icon(I.edit)} ${t('edit_details')}</button>
    <button data-c="code">${icon(I.code)} ${t('edit_code')}</button>
    <button data-c="fav">${icon(I.star)} ${s.favorite ? t('fav_remove') : t('fav_add')}</button>
    <button data-c="dup">${icon(I.dup)} ${t('dup_entry')}</button>
    <hr>
    <button data-c="openext">${icon(I.open)} ${t('open_default')}</button>
    <button data-c="folder">${icon(I.folder)} ${t('show_folder')}</button>
    <button data-c="copypath">${icon(I.copy)} ${t('copy_path')}</button>
    <hr>
    <button data-c="remove" class="danger">${icon(I.trash)} ${t('remove_from_lib')}</button>`;
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  m.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; closeContext(); doAction(b.dataset.c, id); };
}
function closeContext() { $('#ctx')?.remove(); }
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.ctx')) closeContext(); });
window.addEventListener('blur', closeContext);

async function doAction(act, id = ui.selectedId) {
  const s = getScript(id);
  switch (act) {
    case 'add': return addPaths(await api.pickFiles());
    case 'new': return openNewScript();
    case 'scan': return openScan();
    case 'run': return runScript(id);
    case 'stop': return stopScript(id);
    case 'terminal': return runInTerminal(id);
    case 'edit': return s && openEditor(s);
    case 'code': return select(id, 'code');
    case 'fav': return toggleFav(id);
    case 'dup': return duplicateScript(id);
    case 'remove': return removeScript(id);
    case 'openext': { const err = await api.openFile(s.path); if (err) toast(err, 'err'); return; }
    case 'folder': return api.showInFolder(s.path);
    case 'copypath': navigator.clipboard.writeText(s.path); return toast(t('path_copied'));
    case 'more': { const b = $('[data-act="more"]').getBoundingClientRect(); return showContext(b.left - 150, b.bottom + 6, id); }
    case 'savecode': return saveCode(id);
    case 'reload': delete ui.code[id]; return renderDetail();
    case 'clearout': ui.outputs[id] = []; return renderDetail();
    case 'copyout': navigator.clipboard.writeText((ui.outputs[id] || []).map((c) => c.text).join('').replace(ANSI, '')); return toast(t('output_copied'));
  }
}

// ================================================================
// events
// ================================================================
$('#btnAdd').onclick = () => doAction('add');
$('#btnFind').onclick = () => doAction('scan');
$('#btnNew').onclick = () => doAction('new');
$('#btnSettings').onclick = openSettings;
$('#btnAddCat').onclick = async () => {
  const n = await promptDialog(t('new_category'), t('name'));
  if (n) { const name = ensureCategory(n); persist(); ui.view = 'cat:' + name; renderAll(); }
};
$('#nav').onclick = (e) => { const b = e.target.closest('.nav-item'); if (!b) return; ui.view = b.dataset.view; renderSidebar(); renderList(); };
$('#cats').onclick = async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const item = e.target.closest('.nav-item'); if (!item) return;
  const cat = item.dataset.cat;
  if (act === 'rename') {
    e.stopPropagation();
    const n = await promptDialog(t('rename_category'), t('name'), cat);
    if (n && n !== cat) {
      const c = lib.categories.find((x) => x.name === cat); c.name = n;
      lib.scripts.forEach((s) => { if (s.category === cat) s.category = n; });
      if (ui.view === 'cat:' + cat) ui.view = 'cat:' + n;
      persist(); renderAll();
    }
    return;
  }
  if (act === 'delete') {
    e.stopPropagation();
    const count = lib.scripts.filter((s) => s.category === cat).length;
    if (!(await confirmDialog(t('delete_category_q'), t('delete_cat_text', { cat }) + (count ? ' ' + tn('delete_cat_n', count) : ''), t('delete')))) return;
    lib.categories = lib.categories.filter((x) => x.name !== cat);
    lib.scripts.forEach((s) => { if (s.category === cat) s.category = ''; });
    if (ui.view === 'cat:' + cat) ui.view = 'all';
    persist(); renderAll();
    return;
  }
  ui.view = item.dataset.view; renderSidebar(); renderList();
};
// drag card -> category
$('#list').addEventListener('dragstart', (e) => { const c = e.target.closest('.card'); if (c) e.dataTransfer.setData('text/script-id', c.dataset.id); });
$('#cats').addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('text/script-id')) return;
  const it = e.target.closest('.nav-item'); if (!it) return;
  e.preventDefault(); $$('#cats .nav-item').forEach((x) => x.classList.toggle('drop-target', x === it));
});
$('#cats').addEventListener('dragleave', (e) => { if (!e.relatedTarget || !$('#cats').contains(e.relatedTarget)) $$('#cats .nav-item').forEach((x) => x.classList.remove('drop-target')); });
$('#cats').addEventListener('drop', (e) => {
  const id = e.dataTransfer.getData('text/script-id'); const it = e.target.closest('.nav-item');
  $$('#cats .nav-item').forEach((x) => x.classList.remove('drop-target'));
  if (!id || !it) return;
  e.preventDefault(); e.stopPropagation();
  const s = getScript(id); s.category = it.dataset.cat; persist(); renderAll();
  toast(t('moved_to', { cat: it.dataset.cat || t('uncategorized') }), 'ok');
});

$('#list').addEventListener('click', (e) => {
  const star = e.target.closest('[data-star]'); if (star) { e.stopPropagation(); return toggleFav(star.dataset.star); }
  const run = e.target.closest('[data-run]');
  if (run) { e.stopPropagation(); const id = run.dataset.run; ui.selectedId = id; return ui.running.has(id) ? stopScript(id) : runScript(id); }
  const c = e.target.closest('.card'); if (c) select(c.dataset.id);
});
$('#list').addEventListener('dblclick', (e) => { const c = e.target.closest('.card'); if (c && !e.target.closest('button')) runScript(c.dataset.id); });
$('#list').addEventListener('contextmenu', (e) => { const c = e.target.closest('.card'); if (!c) return; e.preventDefault(); select(c.dataset.id); showContext(e.clientX, e.clientY, c.dataset.id); });
$('#detail').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]'); if (tab) { ui.tab = tab.dataset.tab; renderDetail(); return; }
  const a = e.target.closest('[data-act]'); if (a && !a.disabled) doAction(a.dataset.act);
});
$('#search').addEventListener('input', (e) => { ui.search = e.target.value; renderList(); });
$('#search').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.target.value = ''; ui.search = ''; renderList(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
  if (e.key === 'Enter') { const f = visibleScripts()[0]; if (f) select(f.id); }
});
$('#sortSel').addEventListener('change', (e) => { ui.sort = e.target.value; lib.settings.sort = ui.sort; persist(); renderList(); });

function moveSel(d) {
  const arr = visibleScripts(); if (!arr.length) return;
  let i = arr.findIndex((s) => s.id === ui.selectedId);
  i = i < 0 ? 0 : Math.max(0, Math.min(arr.length - 1, i + d));
  select(arr[i].id);
}

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  const modalOpen = $('#modalBackdrop').classList.contains('show');
  if (e.key === 'Escape') { if ($('#ctx')) return closeContext(); if (modalOpen) return closeModal(); }
  if (modalOpen) return;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (ui.selectedId) saveCode(ui.selectedId); return; }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); return openNewScript(); }
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); return doAction('add'); }
  if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); const ids = THEMES.map((t) => t.id); const i = ids.indexOf(activeTheme().id); lib.settings.themeId = ids[(i + 1) % ids.length]; applySettings(); persist(); return toast(t('theme_toast', { name: themeName(activeTheme()) })); }
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#search').focus(); $('#search').select(); return; }
  if (mod && e.key === 'Enter' && ui.selectedId) { e.preventDefault(); return ui.running.has(ui.selectedId) ? stopScript(ui.selectedId) : runScript(ui.selectedId); }
  if (e.key === 'F5' && ui.selectedId) { e.preventDefault(); return runScript(ui.selectedId); }
  if (mod && e.key.toLowerCase() === 'e' && ui.selectedId) { e.preventDefault(); return openEditor(getScript(ui.selectedId)); }
  if (inField) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
  if (e.key === 'Delete' && ui.selectedId) removeScript(ui.selectedId);
});

// file drag & drop from OS
let dragDepth = 0;
const isFileDrag = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', (e) => { if (!isFileDrag(e)) return; dragDepth++; $('#dropOverlay').classList.add('show'); });
window.addEventListener('dragleave', (e) => { if (!isFileDrag(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').classList.remove('show'); } });
window.addEventListener('dragover', (e) => { if (isFileDrag(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault(); dragDepth = 0; $('#dropOverlay').classList.remove('show');
  const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
  addPaths(paths);
});

async function checkMissing() {
  const res = await api.exists(lib.scripts.map((s) => s.path));
  ui.missing = new Set(lib.scripts.filter((_, i) => !res[i]).map((s) => s.id));
}
window.addEventListener('focus', async () => {
  const before = ui.missing.size; await checkMissing();
  if (before !== ui.missing.size) { renderList(); renderDetail(); }
});

// ================================================================
// boot
// ================================================================
(async function boot() {
  const info = await api.sysInfo();
  ui.platform = info.platform; ui.version = info.version; ui.sysLangs = info.languages;
  lib = await api.loadLibrary();
  lib.scripts ||= [];
  lib.settings ||= {};
  lib.categories = (lib.categories || []).map((c, i) => (typeof c === 'string' ? { name: c, color: CAT_COLORS[i % CAT_COLORS.length] } : c));
  ui.sort = lib.settings.sort || 'name';
  $('#sortSel').value = ui.sort;
  applySettings();
  applyLanguage();
  await checkMissing();
  renderAll();
})();
