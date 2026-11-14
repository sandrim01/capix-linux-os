/*
 * Capix Linux OS — animação de boot: a própria logo mastigando um matinho
 * Camadas recortadas da logo original por tools/split-logo.py (sem redesenho):
 *   base (logo com olhos e queixo removidos), chin (queixo), eyeL/eyeR (olhos)
 * Acrescenta só o matinho, no mesmo traço da logo.
 * Coordenadas: 425 x 620 (recorte da logo em 50%).
 */
(function (root) {
  const IMG = { base: '__L_BASE__', chin: '__L_CHIN__', eyeL: '__L_EYEL__', eyeR: '__L_EYER__' };
  const BOX = (() => { try { return JSON.parse('__L_BOXES__'); } catch (e) { return {}; } })();
  const W = 425, H = 620;
  const INK = '#5A3E2E';

  /** parâmetros do ciclo de mastigação no tempo t (s) */
  function params(t) {
    const cyc = 1.5, ph = ((t % cyc) / cyc) * Math.PI * 2;
    const jaw = (1 - Math.cos(ph * 3)) / 2;          // 3 mastigadas por ciclo
    const side = Math.sin(ph * 3);
    const long = t % 6;
    const blink = long > 4.6 && long < 4.85 ? Math.sin(((long - 4.6) / 0.25) * Math.PI) : 0;
    return { jaw, side, blink };
  }

  function grassSVG() {
    // três folhinhas + um "nó" na ponta, como os nós da rede da logo
    return `<g transform="scale(1.35)">
      <path d="M0 -2 C16 -12 30 -26 44 -48 C40 -22 26 -6 2 8 Z" fill="#8FD05A" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M0 0 C24 -6 46 -10 72 -10 C48 6 24 12 0 12 Z" fill="#6BB33F" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M0 6 C18 12 32 22 46 40 C24 32 10 22 -2 14 Z" fill="#8FD05A" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>
      <circle cx="44" cy="-48" r="5" fill="#F68B2C" stroke="${INK}" stroke-width="3"/></g>`;
  }

  function frameTransforms(p) {
    const cx = BOX.chin ? BOX.chin[0] : 0, cy = BOX.chin ? BOX.chin[1] : 0;
    return {
      chin: `translate(${(p.side * 2).toFixed(2)} ${(p.jaw * 7).toFixed(2)})`,
      grass: `translate(${(262 + p.side * 2).toFixed(2)} ${(412 + p.jaw * 5).toFixed(2)}) rotate(${(8 * p.side - 6 * p.jaw).toFixed(2)}) scale(${(1 - p.jaw * 0.1).toFixed(3)} 1)`,
      eye: k => { const b = BOX[k]; const c = [b[0] + b[2] / 2, b[1] + b[3] / 2]; return `translate(${c[0]} ${c[1]}) scale(1 ${(1 - p.blink * 0.88).toFixed(3)}) translate(${-c[0]} ${-c[1]})`; },
    };
  }

  function layerImg(k, href) {
    const b = BOX[k];
    return `<image href="${href}" xlink:href="${href}" x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}"/>`;
  }

  /** SVG completo de um quadro (para gerar PNGs do Plymouth). imgs = {base, chin, eyeL, eyeR} */
  function frameSVG(t, imgs = IMG, over = {}) {
    const p = Object.assign(params(t), over), T = frameTransforms(p);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      layerImg('base', imgs.base) +
      `<g transform="${T.eye('eyeL')}">${layerImg('eyeL', imgs.eyeL)}</g>` +
      `<g transform="${T.eye('eyeR')}">${layerImg('eyeR', imgs.eyeR)}</g>` +
      `<g transform="${T.grass}">${grassSVG()}</g>` +
      `<g transform="${T.chin}">${layerImg('chin', imgs.chin)}</g>` +
      `</svg>`;
  }

  /** Monta no navegador e anima sozinho. Devolve stop(). */
  function mount(el) {
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:100%">
      ${layerImg('base', IMG.base)}
      <g data-k="eyeL">${layerImg('eyeL', IMG.eyeL)}</g>
      <g data-k="eyeR">${layerImg('eyeR', IMG.eyeR)}</g>
      <g data-k="grass">${grassSVG()}</g>
      <g data-k="chin">${layerImg('chin', IMG.chin)}</g></svg>`;
    const g = k => el.querySelector(`[data-k="${k}"]`);
    const els = { eyeL: g('eyeL'), eyeR: g('eyeR'), grass: g('grass'), chin: g('chin') };
    let raf, t0 = performance.now();
    (function loop(now) {
      const T = frameTransforms(params((now - t0) / 1000));
      els.chin.setAttribute('transform', T.chin);
      els.grass.setAttribute('transform', T.grass);
      els.eyeL.setAttribute('transform', T.eye('eyeL'));
      els.eyeR.setAttribute('transform', T.eye('eyeR'));
      raf = requestAnimationFrame(loop);
    })(t0);
    return () => cancelAnimationFrame(raf);
  }

  const api = { mount, frameSVG, params, W, H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CapixLogo = api;
})(typeof window !== 'undefined' ? window : globalThis);
