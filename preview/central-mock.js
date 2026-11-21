// Prévia: simula o servidor da Capix Central dentro do navegador (sem sistema por trás).
(function () {
  const S = window.CAPIX_MOCK_STATUS;
  let n = 0; const jobs = {};
  const json = (o, code = 200) => Promise.resolve(new Response(JSON.stringify(o), { status: code, headers: { 'Content-Type': 'application/json' } }));
  function apply(action, args) {
    const log = [`$ ${action} ${args.join(' ')}`.trim(), '(demonstração) ok'];
    if (action === 'flatpak-install') { const a = S.apps.find(x => x.id === args[0]); if (a) a.installed = true; log.splice(1, 0, `Instalando ${a ? a.name : args[0]} do Flathub…`, '100%'); }
    if (action === 'flatpak-remove') { const a = S.apps.find(x => x.id === args[0]); if (a) a.installed = false; }
    if (action === 'android-init') { S.android.initialized = true; log.splice(1, 0, 'Baixando imagem do Android…', 'Imagem verificada.'); }
    if (action === 'android-remove') { S.android.initialized = false; }
    if (action === 'auto-updates') S.updates.auto = args[0] === 'on';
    if (action === 'update-now') { log.splice(1, 0, 'Procurando atualizações…', 'Nenhuma atualização disponível.'); S.updates.last_check = 'agora'; }
    if (action === 'gamer') { S.gamer.on = args[0] === 'on'; S.gamer.profile = S.gamer.on ? 'performance' : 'balanced'; }
    if (action === 'profile') { S.profiles.ativo = args[0]; S.privacy.vpns.forEach(v => { if (v.nome === S.profiles.vpn) v.ativa = args[0] === 'investigacao'; }); log.splice(1, 0, args[0] === 'investigacao' ? 'Ligando a VPN… abrindo as ferramentas…' : 'Desligando a VPN…'); }
    if (action === 'profile-config') { S.profiles.vpn = args[0]; S.profiles.abrir = args[1].split(',').filter(Boolean); }
    if (action === 'backup-auto') S.backup.auto = args[0] === 'on';
    if (action === 'backup-run') { S.backup.ultimo = new Date().toLocaleString('pt-BR'); log.splice(1, 0, 'Copiando sua pasta pessoal…', 'Só o que mudou desde ontem.'); }
    if (action === 'usbguard') S.privacy.usbguard.ativo = args[0] === 'on';
    if (action === 'vpn-up') { S.privacy.vpns.forEach(v => { if (v.nome === args[0]) v.ativa = true; }); }
    if (action === 'vpn-down') { S.privacy.vpns.forEach(v => { if (v.nome === args[0]) v.ativa = false; }); }
    if (action === 'theme') S.appearance.dark = args[0] === 'dark';
    if (action === 'kiosk-enable') S.kiosk = { enabled: true, url: args[0] };
    if (action === 'kiosk-disable') S.kiosk = { enabled: false, url: '' };
    if (action === 'av-scan') { S.antivirus.last = new Date().toLocaleString('pt-BR'); }
    if (action === 'wallpaper') { S.wallpapers.current = args[0]; try { parent.postMessage({ capixWallpaper: args[0] }, '*'); } catch (e) {} }
    if (action === 'ciber-init' && S.ciber) S.ciber.workspace_exists = true;
    if (action === 'ciber-lab-start' && S.ciber) { const l = S.ciber.labs.find(x => x.id === args[0]); if (l) l.running = true; }
    if (action === 'ciber-lab-stop' && S.ciber) { const l = S.ciber.labs.find(x => x.id === args[0]); if (l) l.running = false; }
    if (action === 'ciber-lab-stop-all' && S.ciber) { S.ciber.labs.forEach(x => { x.running = false; }); }
    if (action === 'welcome-done') S.welcome_done = true;
    return log;
  }
  const real = window.fetch;
  window.fetch = (url, opt = {}) => {
    url = String(url);
    if (url.endsWith('api/status')) return json(S);
    if (url.endsWith('api/run')) {
      const b = JSON.parse(opt.body || '{}'); const id = 'j' + (++n);
      jobs[id] = { t: Date.now(), log: apply(b.action, b.args || []) };
      return json({ job: id });
    }
    const m = url.match(/api\/job\/(\w+)$/);
    if (m) { const j = jobs[m[1]]; const done = Date.now() - j.t > 900; return json({ done, code: done ? 0 : null, log: done ? j.log : j.log.slice(0, 1) }); }
    return real(url, opt);
  };
  window.alert = m => console.log(m); window.confirm = () => true;
})();
