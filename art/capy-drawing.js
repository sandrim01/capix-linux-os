/*
 * Capix Linux OS — capivara do cafezinho da tela de login
 * Usa o desenho fornecido, recortado em 3 camadas (art/capivara-cafe-*.png):
 *   base (corpo), head (cabeça), cup (xícara + patinhas)
 * e anima por cima: olhinho que segue o cursor, piscar, gole de café
 * (a cabeça desce e a xícara sobe até a boca), balançar de "não", vapor e respiração.
 * Coordenadas no tamanho do desenho original: 208 x 269.
 */
(function (root) {
  const IMG = { base: '__IMG_BASE__', head: '__IMG_HEAD__', cup: '__IMG_CUP__' };
  const BOX = (() => { try { return JSON.parse('__BOXES__'); } catch (e) { return {}; } })(); // {camada: [x,y,w,h]} — art/capivara-cafe-layers.json
  const EYE = [117, 75.5];
  const NECK = [110, 126.7];             // pivô da cabeça
  const CUP = [57, 150];                 // centro da xícara
  const FUR = '#FAAE55';
  const NS = 'http://www.w3.org/2000/svg';

  function steamPaths(t, fade = 1) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const ph = t * Math.PI + i * 2.1, rise = ((t * 0.5 + i / 3) % 1);  // loop de 2 s
      const x0 = 50 + i * 6, y0 = 128 - rise * 8;
      let d = `M${x0} ${y0.toFixed(1)}`;
      for (let k = 1; k <= 5; k++) {
        const yy = y0 - k * 11, xx = x0 + Math.sin(ph + k * 1.2) * 3.5;
        d += ` Q${(xx + Math.sin(ph + k) * 3).toFixed(1)} ${(yy + 5.5).toFixed(1)} ${xx.toFixed(1)} ${yy.toFixed(1)}`;
      }
      out.push({ d, w: (2.6 - i * 0.4).toFixed(1), op: ((0.35 + 0.25 * Math.sin(ph)) * fade).toFixed(2) });
    }
    return out;
  }
  function steamSVG(t) {
    return `<svg xmlns="${NS}" viewBox="0 0 208 269"><g fill="none" stroke="#fff" stroke-linecap="round">` +
      steamPaths(t).map(p => `<path d="${p.d}" stroke-width="${p.w}" stroke-opacity="${p.op}"/>`).join('') + `</g></svg>`;
  }

  /** Monta o SVG uma vez dentro de `el` e devolve update(o). */
  function mount(el, prefix = 'dw') {
    const im = k => `<image href="${IMG[k]}" x="${BOX[k][0]}" y="${BOX[k][1]}" width="${BOX[k][2]}" height="${BOX[k][3]}"/>`;
    el.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 208 269" style="width:100%;height:100%;overflow:visible">
      <defs><filter id="${prefix}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>
      <g id="${prefix}all">
        ${im('base')}
        <g id="${prefix}head">${im('head')}
          <g id="${prefix}open">
            <ellipse cx="${EYE[0]}" cy="${EYE[1]}" rx="10" ry="5.6" fill="${FUR}" filter="url(#${prefix}soft)"/>
            <g id="${prefix}eye"><ellipse rx="3.7" ry="4.5" fill="#2A1408"/><circle cx="1.2" cy="-1.7" r="1.35" fill="#fff"/><circle cx="-1.1" cy="1.6" r=".55" fill="#fff" opacity=".7"/></g>
          </g>
          <g id="${prefix}sad"><circle cx="117" cy="63" r="4.5" fill="${FUR}" filter="url(#${prefix}soft)"/>
            <path d="M110 63.5 Q117 64 123.5 68" fill="none" stroke="#3A1A08" stroke-width="1.7" stroke-linecap="round"/></g>
          <ellipse id="${prefix}blush" cx="121" cy="88" rx="9" ry="5" fill="#F07D7D" opacity=".38" filter="url(#${prefix}soft)"/>
        </g>
        <g id="${prefix}cup">${im('cup')}
          <g id="${prefix}steam" fill="none" stroke="#fff" stroke-linecap="round"><path/><path/><path/></g>
        </g>
      </g></svg>`;
    const $ = id => el.querySelector('#' + prefix + id);
    const all = $('all'), head = $('head'), open = $('open'), eye = $('eye'), sad = $('sad'), blush = $('blush'), cup = $('cup');
    const steamEls = [...$('steam').children];

    return function update(o = {}) {
      const eyes = o.eyes || 'closed';
      const [px, py] = o.pupil || [0, 0];
      const blink = Math.max(0, Math.min(1, o.blink || 0));
      const sip = Math.max(0, Math.min(1, o.sip || 0));
      const e = sip < 0.5 ? 2 * sip * sip : 1 - Math.pow(-2 * sip + 2, 2) / 2;
      const br = 1 + Math.sin((o.breath || 0) * 2.2) * 0.008;
      all.setAttribute('transform', `rotate(${(o.rot || 0).toFixed(2)} 110 269) translate(110 269) scale(1 ${br.toFixed(4)}) translate(-110 -269)`);
      head.setAttribute('transform', `rotate(${((o.headRot || 0) - 13 * e).toFixed(2)} ${NECK[0]} ${NECK[1]})`);
      cup.setAttribute('transform', `translate(${(5 * e).toFixed(2)} ${(-16 * e).toFixed(2)}) rotate(${(-16 * e).toFixed(2)} ${CUP[0]} ${CUP[1]})`);
      const showOpen = eyes === 'open' || eyes === 'sad';
      open.style.display = showOpen ? '' : 'none';
      eye.setAttribute('transform', `translate(${(EYE[0] + px).toFixed(2)} ${(EYE[1] + py).toFixed(2)}) scale(1 ${(1 - blink * 0.9).toFixed(3)})`);
      sad.style.display = eyes === 'sad' ? '' : 'none';
      blush.style.display = eyes === 'happy' ? '' : 'none';
      steamPaths(o.steamT || 0, Math.max(0, 1 - e * 1.6)).forEach((p, i) => {
        steamEls[i].setAttribute('d', p.d); steamEls[i].setAttribute('stroke-width', p.w); steamEls[i].setAttribute('stroke-opacity', p.op);
      });
    };
  }

  const api = { mount, steamSVG, EYE, NECK, CUP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CapixDrawing = api;
})(typeof window !== 'undefined' ? window : globalThis);
