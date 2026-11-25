const { app, BrowserWindow, ipcMain, dialog, shell, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const I18N = require('./renderer/i18n.js');
const t = I18N.t;

const isWin = process.platform === 'win32';
let win;
const running = new Map(); // scriptId -> child process

// ---------- storage ----------
const dataFile = () => path.join(app.getPath('userData'), 'library.json');

function loadLibrary() {
  // one-time migration: the app used to be called "Scriptorium"
  try {
    const oldFile = path.join(app.getPath('appData'), 'Scriptorium', 'library.json');
    if (!fs.existsSync(dataFile()) && fs.existsSync(oldFile)) {
      fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
      fs.copyFileSync(oldFile, dataFile());
    }
  } catch {}
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return { scripts: [], categories: ['General'], settings: { theme: 'dark', accent: '#7c6cff' } };
  }
}
function saveLibrary(lib) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(lib, null, 2));
  fs.renameSync(tmp, dataFile());
  return true;
}

// ---------- interpreters ----------
function has(cmd) {
  try {
    execSync(isWin ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function detectCommand(file) {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case '.sh': case '.bash': return { cmd: 'bash', args: [file] };
    case '.zsh': return { cmd: 'zsh', args: [file] };
    case '.fish': return { cmd: 'fish', args: [file] };
    case '.py': return { cmd: isWin ? 'python' : 'python3', args: ['-u', file] };
    case '.js': case '.mjs': case '.cjs': return { cmd: 'node', args: [file] };
    case '.ts': return { cmd: 'npx', args: ['tsx', file] };
    case '.rb': return { cmd: 'ruby', args: [file] };
    case '.pl': return { cmd: 'perl', args: [file] };
    case '.lua': return { cmd: 'lua', args: [file] };
    case '.php': return { cmd: 'php', args: [file] };
    case '.ps1':
      return { cmd: isWin ? 'powershell' : 'pwsh', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file] };
    case '.bat': case '.cmd': return { cmd: 'cmd.exe', args: ['/d', '/c', file] };
    default: return { cmd: file, args: [] };
  }
}

// split "a b 'c d'" -> ['a','b','c d']
function splitArgs(str) {
  if (!str || !str.trim()) return [];
  const out = []; let cur = ''; let q = null;
  for (const ch of str) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function buildCommand(script) {
  const extra = splitArgs(script.args);
  if (script.command && script.command.trim()) {
    // custom command: {file} placeholder supported
    const parts = splitArgs(script.command.replace(/\{file\}/g, `"${script.path}"`));
    const hasFile = script.command.includes('{file}');
    return { cmd: parts[0], args: [...parts.slice(1), ...(hasFile ? [] : [script.path]), ...extra] };
  }
  const d = detectCommand(script.path);
  return { cmd: d.cmd, args: [...d.args, ...extra] };
}

function quote(a) { return /[\s"']/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a; }

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 840, minWidth: 980, minHeight: 620,
    backgroundColor: '#0f1117',
    title: 'Runfjord',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icons/256x256.png' : 'icons/512x512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  for (const p of running.values()) { try { isWin ? p.kill() : process.kill(-p.pid, 'SIGTERM'); } catch {} }
  for (const id of [...terms.keys()]) killTerm(id, true);
  app.quit();
});

// ---------- IPC ----------
ipcMain.handle('lib:load', () => loadLibrary());
ipcMain.handle('lib:save', (_e, lib) => saveLibrary(lib));
ipcMain.handle('sys:info', () => {
  let languages = [];
  try { languages = app.getPreferredSystemLanguages(); } catch {}
  if (!languages.length) languages = [app.getLocale()];
  return { platform: process.platform, home: app.getPath('home'), version: app.getVersion(), languages };
});
ipcMain.handle('i18n:set', (_e, code) => I18N.setLang(code));

ipcMain.handle('dlg:pickFiles', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: t('dlg_add_title'), properties: ['openFile', 'multiSelections'],
    filters: [
      { name: t('filter_scripts'), extensions: ['sh', 'bash', 'zsh', 'fish', 'py', 'js', 'mjs', 'ts', 'ps1', 'bat', 'cmd', 'rb', 'pl', 'lua', 'php'] },
      { name: t('filter_all'), extensions: ['*'] },
    ],
  });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('dlg:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dlg:saveNew', async (_e, suggested) => {
  const r = await dialog.showSaveDialog(win, { title: t('dlg_new_title'), defaultPath: path.join(app.getPath('home'), suggested || 'new-script.sh') });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('dlg:export', async (_e, json) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: 'script-library.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return false;
  fs.writeFileSync(r.filePath, json); return r.filePath;
});
ipcMain.handle('dlg:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

ipcMain.handle('fs:read', (_e, p) => {
  try {
    const st = fs.statSync(p);
    if (st.size > 2 * 1024 * 1024) return { ok: false, error: t('too_big') };
    return { ok: true, content: fs.readFileSync(p, 'utf8'), mtime: st.mtimeMs, size: st.size };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('fs:write', (_e, p, content) => {
  try {
    fs.writeFileSync(p, content);
    if (!isWin && /\.(sh|bash|zsh|fish)$/i.test(p)) { try { fs.chmodSync(p, 0o755); } catch {} }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('fs:exists', (_e, paths) => paths.map((p) => { try { return fs.existsSync(p); } catch { return false; } }));
ipcMain.handle('fs:stat', (_e, p) => { try { const s = fs.statSync(p); return { size: s.size, mtime: s.mtimeMs }; } catch { return null; } });

// ---------- updates ----------
// Runfjord only ever talks to GitHub, and only to ask for its own latest release. Nothing is
// downloaded or installed unless the user clicks "Update", and every download is checked
// against the SHA-256 checksum GitHub publishes for that file before it is used.
const REPO = 'LastJaegerVA/runfjord';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const PACMAN_CMD = `curl -fLo /tmp/runfjord.pkg.tar.xz https://github.com/${REPO}/releases/latest/download/Runfjord-Linux-Arch-x86_64.pkg.tar.xz && sudo pacman -U /tmp/runfjord.pkg.tar.xz`;

function installKind() {
  if (!app.isPackaged) return 'dev';
  if (isWin) return 'windows';
  if (process.platform === 'linux' && process.env.APPIMAGE) return 'appimage';
  if (process.platform === 'linux' && app.getAppPath().startsWith('/opt/')) return 'pacman';
  return 'other';
}
const verParts = (v) => String(v || '').replace(/^v/, '').split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
function isNewer(a, b) { const x = verParts(a), y = verParts(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; }

let lastRelease = null;
// the release text starts with "What's new" (from CHANGELOG.md) and then install steps; keep only the first part
function releaseNotes(body) {
  let txt = String(body || '').split(/^#{1,3}\s*(Install|Download)/im)[0];
  txt = txt.replace(/^#{1,4}\s*What.s new\s*$/im, '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  return txt.slice(0, 4000);
}
async function checkForUpdate() {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Runfjord/${app.getVersion()}` },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const r = await res.json();
  const latest = String(r.tag_name || '').replace(/^v/, '');
  const kind = installKind();
  const want = kind === 'windows' ? /^Runfjord-(Windows-)?Setup-.*\.exe$/i : kind === 'appimage' ? /^Runfjord-.*x86_64\.AppImage$/i : kind === 'pacman' ? /x86_64\.pkg\.tar\.(xz|zst)$/i : null;
  const asset = want ? (r.assets || []).find((a) => want.test(a.name)) : null;
  lastRelease = { latest, asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size, digest: asset.digest || '' } : null };
  return {
    current: app.getVersion(), latest, newer: isNewer(latest, app.getVersion()), kind,
    notes: releaseNotes(r.body), url: r.html_url || RELEASES_URL,
    canInstall: !!(asset && /^sha256:[0-9a-f]{64}$/.test(asset.digest || '')), command: kind === 'pacman' ? PACMAN_CMD : '',
  };
}

async function downloadVerified(asset, dest, sender) {
  const res = await net.fetch(asset.url, { headers: { 'User-Agent': `Runfjord/${app.getVersion()}` } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const hash = crypto.createHash('sha256'); const out = fs.createWriteStream(dest); let got = 0, last = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      const buf = Buffer.from(value); hash.update(buf); got += buf.length;
      if (!out.write(buf)) await new Promise((r) => out.once('drain', r));
      const now = Date.now(); if (now - last > 200) { last = now; sender.send('update:progress', asset.size ? got / asset.size : 0); }
    }
  } finally { await new Promise((r) => out.end(r)); }
  const sum = 'sha256:' + hash.digest('hex');
  if (sum !== asset.digest) { try { fs.unlinkSync(dest); } catch {} throw new Error('The download did not match GitHub’s checksum, so it was not used.'); }
  sender.send('update:progress', 1);
}

async function installUpdate(sender) {
  const kind = installKind(); const a = lastRelease?.asset;
  if (!a || !/^sha256:[0-9a-f]{64}$/.test(a.digest)) throw new Error('No verified download for this kind of install.');
  if (kind === 'windows') {
    const dest = path.join(os.tmpdir(), a.name.replace(/[^\w.-]/g, '_'));
    await downloadVerified(a, dest, sender);
    // start the normal installer (with its usual windows) and close Runfjord so it can replace the files
    spawn(dest, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 400);
    return true;
  }
  if (kind === 'appimage') {
    const target = process.env.APPIMAGE; const tmp = target + '.download';
    await downloadVerified(a, tmp, sender);
    fs.chmodSync(tmp, 0o755); fs.renameSync(tmp, target);
    app.relaunch({ execPath: target, args: [] }); setTimeout(() => app.exit(0), 300);
    return true;
  }
  if (kind === 'pacman') {
    // Arch/CachyOS: pacman owns the files, so pacman does the update. pkexec shows the system's
    // normal password window; nothing runs as root without the user typing their password there.
    if (!has('pkexec')) throw new Error('pkexec was not found. Use the command below instead.');
    const dest = path.join(os.tmpdir(), `runfjord-update-${Date.now()}.pkg.tar.xz`);
    await downloadVerified(a, dest, sender);
    const code = await new Promise((resolve) => {
      const p = spawn('pkexec', ['pacman', '-U', '--noconfirm', dest], { stdio: 'ignore' });
      p.on('error', () => resolve(-1)); p.on('exit', (c) => resolve(c));
    });
    try { fs.unlinkSync(dest); } catch {}
    if (code !== 0) throw new Error(code === 126 || code === 127 ? 'The password window was closed, so nothing was changed.' : `pacman stopped with code ${code}.`);
    app.relaunch(); setTimeout(() => app.exit(0), 300);
    return true;
  }
  throw new Error('This install can’t update itself.');
}
ipcMain.handle('update:check', async () => { try { return { ok: true, ...(await checkForUpdate()) }; } catch (e) { return { ok: false, error: String(e.message || e) }; } });
ipcMain.handle('update:install', async (e) => { try { return { ok: await installUpdate(e.sender) }; } catch (err) { return { ok: false, error: String(err.message || err) }; } });
ipcMain.handle('update:openPage', () => shell.openExternal(RELEASES_URL));

// ---------- find scripts already on this computer ----------
const SCRIPT_EXT = new Set(['.sh', '.bash', '.zsh', '.fish', '.py', '.js', '.mjs', '.cjs', '.ts', '.rb', '.pl', '.lua', '.php', '.ps1', '.bat', '.cmd']);
// folders that hold programs, libraries, caches or system files rather than the user's own scripts
const SKIP_DIRS = new Set(['node_modules', 'bower_components', 'vendor', 'venv', 'env', 'site-packages', 'dist-packages', '__pycache__',
  'dist', 'build', 'out', 'target', 'bin-release', 'appdata', 'application data', 'library', 'program files', 'program files (x86)', 'programdata',
  'windows', 'steamapps', 'steam', 'snap', 'flatpak', 'go', 'miniconda3', 'anaconda3', 'lib', 'lib64', 'include', 'share', 'games', 'onedrive temp']);
const SCAN_MAX_FILES = 3000, SCAN_MAX_DEPTH = 6, SCAN_MAX_SIZE = 1024 * 1024;

function scanDefaults() {
  const home = app.getPath('home');
  const pick = (k) => { try { return app.getPath(k); } catch { return null; } };
  const list = isWin
    ? [path.join(home, 'scripts'), path.join(home, 'Scripts'), path.join(home, 'bin'), pick('documents'), pick('desktop'), pick('downloads')]
    : [path.join(home, 'bin'), path.join(home, '.local', 'bin'), path.join(home, 'scripts'), path.join(home, 'Scripts'), pick('documents'), pick('desktop'), pick('downloads')];
  // never the whole home folder: on some systems "Documents" falls back to it
  let homeReal = home; try { homeReal = fs.realpathSync(home); } catch {}
  const seen = new Set([isWin ? homeReal.toLowerCase() : homeReal]);
  return list.filter((d) => {
    if (!d) return false;
    let real; try { real = fs.realpathSync(d); } catch { return false; }
    const key = isWin ? real.toLowerCase() : real;
    if (seen.has(key)) return false; seen.add(key);
    try { return fs.statSync(real).isDirectory(); } catch { return false; }
  });
}

function readHead(file) {
  try {
    const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, 4096, 0); fs.closeSync(fd);
    return buf.subarray(0, n);
  } catch { return null; }
}
const looksBinary = (buf) => buf.includes(0);

async function scanFolders(roots, sender) {
  const found = []; const seen = new Set(); let lastPing = 0;
  const ping = (done) => { const now = Date.now(); if (done || now - lastPing > 150) { lastPing = now; sender.send('scan:progress', found.length); } };
  async function walk(dir, depth, isRoot) {
    if (found.length >= SCAN_MAX_FILES || depth > SCAN_MAX_DEPTH) return;
    let entries; try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    // a Python virtual environment or a git checkout of someone else's project is not "your scripts"
    if (!isRoot && entries.some((e) => e.name === 'pyvenv.cfg')) return;
    for (const e of entries) {
      if (found.length >= SCAN_MAX_FILES) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name.toLowerCase())) continue;
        await walk(full, depth + 1, false);
      } else if (e.isFile() || e.isSymbolicLink()) {
        const ext = path.extname(e.name).toLowerCase();
        let st; try { st = await fs.promises.stat(full); } catch { continue; }
        if (!st.isFile() || st.size === 0 || st.size > SCAN_MAX_SIZE) continue;
        let ok = SCRIPT_EXT.has(ext);
        // Linux/macOS: an executable file with no extension that starts with #! is a script too
        if (!ok && !isWin && !ext && (st.mode & 0o111)) { const h = readHead(full); ok = !!h && h[0] === 0x23 && h[1] === 0x21; }
        if (!ok) continue;
        let real; try { real = await fs.promises.realpath(full); } catch { continue; }
        if (seen.has(real)) continue; seen.add(real);
        const head = readHead(real); if (!head || looksBinary(head)) continue;
        found.push({ path: real, folder: path.basename(path.dirname(real)), head: head.toString('utf8') });
        ping();
      }
    }
  }
  for (const r of roots) await walk(r, 0, true);
  ping(true);
  return { files: found, capped: found.length >= SCAN_MAX_FILES };
}
ipcMain.handle('scan:defaults', () => scanDefaults());
ipcMain.handle('scan:run', (e, roots) => scanFolders(roots.filter((r) => typeof r === 'string'), e.sender));

ipcMain.handle('shell:openFile', (_e, p) => shell.openPath(p));
ipcMain.handle('shell:showInFolder', (_e, p) => shell.showItemInFolder(p));

ipcMain.handle('run:preview', (_e, script) => {
  const { cmd, args } = buildCommand(script);
  return [cmd, ...args].map(quote).join(' ');
});

ipcMain.handle('run:start', (_e, script) => {
  if (running.has(script.id) || terms.has(script.id)) return { ok: false, error: t('already_running') };
  if (!fs.existsSync(script.path)) return { ok: false, error: t('file_not_found_p', { p: script.path }) };
  const { cmd, args } = buildCommand(script);
  const cwd = script.cwd && fs.existsSync(script.cwd) ? script.cwd : path.dirname(script.path);
  let child;
  try {
    child = spawn(cmd, args, {
      cwd, env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' },
      shell: false, windowsHide: true, detached: !isWin, // own process group so Stop kills children too
    });
  } catch (e) { return { ok: false, error: e.message }; }
  running.set(script.id, child);
  const started = Date.now();
  const send = (type, data) => { if (!win.isDestroyed()) win.webContents.send('run:event', { id: script.id, type, data }); };
  child.stdout.on('data', (d) => send('stdout', d.toString()));
  child.stderr.on('data', (d) => send('stderr', d.toString()));
  child.on('error', (err) => {
    send('stderr', `\n✖ ${t('could_not_start', { cmd, err: err.message })}\n` +
      (err.code === 'ENOENT' ? `  ${t('enoent_hint', { cmd })}\n` : ''));
  });
  child.on('close', (code, signal) => {
    running.delete(script.id);
    send('exit', { code, signal, ms: Date.now() - started });
  });
  return { ok: true, command: [cmd, ...args].map(quote).join(' '), cwd, pid: child.pid };
});

ipcMain.handle('run:stdin', (_e, id, text) => {
  const c = running.get(id); if (!c) return false;
  try { c.stdin.write(text); return true; } catch { return false; }
});

ipcMain.handle('run:stop', (_e, id) => {
  const c = running.get(id); if (!c) return false;
  try {
    if (isWin) spawn('taskkill', ['/pid', String(c.pid), '/T', '/F']);
    else { try { process.kill(-c.pid, 'SIGTERM'); } catch { c.kill('SIGTERM'); } }
    setTimeout(() => {
      if (running.has(id)) { try { isWin ? c.kill() : process.kill(-c.pid, 'SIGKILL'); } catch {} }
    }, 2500);
  } catch {}
  return true;
});

// ---------- administrator rights ----------
// Windows only lets an elevated (administrator) program show its output in a non-elevated window
// through a separate console. So to run admin scripts inside Runfjord, Runfjord itself restarts
// elevated (the normal Windows "Run as administrator" prompt), then starts the waiting script.
let elevatedCache = null;
function isElevated() {
  if (elevatedCache !== null) return elevatedCache;
  try {
    if (isWin) { execSync('fltmc', { stdio: 'ignore', windowsHide: true }); elevatedCache = true; }
    else elevatedCache = typeof process.getuid === 'function' && process.getuid() === 0;
  } catch { elevatedCache = false; }
  return elevatedCache;
}
const RUN_FLAG = '--runfjord-run=';
const pendingRun = (process.argv.find((a) => a.startsWith(RUN_FLAG)) || '').slice(RUN_FLAG.length) || null;
ipcMain.handle('admin:status', () => ({ elevated: isElevated(), platform: process.platform, pendingRun }));
ipcMain.handle('admin:relaunch', async (_e, scriptId) => {
  if (!isWin) return { ok: false, error: 'Only needed on Windows.' };
  if (isElevated()) return { ok: false, error: 'Already running as administrator.' };
  const args = [...(app.isPackaged ? [] : [app.getAppPath()]), ...(scriptId ? [RUN_FLAG + String(scriptId).replace(/[^\w-]/g, '')] : [])];
  const psq = (x) => `'${String(x).replace(/'/g, "''")}'`;
  const ps = `try { Start-Process -FilePath ${psq(process.execPath)} ${args.length ? `-ArgumentList ${args.map(psq).join(',')}` : ''} -Verb RunAs -ErrorAction Stop; exit 0 } catch { exit 1 }`;
  const code = await new Promise((resolve) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
    p.on('error', () => resolve(-1)); p.on('exit', (c) => resolve(c));
  });
  if (code !== 0) return { ok: false, declined: true };
  // the elevated copy is starting: stop our scripts and close this window
  for (const id of [...terms.keys()]) killTerm(id, true);
  for (const c of running.values()) { try { spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { windowsHide: true }); } catch {} }
  setTimeout(() => app.quit(), 300);
  return { ok: true };
});

// ---------- built-in terminal (a real pseudo-terminal, shown with xterm.js) ----------
// node-pty is loaded only when first needed, and any failure just means "use a separate window".
let pty = null, ptyError = null;
function loadPty() {
  if (pty || ptyError) return pty;
  try { pty = require('node-pty'); } catch (e) { ptyError = String(e && e.message || e); console.error('node-pty unavailable:', ptyError); }
  return pty;
}
const terms = new Map(); // script id -> { p, buf, timer }

function resolveExe(cmd) {
  // the pseudo-terminal needs a real program path: look the command up on PATH ourselves
  if (path.isAbsolute(cmd) || cmd.includes('/') || cmd.includes('\\')) return fs.existsSync(cmd) ? cmd : null;
  const exts = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').map((e) => e.toLowerCase()) : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of isWin && !path.extname(cmd) ? exts : ['']) {
      const full = path.join(dir, cmd + ext);
      try { if (fs.statSync(full).isFile()) return full; } catch {}
    }
  }
  return null;
}

function killTerm(id, hard) {
  const s = terms.get(id); if (!s) return;
  const pid = s.p.pid;
  try {
    if (isWin) { spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }); }
    else { try { process.kill(-pid, hard ? 'SIGKILL' : 'SIGHUP'); } catch { s.p.kill(hard ? 'SIGKILL' : 'SIGHUP'); } }
  } catch {}
}

ipcMain.handle('term:available', () => ({ ok: !!loadPty(), error: ptyError }));

ipcMain.handle('term:start', (e, script, cols, rows) => {
  if (running.has(script.id) || terms.has(script.id)) return { ok: false, error: t('already_running') };
  if (!fs.existsSync(script.path)) return { ok: false, error: t('file_not_found_p', { p: script.path }) };
  const P = loadPty();
  if (!P) return { ok: false, fallback: true, error: ptyError };
  let { cmd, args } = buildCommand(script);
  const cwd = script.cwd && fs.existsSync(script.cwd) ? script.cwd : path.dirname(script.path);
  if (script.admin && !isWin && !isElevated()) { args = ['--', cmd, ...args]; cmd = 'sudo'; }
  // on Windows, app-store shortcuts (like python.exe) can't be checked as files; let Windows find them
  const exe = resolveExe(cmd) || (isWin ? cmd : null);
  if (!exe) return { ok: false, error: `${t('could_not_start', { cmd, err: 'not found' })}\n${t('enoent_hint', { cmd })}` };
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', RUNFJORD: '1' };
  delete env.FORCE_COLOR; delete env.NO_COLOR; delete env.ELECTRON_RUN_AS_NODE;
  let p;
  try {
    p = P.spawn(exe, args, {
      name: 'xterm-256color', cwd, env,
      cols: Math.max(20, Math.min(500, cols | 0 || 100)), rows: Math.max(5, Math.min(300, rows | 0 || 30)),
      ...(isWin ? { useConpty: true } : {}),
    });
  } catch (err) { return { ok: false, fallback: /pty|conpty|winpty/i.test(String(err.message)), error: String(err.message || err) }; }
  const sess = { p, buf: '', timer: null };
  terms.set(script.id, sess);
  const started = Date.now();
  const sender = e.sender;
  const flush = () => { sess.timer = null; if (sess.buf && !sender.isDestroyed()) sender.send('term:data', script.id, sess.buf); sess.buf = ''; };
  // batch output for a few milliseconds so very chatty scripts don't flood the window
  p.onData((d) => { sess.buf += d; if (sess.buf.length > 256 * 1024) flush(); else if (!sess.timer) sess.timer = setTimeout(flush, 8); });
  const sigName = (n) => (n ? Object.keys(os.constants.signals).find((k) => os.constants.signals[k] === n) || String(n) : null);
  p.onExit(({ exitCode, signal }) => {
    signal = sigName(signal);
    if (sess.timer) clearTimeout(sess.timer); flush();
    terms.delete(script.id);
    if (!sender.isDestroyed()) sender.send('term:exit', script.id, { code: exitCode, signal: signal || null, ms: Date.now() - started });
  });
  return { ok: true, command: [cmd, ...args].map(quote).join(' '), cwd, pid: p.pid };
});
ipcMain.handle('term:input', (_e, id, data) => { const s = terms.get(id); if (!s) return false; try { s.p.write(String(data)); return true; } catch { return false; } });
ipcMain.handle('term:resize', (_e, id, cols, rows) => {
  const s = terms.get(id); if (!s) return false;
  try { s.p.resize(Math.max(20, Math.min(500, cols | 0)), Math.max(5, Math.min(300, rows | 0))); return true; } catch { return false; }
});
ipcMain.handle('term:stop', (_e, id) => {
  if (!terms.has(id)) return false;
  killTerm(id, false);
  setTimeout(() => { if (terms.has(id)) killTerm(id, true); }, 2500);
  return true;
});

ipcMain.handle('run:terminal', (_e, script) => {
  if (!fs.existsSync(script.path)) return { ok: false, error: t('file_not_found') };
  const { cmd, args } = buildCommand(script);
  const cwd = script.cwd && fs.existsSync(script.cwd) ? script.cwd : path.dirname(script.path);
  const line = [cmd, ...args].map(quote).join(' ');
  try {
    if (isWin) {
      spawn('cmd.exe', ['/c', 'start', '"Runfjord"', 'cmd.exe', '/k', line], { cwd, shell: true, detached: true });
      return { ok: true };
    }
    const hold = `${line}; echo; read -n 1 -s -r -p "${t('press_key').replace(/"/g, '')}"`;
    const terms = [
      ['konsole', ['--workdir', cwd, '-e', 'bash', '-c', hold]],
      ['gnome-terminal', ['--working-directory=' + cwd, '--', 'bash', '-c', hold]],
      ['kitty', ['--directory', cwd, 'bash', '-c', hold]],
      ['alacritty', ['--working-directory', cwd, '-e', 'bash', '-c', hold]],
      ['wezterm', ['start', '--cwd', cwd, '--', 'bash', '-c', hold]],
      ['foot', ['-D', cwd, 'bash', '-c', hold]],
      ['xfce4-terminal', ['--working-directory=' + cwd, '-x', 'bash', '-c', hold]],
      ['xterm', ['-e', 'bash', '-c', hold]],
    ];
    for (const [t, a] of terms) {
      if (has(t)) { spawn(t, a, { cwd, detached: true, stdio: 'ignore' }).unref(); return { ok: true, terminal: t }; }
    }
    return { ok: false, error: t('no_terminal') };
  } catch (e) { return { ok: false, error: e.message }; }
});
