// Runfjord wallpapers — original vector artwork drawn in code (no image files, no third-party art).
// Each wallpaper is an SVG string; the app turns it into a CSS background.
(function (root) {
  const W = 1600, H = 1000;
  // small seeded random generator, so stars and shapes are the same every time
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
  const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
  const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
  function stars(seed, n, maxY, color = '#fff') {
    const r = rng(seed); let out = '';
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * maxY, s = r() < 0.92 ? 0.6 + r() * 1.1 : 1.6 + r() * 1.2;
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="${color}" opacity="${(0.35 + r() * 0.6).toFixed(2)}"/>`;
    }
    return out;
  }
  // a mountain ridge: random peaks between y0-amp and y0, filled down to the bottom
  function ridge(seed, y0, amp, step, fill, extra = '') {
    const r = rng(seed); let d = `M0 ${H} L0 ${y0}`; let x = 0;
    while (x < W) { const nx = Math.min(W, x + step * (0.6 + r() * 0.8)); const py = y0 - r() * amp; d += ` L${((x + nx) / 2).toFixed(0)} ${py.toFixed(0)} L${nx.toFixed(0)} ${(y0 - r() * amp * 0.35).toFixed(0)}`; x = nx; }
    return `<path d="${d} L${W} ${H} Z" fill="${fill}" ${extra}/>`;
  }
  // a smooth hill / dune / wave line, filled down to the bottom
  function wave(seed, y0, amp, n, fill, extra = '') {
    const r = rng(seed); const pts = []; for (let i = 0; i <= n; i++) pts.push([i * W / n, y0 - amp / 2 + r() * amp]);
    let d = `M0 ${H} L${pts[0][0]} ${pts[0][1].toFixed(0)}`;
    for (let i = 1; i < pts.length; i++) { const [px, py] = pts[i - 1], [x, y] = pts[i]; const mx = (px + x) / 2; d += ` C${mx.toFixed(0)} ${py.toFixed(0)} ${mx.toFixed(0)} ${y.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}`; }
    return `<path d="${d} L${W} ${H} Z" fill="${fill}" ${extra}/>`;
  }

  const WALLPAPERS = {
    // night over a fjord: stars, moon, layered mountains and a still water reflection
    fjordnatt: () => svg(
      lin('s', [[0, '#050814'], [0.55, '#0d1838'], [1, '#22305c']]) + rad('m', [[0, '#dfe8ff', 0.55], [1, '#dfe8ff', 0]]) + lin('w', [[0, '#0b1430'], [1, '#050914']]),
      `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(7, 260, 560)}
       <circle cx="1180" cy="210" r="160" fill="url(#m)"/><circle cx="1180" cy="210" r="46" fill="#eef3ff" opacity=".92"/>
       ${ridge(11, 610, 300, 300, '#1a2550')}${ridge(12, 670, 210, 240, '#121a3b')}${ridge(13, 725, 120, 200, '#0b1129')}
       <rect y="720" width="${W}" height="${H - 720}" fill="url(#w)"/>
       <rect x="1150" y="740" width="60" height="3" rx="1.5" fill="#dfe8ff" opacity=".45"/><rect x="1130" y="760" width="100" height="2" rx="1" fill="#dfe8ff" opacity=".25"/><rect x="1160" y="785" width="40" height="2" rx="1" fill="#dfe8ff" opacity=".2"/>`),
    // early morning: warm sky, low sun, soft pastel ranges
    morgengry: () => svg(
      lin('s', [[0, '#f6d7e0'], [0.5, '#fbe3d3'], [1, '#fdf1e6']]) + rad('u', [[0, '#fff5e0', 1], [0.4, '#ffd9b0', 0.6], [1, '#ffd9b0', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="430" cy="560" r="330" fill="url(#u)"/><circle cx="430" cy="560" r="70" fill="#fff4e4"/>
       ${ridge(21, 640, 230, 190, '#ecc3cf', 'opacity=".75"')}${ridge(22, 720, 170, 150, '#e0aebf', 'opacity=".8"')}${wave(23, 840, 90, 6, '#d49aae', 'opacity=".75"')}${wave(24, 920, 60, 5, '#c98aa1', 'opacity=".7"')}`),
    // deep sea: light from above, layered swells
    havdyp: () => svg(
      lin('s', [[0, '#0e4650'], [0.45, '#082c35'], [1, '#03141a']]) + lin('ray', [[0, '#7fe9e4', 0.18], [1, '#7fe9e4', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#s)"/>
       <path d="M520 0 L700 0 L980 1000 L620 1000Z" fill="url(#ray)"/><path d="M820 0 L900 0 L1260 1000 L1080 1000Z" fill="url(#ray)" opacity=".7"/><path d="M260 0 L330 0 L420 1000 L240 1000Z" fill="url(#ray)" opacity=".5"/>
       ${wave(31, 520, 120, 7, '#0a3a44', 'opacity=".55"')}${wave(32, 640, 110, 6, '#072d36', 'opacity=".7"')}${wave(33, 770, 90, 5, '#05222a', 'opacity=".85"')}${wave(34, 890, 70, 5, '#03161c')}
       ${stars(35, 70, 1000, '#9ff5ef').replace(/r="[\d.]+"/g, (m) => `r="${(parseFloat(m.slice(3)) * 1.6).toFixed(2)}"`)}`),
    // a nebula: glowing clouds of colour and dense stars
    nebula: () => svg(
      rad('a', [[0, '#c04cff', 0.55], [1, '#c04cff', 0]]) + rad('b', [[0, '#3f7bff', 0.45], [1, '#3f7bff', 0]]) + rad('c', [[0, '#ff4f9a', 0.35], [1, '#ff4f9a', 0]]),
      `<rect width="${W}" height="${H}" fill="#07040f"/>
       <ellipse cx="1050" cy="380" rx="620" ry="360" fill="url(#a)"/><ellipse cx="520" cy="640" rx="560" ry="330" fill="url(#b)"/><ellipse cx="1300" cy="780" rx="420" ry="260" fill="url(#c)"/>
       ${stars(41, 420, 1000)}<circle cx="980" cy="350" r="2.6" fill="#fff"/><circle cx="980" cy="350" r="14" fill="#fff" opacity=".12"/>`),
    // desert dunes in warm light
    dunes: () => svg(
      lin('s', [[0, '#f9e6c8'], [1, '#fdf4e6']]) + lin('d1', [[0, '#e8c48f'], [1, '#d9a866']], 1, 0) + lin('d2', [[0, '#dcae70'], [1, '#c98f4b']], 1, 0),
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1220" cy="260" r="90" fill="#fff1d6" opacity=".9"/>
       ${wave(51, 560, 140, 4, '#efd3a6', 'opacity=".9"')}${wave(52, 680, 160, 4, 'url(#d1)', 'opacity=".9"')}${wave(53, 820, 140, 3, 'url(#d2)', 'opacity=".9"')}${wave(54, 930, 70, 4, '#b97f3d', 'opacity=".85"')}`),
    // glacier ice: pale low-poly facets
    glacier: () => {
      const r = rng(61); let tri = ''; const cols = 9, rows = 6, cw = W / cols, rh = H / rows; const pts = [];
      for (let y = 0; y <= rows; y++) { pts.push([]); for (let x = 0; x <= cols; x++) pts[y].push([x * cw + (x && x < cols ? (r() - 0.5) * cw * 0.6 : 0), y * rh + (y && y < rows ? (r() - 0.5) * rh * 0.6 : 0)]); }
      const shade = (y) => { const l = 96 - y * 2.2 - r() * 6; return `hsl(${196 + r() * 12} ${40 + r() * 25}% ${l.toFixed(0)}%)`; };
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const [a, b, c, d] = [pts[y][x], pts[y][x + 1], pts[y + 1][x], pts[y + 1][x + 1]]; const P = (...q) => q.map((p) => p.map((v) => v.toFixed(0)).join(' ')).join(' L');
        tri += `<path d="M${P(a, b, d)}Z" fill="${shade(y)}"/><path d="M${P(a, d, c)}Z" fill="${shade(y + 0.5)}"/>`;
      }
      return svg('', `<rect width="${W}" height="${H}" fill="#eaf5fa"/>${tri}`);
    },
    // soft blossom petals drifting
    blossom: () => {
      const r = rng(71); let petals = '';
      for (let i = 0; i < 70; i++) {
        const x = r() * W, y = r() * H, s = 10 + r() * 26, rot = r() * 360, c = ['#f4a8c7', '#f7bfd6', '#efb0c9', '#fbd3e2', '#e98fb5'][Math.floor(r() * 5)];
        petals += `<path transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot.toFixed(0)}) scale(${(s / 20).toFixed(2)})" d="M0 -14 C9 -12 12 -2 0 14 C-12 -2 -9 -12 0 -14Z" fill="${c}" opacity="${(0.35 + r() * 0.45).toFixed(2)}"/>`;
      }
      return svg(lin('s', [[0, '#fdf0f5'], [1, '#f6e1ea']]) + rad('g', [[0, '#ffffff', 0.8], [1, '#ffffff', 0]]),
        `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="300" cy="220" r="420" fill="url(#g)"/>${wave(72, 880, 80, 5, '#f1cfdc', 'opacity=".7"')}${petals}`);
    },
    // mossy hills in evening mist
    moss: () => svg(
      lin('s', [[0, '#1c2a1a'], [1, '#0a0f0a']]) + lin('f', [[0, '#cfe3b8', 0], [0.5, '#cfe3b8', 0.1], [1, '#cfe3b8', 0]]),
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1240" cy="230" r="70" fill="#e9f2d6" opacity=".18"/>
       ${wave(81, 520, 160, 5, '#223522')}<rect y="470" width="${W}" height="160" fill="url(#f)"/>${wave(82, 650, 150, 5, '#1a2a19')}<rect y="610" width="${W}" height="140" fill="url(#f)"/>${wave(83, 790, 130, 4, '#121d12')}${wave(84, 910, 80, 4, '#0b120b')}`),
  };

  const cache = {};
  function wallpaperCSS(id) {
    if (!WALLPAPERS[id]) return 'none';
    if (!cache[id]) cache[id] = `url('data:image/svg+xml,${encodeURIComponent(WALLPAPERS[id]())}')`;
    return cache[id];
  }
  root.Wallpapers = { ids: Object.keys(WALLPAPERS), css: wallpaperCSS, svg: (id) => WALLPAPERS[id] && WALLPAPERS[id]() };
})(typeof window !== 'undefined' ? window : globalThis);
