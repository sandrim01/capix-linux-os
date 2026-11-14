#!/usr/bin/env node
// Capix — coleção de papéis de parede originais em estilo anime (cenários, sem personagens).
// Gera art/wallpapers/<id>.svg. render-assets.mjs converte para PNG e instala como pacotes do Plasma.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'art/wallpapers');
const W = 1920, H = 1080;

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const f1 = n => n.toFixed(1);
const grad = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const BLUR = (id, d) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}${BLUR('b4', 4)}${BLUR('b12', 12)}${BLUR('b30', 30)}${BLUR('b80', 80)}</defs>${body}</svg>`;

// nuvem cúmulo "de anime": cachos de círculos, topo iluminado, base sombreada
function cloud(r, cx, cy, w, h, lit, shade, rim) {
  let s = '', top = '';
  const n = Math.round(w / 38);
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (i + 0.5) * (w / n) + (r() - .5) * 20;
    const k = Math.sin((i + 0.5) / n * Math.PI);
    const rad = (h * 0.35 + r() * h * 0.35) * (0.45 + k * 0.75);
    const y = cy - k * h * 0.55 + (r() - .5) * 18;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}"/>`;
    top += `<circle cx="${f1(x - rad * .15)}" cy="${f1(y - rad * .2)}" r="${f1(rad * .82)}"/>`;
  }
  s += `<ellipse cx="${cx}" cy="${cy + h * .1}" rx="${w * .55}" ry="${h * .28}"/>`;
  return `<g fill="${shade}">${s}</g>` +
    (rim ? `<g fill="${rim}" opacity=".55" filter="url(#b12)">${top}</g>` : '') +
    `<g fill="${lit}">${top}</g>`;
}

function stars(r, n, yMax, op = 1) {
  let s = `<g fill="#fff">`;
  for (let i = 0; i < n; i++) {
    const y = r() * yMax, size = r() < .03 ? 2.6 : r() * 1.4 + .3;
    s += `<circle cx="${f1(r() * W)}" cy="${f1(y)}" r="${f1(size)}" opacity="${f1((0.3 + r() * .7) * op * (1 - y / yMax * .6))}"/>`;
  }
  return s + '</g>';
}

function skyline(r, baseY, minH, maxH, color, windowColor, density = .12) {
  let s = `<g fill="${color}">`, win = `<g fill="${windowColor}">`;
  let x = -20;
  while (x < W + 20) {
    const w = 40 + r() * 110, h = minH + r() * (maxH - minH);
    s += `<rect x="${f1(x)}" y="${f1(baseY - h)}" width="${f1(w)}" height="${f1(h + 400)}"/>`;
    if (r() < .25) s += `<rect x="${f1(x + w * .4)}" y="${f1(baseY - h - 30)}" width="3" height="30"/>`;
    for (let wy = baseY - h + 12; wy < baseY - 8; wy += 16)
      for (let wx = x + 8; wx < x + w - 10; wx += 14)
        if (r() < density) win += `<rect x="${f1(wx)}" y="${f1(wy)}" width="6" height="8" opacity="${f1(.5 + r() * .5)}"/>`;
    x += w + r() * 6;
  }
  return s + '</g>' + win + '</g>';
}

function wires(color, pts) {
  return pts.map(([x1, y1, x2, y2, sag]) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + sag} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.4"/>`).join('');
}
function pole(x, y, h, color) {
  return `<g fill="${color}"><rect x="${x - 7}" y="${y - h}" width="14" height="${h + 200}"/>` +
    `<rect x="${x - 70}" y="${y - h + 30}" width="140" height="9"/><rect x="${x - 55}" y="${y - h + 70}" width="110" height="8"/>` +
    [-60, -30, 30, 60].map(d => `<rect x="${x + d - 4}" y="${y - h + 18}" width="8" height="14"/>`).join('') + `</g>`;
}
function birds(r, n, x0, y0, color) {
  let s = `<g fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round">`;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * 260, y = y0 + r() * 120, k = 8 + r() * 8;
    s += `<path d="M${f1(x - k)} ${f1(y - k * .4)} Q${f1(x - k * .4)} ${f1(y - k * .6)} ${f1(x)} ${f1(y)} Q${f1(x + k * .4)} ${f1(y - k * .6)} ${f1(x + k)} ${f1(y - k * .4)}"/>`;
  }
  return s + '</g>';
}
function hills(points, color, base = H) {
  return `<path d="M0 ${base} L0 ${points[0]} ${points.map((y, i) => `L${f1(i * W / (points.length - 1))} ${y}`).join(' ')} L${W} ${base} Z" fill="${color}"/>`;
}
function smoothHill(y, amp, freq, phase, color) {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W; x += 20) d += ` L${x} ${f1(y + Math.sin(x / W * Math.PI * freq + phase) * amp + Math.sin(x / W * Math.PI * freq * 2.7 + phase) * amp * .3)}`;
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
}

