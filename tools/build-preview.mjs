#!/usr/bin/env node
// Monta preview/capix-preview.html (arquivo único) a partir de preview/src.html
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(ROOT, 'preview/src.html'), 'utf8');
const wp = fs.readFileSync(path.join(ROOT, 'art/wallpaper.svg'));
const uri = `"data:image/svg+xml;base64,${wp.toString('base64')}"`;
import { execFileSync } from 'node:child_process';
import os from 'node:os';
// camadas em WebP para a prévia ficar leve
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capix-pv-'));
const webp = f => {
  const out = path.join(tmp, path.basename(f) + '.webp');
  execFileSync('convert', [path.join(ROOT, f), '-quality', '90', '-define', 'webp:alpha-quality=100', out]);
  return 'data:image/webp;base64,' + fs.readFileSync(out).toString('base64');
};
const boxes = fs.readFileSync(path.join(ROOT, 'art/capivara-cafe-layers.json'), 'utf8').trim();
const drawing = fs.readFileSync(path.join(ROOT, 'art/capy-drawing.js'), 'utf8')
  .replace('__IMG_BASE__', webp('art/capivara-cafe-base.png'))
  .replace('__IMG_HEAD__', webp('art/capivara-cafe-head.png'))
  .replace('__IMG_CUP__', webp('art/capivara-cafe-cup.png'))
  .replace('__BOXES__', boxes);
const logo = fs.readFileSync(path.join(ROOT, 'art/logo-anim.js'), 'utf8')
  .replace('__L_BASE__', webp('art/logo-base.png'))
  .replace('__L_CHIN__', webp('art/logo-chin.png'))
  .replace('__L_EYEL__', webp('art/logo-eyeL.png'))
  .replace('__L_EYER__', webp('art/logo-eyeR.png'))
  .replace('__L_BOXES__', fs.readFileSync(path.join(ROOT, 'art/logo-layers.json'), 'utf8').trim());
const headIcon = webp('art/logo-head.png');

// ---- Capix Central embutida (modo demonstração) ----
const RF = path.join(ROOT, 'rootfs');
const CEN = path.join(RF, 'usr/share/capix/central');
const mock = JSON.parse(execFileSync('python3', ['-c',
  'import importlib.util,json,sys;sp=importlib.util.spec_from_file_location("c",sys.argv[1]);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);print(json.dumps(m.mock_status()))',
  path.join(RF, 'usr/libexec/capix/central-server.py')], {
  env: { ...process.env, CAPIX_DRYRUN: '1', HOME: tmp, USER: 'capix',
    CAPIX_APPS: path.join(RF, 'usr/share/capix/apps.list'), CAPIX_WALLS: path.join(RF, 'usr/share/capix/wallpapers.json') } }).toString());
const centralAssets = { 'logo.png': headIcon };
const wallFull = {};
for (const w of mock.wallpapers.list) {
  centralAssets[`wp-${w.id}.png`] = webp(`rootfs/usr/share/capix/central/assets/wp-${w.id}.png`);
  if (w.id !== 'capix') {
    const big = path.join(tmp, `wall-${w.id}.webp`);
    execFileSync('convert', [path.join(RF, `usr/share/wallpapers/Capix-${w.id}/contents/images/1920x1080.png`), '-resize', '1600x', '-quality', '82', big]);
    wallFull[w.id] = 'data:image/webp;base64,' + fs.readFileSync(big).toString('base64');
  }
}
const centralHtml = fs.readFileSync(path.join(CEN, 'index.html'), 'utf8')
  .replace('__CAPIX_DRY__', 'true')
  .replace('/*__PREVIEW_MOCK__*/', () => `window.CAPIX_MOCK_STATUS = ${JSON.stringify(mock)};\nwindow.CAPIX_ASSETS = ${JSON.stringify(centralAssets)};\n/*__START__*/\n` + fs.readFileSync(path.join(ROOT, 'preview/central-mock.js'), 'utf8'));
const out = src.replace('/*__CAPYBARA__*/', () => logo + '\n' + drawing + `\nwindow.CAPIX_ICON = "${headIcon}";\nwindow.CAPIX_CENTRAL_HTML = ${JSON.stringify(centralHtml).replace(/<\/script/gi, '<\\/script')};\nwindow.CAPIX_WALLS = ${JSON.stringify(wallFull)};`).replaceAll('__WALLPAPER__', uri);
fs.writeFileSync(path.join(ROOT, 'preview/capix-preview.html'), out);
console.log('preview/capix-preview.html', (out.length / 1024).toFixed(0) + ' KB');
