#!/usr/bin/env node
// Gera os assets gráficos da distro a partir da logo e do desenho da capivara (art/)
// Requer: node >= 18 e rsvg-convert (librsvg2-tools / librsvg2-bin)
//   node tools/render-assets.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RF = path.join(ROOT, 'rootfs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capix-'));

const mk = d => fs.mkdirSync(d, { recursive: true });
function png(svg, out, w, h) {
  const f = path.join(tmp, path.basename(out) + '.svg');
  fs.writeFileSync(f, svg);
  mk(path.dirname(out));
  const args = ['-w', String(w)];
  if (h) args.push('-h', String(h));
  execFileSync('rsvg-convert', [...args, f, '-o', out]);
}

// ---------- 1. Wallpaper low-poly ----------
export function wallpaperSVG(W = 1920, H = 1080, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cols = 16, rows = 10;
  const pts = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const edge = r === 0 || c === 0 || r === rows || c === cols;
    const jx = edge && (c === 0 || c === cols) ? 0 : (rnd() - .5) * W / cols * .7;
    const jy = edge && (r === 0 || r === rows) ? 0 : (rnd() - .5) * H / rows * .7;
    pts.push([c * W / cols + jx, r * H / rows + jy]);
  }
  const at = (r, c) => pts[r * (cols + 1) + c];
  const lerp = (a, b, t) => a + (b - a) * t;
  const stops = [[0, [20, 20, 23]], [.55, [36, 36, 42]], [.85, [78, 60, 50]], [1, [168, 104, 58]]];
  function color(x, y) {
    // brilho quente vindo do canto inferior direito
    const d = Math.hypot((x - W * .82) / W, (y - H * .95) / H);
    let t = Math.max(0, Math.min(1, 1 - d * 1.6));
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const k = (t - t0) / (t1 - t0);
    const n = .9 + rnd() * .2;
    return `rgb(${c0.map((v, j) => Math.round(Math.min(255, lerp(v, c1[j], k) * n))).join(',')})`;
  }
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = at(r, c), b = at(r, c + 1), d = at(r + 1, c), e = at(r + 1, c + 1);
    const tris = (r + c) % 2 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
    for (const t of tris) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      out += `<polygon points="${t.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${color(cx, cy)}" stroke="${color(cx, cy)}" stroke-width="1"/>`;
    }
  }
  // rede de nós sutil (assinatura visual da logo)
  out += `<g stroke="#FFFFFF" stroke-opacity=".05" stroke-width="1.2" fill="#F6B27A" fill-opacity=".16">`;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = at(r, c), b = at(r, c + 1), d = at(r + 1, c);
    out += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/><line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${d[0].toFixed(1)}" y2="${d[1].toFixed(1)}"/>`;
    if (rnd() > .55) out += `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="3.5" stroke="none"/>`;
  }
  out += `</g></svg>`;
  return out;
}