const WALLS = {};

// 1. Entardecer na cidade
WALLS['entardecer-na-cidade'] = { name: 'Entardecer na cidade', make() {
  const r = rng(11);
  return svg(grad('sky', [[0, '#27245f'], [.42, '#7a3f8f'], [.7, '#e2708a'], [.9, '#ffb36b']]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
    `<circle cx="1180" cy="760" r="260" fill="#ffd9a0" opacity=".55" filter="url(#b80)"/><circle cx="1180" cy="760" r="70" fill="#fff1d6" filter="url(#b12)"/>` +
    cloud(r, 420, 330, 640, 220, '#ffc9b5', '#b9608f', '#fff1e0') + cloud(r, 1500, 230, 760, 260, '#ffbfa8', '#a95184', '#fff1e0') + cloud(r, 980, 520, 420, 120, '#ffd2b0', '#c96c8d') +
    birds(r, 7, 1300, 420, '#3a2350') +
    skyline(r, 880, 120, 380, '#3d2452', '#ffd27a', .10) + skyline(r, 1000, 60, 220, '#24163a', '#ffcf6e', .16) +
    `<rect y="990" width="${W}" height="90" fill="#170e27"/>` +
    pole(1680, 1000, 720, '#140b22') + pole(260, 1000, 600, '#140b22') +
    wires('#140b22', [[0, 330, 1620, 300, 90], [0, 370, 1610, 340, 110], [1750, 300, 1920, 330, 20], [200, 430, 1640, 370, 150], [1740, 370, 1920, 410, 25]]));
} };

// 2. Céu estrelado com cometa
WALLS['cometa'] = { name: 'Noite do cometa', make() {
  const r = rng(23);
  return svg(grad('sky', [[0, '#040822'], [.55, '#18286a'], [.85, '#4b3f8f'], [1, '#8a5a9a']]) +
    grad('tail', [[0, '#ffffff', 0], [1, '#bfe6ff', .95]], 1, 1),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
    `<ellipse cx="900" cy="420" rx="1100" ry="140" transform="rotate(-18 900 420)" fill="#8fa8ff" opacity=".18" filter="url(#b80)"/>` +
    stars(r, 900, 900) +
    `<g transform="rotate(28 1300 300)"><rect x="300" y="296" width="1000" height="9" fill="url(#tail)" filter="url(#b4)"/><rect x="500" y="290" width="800" height="22" fill="url(#tail)" opacity=".35" filter="url(#b12)"/><circle cx="1300" cy="300" r="10" fill="#fff" filter="url(#b4)"/></g>` +
    `<g transform="rotate(34 1260 330)"><rect x="700" y="327" width="560" height="4" fill="url(#tail)" opacity=".7"/></g>` +
    smoothHill(880, 60, 1.6, .4, '#1a1940') + smoothHill(960, 40, 2.4, 2.2, '#0d0c26') +
    `<g fill="#07061a"><rect x="1452" y="760" width="16" height="210"/><circle cx="1460" cy="720" r="95"/><circle cx="1400" cy="760" r="70"/><circle cx="1525" cy="755" r="72"/></g>` +
    Array.from({ length: 40 }, () => `<circle cx="${f1(r() * W)}" cy="${f1(900 + r() * 170)}" r="${f1(2 + r() * 2)}" fill="#d9ff8a" opacity="${f1(.4 + r() * .6)}" filter="url(#b4)"/>`).join(''));
} };

// 3. Verão
WALLS['verao'] = { name: 'Tarde de verão', make() {
  const r = rng(37);
  return svg(grad('sky', [[0, '#1458c8'], [.55, '#4aa3f0'], [1, '#bfe6ff']]) + grad('field', [[0, '#7cc74b'], [1, '#2f7d2a']]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
    cloud(r, 1150, 520, 1100, 520, '#ffffff', '#c8dcf2', '#ffffff') + cloud(r, 300, 250, 420, 140, '#ffffff', '#cfe1f5') + cloud(r, 1750, 300, 300, 100, '#ffffff', '#cfe1f5') +
    `<rect y="700" width="${W}" height="380" fill="url(#field)"/>` + smoothHill(700, 14, 3, 1, '#5fae3c') +
    `<path d="M880 700 L1040 700 L1500 1080 L420 1080 Z" fill="#8e8f96"/><path d="M955 700 L965 700 L990 1080 L930 1080 Z" fill="#f1f1ea" opacity=".9"/>` +
    Array.from({ length: 6 }, (_, i) => { const k = (i + 1) / 6, x = 1040 + 40 + k * k * 900, y = 700 + k * k * 380, h = 60 + k * k * 700; return pole(x, y, h, '#3a3a44'); }).join('') +
    wires('#3a3a44', [[1090, 650, 1990, 380, 40], [1090, 660, 1990, 420, 50]]) +
    Array.from({ length: 120 }, () => { const x = r() * W, y = 760 + r() * 320, s = .4 + (y - 700) / 380; return `<path d="M${f1(x)} ${f1(y)} q${f1(4 * s)} ${f1(-18 * s)} ${f1(10 * s)} ${f1(-26 * s)}" stroke="#2d6f22" stroke-width="${f1(2 * s)}" fill="none"/>`; }).join(''));
} };

// 4. Trem no mar
WALLS['trem-no-mar'] = { name: 'Trem sobre o mar', make() {
  const r = rng(41);
  let refl = '';
  for (let i = 0; i < 70; i++) { const y = 690 + i * 6 + r() * 4, w = 40 + r() * 260 * (1 - i / 80); refl += `<rect x="${f1(1000 - w / 2 + (r() - .5) * 80)}" y="${f1(y)}" width="${f1(w)}" height="2.4" fill="#ffe2b0" opacity="${f1(.7 - i / 110)}"/>`; }
  let cars = '';
  for (let c = 0; c < 5; c++) { const x = 360 + c * 205; cars += `<rect x="${x}" y="610" width="196" height="54" rx="8" fill="#22163a"/>` + Array.from({ length: 6 }, (_, k) => `<rect x="${x + 14 + k * 30}" y="622" width="20" height="16" rx="2" fill="#ffd27a"/>`).join(''); }
  return svg(grad('sky', [[0, '#3b3a8a'], [.5, '#b46aa2'], [.82, '#ffb27a']]) + grad('sea', [[0, '#8a5d9c'], [1, '#2a2459']]),
    `<rect width="${W}" height="690" fill="url(#sky)"/><circle cx="1000" cy="660" r="300" fill="#ffd6a0" opacity=".5" filter="url(#b80)"/><circle cx="1000" cy="672" r="80" fill="#fff0d0"/>` +
    cloud(r, 380, 300, 700, 200, '#ffcdb8', '#9c5a95', '#fff0de') + cloud(r, 1550, 380, 700, 210, '#ffc3a8', '#9a5590', '#fff0de') +
    `<rect y="690" width="${W}" height="390" fill="url(#sea)"/>` + refl +
    `<rect y="664" width="${W}" height="10" fill="#1b1230"/>` + Array.from({ length: 25 }, (_, i) => `<rect x="${i * 80}" y="674" width="8" height="${30 + (i % 2) * 10}" fill="#1b1230"/>`).join('') +
    cars + `<path d="M1385 610 h40 q30 0 30 30 v24 h-70 Z" fill="#22163a"/>` +
    birds(r, 5, 1400, 220, '#3a2350'));
} };

// 5. Sakura
WALLS['sakura'] = { name: 'Primavera de sakura', make() {
  const r = rng(53);
  let blossoms = '', petals = '';
  const branch = 'M-40 120 C220 160 380 260 560 250 C700 240 820 300 980 280 M300 210 C360 120 470 90 560 60 M640 260 C700 360 760 420 880 430';
  for (let i = 0; i < 420; i++) {
    const t = r(), along = [[-40 + t * 1020, 120 + Math.sin(t * 3) * 80 + t * 160], [300 + t * 260, 210 - t * 150], [640 + t * 240, 260 + t * 170]][Math.floor(r() * 3)];
    const x = along[0] + (r() - .5) * 140, y = along[1] + (r() - .5) * 110;
    blossoms += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(8 + r() * 16)}" fill="${['#ffd3e2', '#ffb7cf', '#ffc6d9', '#ff9fc0'][Math.floor(r() * 4)]}" opacity="${f1(.75 + r() * .25)}"/>`;
  }
  for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, rot = r() * 360, s = .6 + r() * 1.2; petals += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(7 * s)}" ry="${f1(4 * s)}" transform="rotate(${f1(rot)} ${f1(x)} ${f1(y)})" fill="#ffc0d6" opacity="${f1(.6 + r() * .4)}"/>`; }
  return svg(grad('sky', [[0, '#8fd0ff'], [.7, '#e9f6ff'], [1, '#fff4f7']]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + cloud(r, 1400, 420, 800, 220, '#ffffff', '#dbeefc') +
    smoothHill(820, 40, 1.4, 1, '#b9d7ef') + smoothHill(900, 30, 2.2, 2, '#9cc79a') + smoothHill(980, 20, 3, 0, '#7fb37a') +
    `<path d="${branch}" fill="none" stroke="#5b3a36" stroke-width="26" stroke-linecap="round"/><path d="${branch}" fill="none" stroke="#7a4e47" stroke-width="10" stroke-linecap="round" opacity=".6"/>` +
    `<g filter="url(#b4)" opacity=".4">${blossoms}</g>${blossoms}` + petals);
} };

// 6. Cidade neon na chuva
WALLS['neon-chuva'] = { name: 'Neon na chuva', make() {
  const r = rng(67);
  const neon = ['#ff3d8b', '#35e0ff', '#ffb23d', '#9b5bff', '#3dff9e'];
  let signs = '', rain = '', refl = '';
  for (let i = 0; i < 26; i++) {
    const left = r() < .5, x = left ? 60 + r() * 520 : 1340 + r() * 520, y = 140 + r() * 560, w = 30 + r() * 120, h = 20 + r() * 140, c = neon[Math.floor(r() * neon.length)];
    signs += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="6" fill="none" stroke="${c}" stroke-width="5"/><rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="6" fill="${c}" opacity=".25" filter="url(#b12)"/>`;
    refl += `<rect x="${f1(x + w * .2)}" y="${f1(820 + (y - 140) * .3)}" width="${f1(w * .6)}" height="${f1(120 + r() * 140)}" fill="${c}" opacity=".18" filter="url(#b12)"/>`;
  }
  for (let i = 0; i < 520; i++) { const x = r() * W, y = r() * H, l = 20 + r() * 40; rain += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x - l * .18)}" y2="${f1(y + l)}" stroke="#bfe2ff" stroke-width="1.4" opacity="${f1(.15 + r() * .35)}"/>`; }
  return svg(grad('sky', [[0, '#0b0820'], [1, '#2a1748']]) + grad('road', [[0, '#1c1430'], [1, '#07050f']]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + skyline(r, 640, 200, 520, '#140f2a', '#6fd3ff', .07) +
    `<path d="M0 0 L640 0 L760 820 L0 1080 Z" fill="#0d0a1c"/><path d="M1920 0 L1280 0 L1160 820 L1920 1080 Z" fill="#0d0a1c"/>` +
    signs + `<path d="M0 1080 L760 820 L1160 820 L1920 1080 Z" fill="url(#road)"/>` + refl +
    `<path d="M960 830 L970 830 L1010 1080 L910 1080 Z" fill="#ffd27a" opacity=".35"/>` + rain);
} };

// 7. Festival de lanternas
WALLS['lanternas'] = { name: 'Festival de lanternas', make() {
  const r = rng(79);
  let lan = '';
  for (let i = 0; i < 70; i++) {
    const y = 120 + r() * 760, s = .3 + (y / 900) * 1.1, x = r() * W;
    lan += `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s)})"><ellipse rx="40" ry="44" fill="#ffb347" opacity=".45" filter="url(#b12)"/><path d="M-16 -22 h32 l6 40 h-44 Z" fill="#ffcf7a"/><path d="M-16 -22 h32 l6 40 h-44 Z" fill="#ff8a2c" opacity=".35"/><rect x="-22" y="16" width="44" height="5" fill="#b8541b"/></g>`;
  }
  let refl = '';
  for (let i = 0; i < 40; i++) refl += `<ellipse cx="${f1(r() * W)}" cy="${f1(900 + r() * 170)}" rx="${f1(10 + r() * 30)}" ry="3" fill="#ffc06a" opacity="${f1(.2 + r() * .4)}"/>`;
  return svg(grad('sky', [[0, '#070a24'], [.6, '#1d1f52'], [1, '#3c2d63']]) + grad('lake', [[0, '#2b2556'], [1, '#0a0a20']]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` + stars(r, 400, 600, .8) +
    `<circle cx="1620" cy="200" r="70" fill="#fff6dc"/><circle cx="1620" cy="200" r="140" fill="#fff0c0" opacity=".25" filter="url(#b30)"/>` +
    smoothHill(820, 50, 1.3, 3, '#141335') + `<rect y="880" width="${W}" height="200" fill="url(#lake)"/>` + refl + lan);
} };

// 8. Montanhas ao amanhecer
WALLS['amanhecer'] = { name: 'Amanhecer nas montanhas', make() {
  const r = rng(97);
  return svg(grad('sky', [[0, '#3d5aa8'], [.45, '#9f8fd0'], [.75, '#ffc4a8'], [1, '#ffe2b8']]) + grad('lake', [[0, '#d9a7b8'], [1, '#4c5a9a']]),
    `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="700" cy="640" r="320" fill="#fff0cf" opacity=".6" filter="url(#b80)"/><circle cx="700" cy="640" r="66" fill="#fff8e6"/>` +
    cloud(r, 1400, 260, 620, 150, '#ffe6d6', '#b49ad0') + cloud(r, 300, 200, 420, 110, '#ffe6d6', '#b49ad0') +
    hills([620, 520, 380, 470, 330, 450, 560, 420, 300, 410, 540, 600, 660].map(v => v + 40), '#7f78b8') +
    hills([700, 640, 560, 610, 520, 600, 640, 560, 600, 680, 640, 700, 720].map(v => v + 20), '#565b9c') +
    `<rect y="740" width="${W}" height="340" fill="url(#lake)"/>` +
    `<g opacity=".35" transform="translate(0 1480) scale(1 -1)">${hills([620, 520, 380, 470, 330, 450, 560, 420, 300, 410, 540, 600, 660].map(v => v + 40), '#7f78b8', 740)}</g>` +
    Array.from({ length: 30 }, (_, i) => `<rect x="${f1(560 + (r() - .5) * 300)}" y="${f1(752 + i * 9)}" width="${f1(60 + r() * 200)}" height="2.4" fill="#fff4dc" opacity="${f1(.6 - i / 60)}"/>`).join('') +
    smoothHill(1000, 30, 2.5, 1, '#2b2f5e') + birds(r, 6, 1100, 380, '#3a3a6a'));
} };

fs.mkdirSync(OUT, { recursive: true });
const index = [];
for (const [id, w] of Object.entries(WALLS)) {
  fs.writeFileSync(path.join(OUT, `${id}.svg`), w.make());
  index.push({ id, name: w.name });
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log('wallpapers:', index.map(i => i.id).join(', '));
