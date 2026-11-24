const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
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

ipcMain.handle('shell:openFile', (_e, p) => shell.openPath(p));
ipcMain.handle('shell:showInFolder', (_e, p) => shell.showItemInFolder(p));

ipcMain.handle('run:preview', (_e, script) => {
  const { cmd, args } = buildCommand(script);
  return [cmd, ...args].map(quote).join(' ');
});

ipcMain.handle('run:start', (_e, script) => {
  if (running.has(script.id)) return { ok: false, error: t('already_running') };
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