const wordmark = (fill = '#FFF4E6', sub = '#F6A45A') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120">
  <text x="180" y="78" text-anchor="middle" font-family="Inter" font-weight="600" font-size="78" fill="${fill}" letter-spacing="-1">Capix</text>
  <text x="180" y="108" text-anchor="middle" font-family="Inter" font-weight="500" font-size="17" fill="${sub}" letter-spacing="5">LINUX OS</text></svg>`;

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  // Wallpaper
  const wp = wallpaperSVG();
  fs.writeFileSync(path.join(ROOT, 'art/wallpaper.svg'), wp);
  png(wp, path.join(RF, 'usr/share/wallpapers/Capix/contents/images/1920x1080.png'), 1920, 1080);
  png(wallpaperSVG(3840, 2160), path.join(RF, 'usr/share/wallpapers/Capix/contents/images/3840x2160.png'), 3840, 2160);

  // ---------- 1b. Coleção de papéis de parede em estilo anime ----------
  execFileSync('node', [path.join(ROOT, 'tools/wallpapers.mjs')]);
  const CEN = path.join(RF, 'usr/share/capix/central/assets'); mk(CEN);
  const walls = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/wallpapers/index.json'), 'utf8'));
  for (const w of walls) {
    const dir = path.join(RF, `usr/share/wallpapers/Capix-${w.id}`);
    const svgSrc = fs.readFileSync(path.join(ROOT, `art/wallpapers/${w.id}.svg`), 'utf8');
    png(svgSrc, path.join(dir, 'contents/images/1920x1080.png'), 1920, 1080);
    png(svgSrc, path.join(dir, 'contents/images/2560x1440.png'), 2560, 1440);
    png(svgSrc, path.join(dir, 'contents/screenshot.png'), 400, 225);
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ KPlugin: { Authors: [{ Name: "UnbugSTI (UnbugSolutions-TI)" }], Id: `Capix-${w.id}`, License: 'CC-BY-SA-4.0', Name: `Capix — ${w.name}` } }, null, 4));
    png(svgSrc, path.join(CEN, `wp-${w.id}.png`), 320, 180);
  }
  png(wp, path.join(CEN, 'wp-capix.png'), 320, 180);
  fs.writeFileSync(path.join(RF, 'usr/share/capix/wallpapers.json'), JSON.stringify([{ id: 'capix', name: 'Capix (padrão)', dir: '/usr/share/wallpapers/Capix' },
    ...walls.map(w => ({ id: w.id, name: w.name, dir: `/usr/share/wallpapers/Capix-${w.id}` }))], null, 1));

  // ---------- 2. Plymouth: a própria logo mastigando um matinho ----------
  const PLY = path.join(RF, 'usr/share/plymouth/themes/capix');
  for (const f of fs.readdirSync(PLY)) if (f.endsWith('.png')) fs.rmSync(path.join(PLY, f));
  const logoSrc = fs.readFileSync(path.join(ROOT, 'art/logo-anim.js'), 'utf8')
    .replace('__L_BOXES__', fs.readFileSync(path.join(ROOT, 'art/logo-layers.json'), 'utf8').trim());
  fs.writeFileSync(path.join(tmp, 'logo-anim.cjs'), logoSrc);
  const logo = require(path.join(tmp, 'logo-anim.cjs'));
  for (const L of ['base', 'chin', 'eyeL', 'eyeR']) fs.copyFileSync(path.join(ROOT, `art/logo-${L}.png`), path.join(tmp, `logo-${L}.png`));
  const rel = { base: 'logo-base.png', chin: 'logo-chin.png', eyeL: 'logo-eyeL.png', eyeR: 'logo-eyeR.png' };
  const N = 24; // 24 quadros = 1,5 s (3 mastigadas)
  for (let i = 0; i < N; i++) {
    const over = (i >= 19 && i <= 21) ? { blink: [0.6, 1, 0.6][i - 19] } : {};
    png(logo.frameSVG((i / N) * 1.5, rel, over), path.join(PLY, `capy-${i}.png`), 300);
  }
  png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.2" fill="#5A3E2E"/></svg>`, path.join(PLY, 'dot.png'), 9);
  // marca d'água da desenvolvedora
  png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 24"><text x="100" y="17" text-anchor="middle" font-family="Inter" font-weight="500" font-size="13" fill="#9A7A64" letter-spacing=".5">by UnbugSTI</text></svg>`, path.join(PLY, 'watermark.png'), 200);
  png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.2" fill="#F68B2C"/></svg>`, path.join(PLY, 'bullet.png'), 12);
  png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 40"><rect x="1" y="1" width="298" height="38" rx="4" fill="#FFFFFF" stroke="#F68B2C" stroke-width="2"/></svg>`, path.join(PLY, 'entry.png'), 300);

  // ---------- 3. SDDM: camadas da capivara ----------
  const SD = path.join(RF, 'usr/share/sddm/themes/capix/assets');
  // capivara do cafezinho: desenho fornecido, recortado em camadas (tools/split-drawing.py)
  fs.rmSync(SD, { recursive: true, force: true });
  mk(SD);
  for (const L of ['base', 'head', 'cup']) fs.copyFileSync(path.join(ROOT, `art/capivara-cafe-${L}.png`), path.join(SD, `capy-${L}.png`));
  const boxes = fs.readFileSync(path.join(ROOT, 'art/capivara-cafe-layers.json'), 'utf8').trim();
  fs.writeFileSync(path.join(SD, 'layers.js'), `.pragma library\n// gerado por tools/render-assets.mjs: [x, y, largura, altura] no desenho 208x269\nvar box = ${boxes};\n`);
  const W = 208, H = 269, X = 3; // camadas em tela cheia do desenho, 3x
  const layer = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>${inner}</svg>`;
  png(layer(`<ellipse cx="117" cy="75.5" rx="10" ry="5.6" fill="#FAAE55" filter="url(#f)"/>`), path.join(SD, 'eye-patch.png'), W * X);
  png(layer(`<circle cx="117" cy="63" r="4.5" fill="#FAAE55" filter="url(#f)"/><path d="M110 63.5 Q117 64 123.5 68" fill="none" stroke="#3A1A08" stroke-width="1.7" stroke-linecap="round"/>`), path.join(SD, 'sad-brow.png'), W * X);
  png(layer(`<ellipse cx="121" cy="88" rx="9" ry="5" fill="#F07D7D" opacity=".38" filter="url(#f)"/>`), path.join(SD, 'blush.png'), W * X);
  png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 12 12"><ellipse rx="3.7" ry="4.5" fill="#2A1408"/><circle cx="1.2" cy="-1.7" r="1.35" fill="#fff"/><circle cx="-1.1" cy="1.6" r=".55" fill="#fff" opacity=".7"/></svg>`, path.join(SD, 'eye-open.png'), 12 * X * 2);
  const drawingMod = require(path.join(ROOT, 'art/capy-drawing.js'));
  for (let i = 0; i < 12; i++) png(drawingMod.steamSVG((i / 12) * 2), path.join(SD, `steam-${i}.png`), W * X);
  fs.copyFileSync(path.join(RF, 'usr/share/wallpapers/Capix/contents/images/1920x1080.png'), path.join(SD, 'background.png'));

  // ---------- 4. Ícones (recorte da cabeça da logo original) ----------
  const head = path.join(tmp, 'logo-head.png');
  execFileSync('convert', [path.join(ROOT, 'art/logo-original.jpg'), '-crop', '800x800+624+440', '+repage', '-fuzz', '6%', '-transparent', 'white', head]);
  for (const sz of [16, 22, 24, 32, 48, 64, 128, 256]) {
    const out = path.join(RF, `usr/share/icons/hicolor/${sz}x${sz}/apps/capix-start.png`); mk(path.dirname(out));
    execFileSync('convert', [head, '-resize', `${sz}x${sz}`, out]);
  }
  mk(path.join(RF, 'usr/share/pixmaps'));
  execFileSync('convert', [head, '-resize', '512x512', path.join(RF, 'usr/share/pixmaps/capix-logo.png')]);
  fs.copyFileSync(head, path.join(ROOT, 'art/logo-head.png'));
  fs.copyFileSync(head, path.join(CEN, 'logo.png'));

  console.log('Assets gerados em', RF);
}
