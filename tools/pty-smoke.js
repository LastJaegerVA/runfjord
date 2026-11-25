// CI check: the built-in terminal's native part must load and run a command on this OS.
const pty = require('node-pty');
const isWin = process.platform === 'win32';
const p = pty.spawn(isWin ? 'cmd.exe' : 'bash', isWin ? ['/d', '/c', 'echo runfjord-pty-ok'] : ['-c', 'echo runfjord-pty-ok; [ -t 0 ] && echo tty-yes'], { cols: 80, rows: 24, cwd: process.cwd(), env: process.env });
let out = '';
p.onData((d) => { out += d; });
const timer = setTimeout(() => { console.error('timeout; output so far:', JSON.stringify(out)); process.exit(1); }, 20000);
p.onExit(({ exitCode }) => {
  clearTimeout(timer);
  const ok = out.includes('runfjord-pty-ok') && (isWin || out.includes('tty-yes'));
  console.log(ok ? `node-pty OK on ${process.platform} (exit ${exitCode})` : `node-pty output wrong: ${JSON.stringify(out)}`);
  process.exit(ok ? 0 : 1);
});
