/* Mises à jour du contenu de l'application : le téléchargement et la vérification sont faits par la partie native. */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const pending = new Map();
  let seq = 0;
  global.__updateDone = function (id, json) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    const r = JSON.parse(json);
    if (r.error) p.reject(new Error(r.error)); else p.resolve(r);
  };
  const android = (fn) => new Promise((resolve, reject) => {
    const id = 'u' + (++seq);
    pending.set(id, { resolve, reject });
    global.Android[fn](id);
  });
  const clean = (e) => String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

  let api = null;
  if (global.Desktop && global.Desktop.updateInfo) {
    api = { info: global.Desktop.updateInfo, check: global.Desktop.updateCheck, install: global.Desktop.updateInstall, confirm: global.Desktop.updateConfirm };
  } else if (global.Android && global.Android.updateInfo) {
    api = {
      info: async () => JSON.parse(global.Android.updateInfo()),
      check: () => android('updateCheck'),
      install: () => android('updateInstall'),
      confirm: async () => global.Android.updateConfirm(),
    };
  }
  if (!api) return;

  // L'application a démarré jusqu'au bout : cette version est bonne et ne sera pas annulée.
  if (global.__arpegeReady) api.confirm();

  const say = (t, cls) => { const el = $('update-status'); el.textContent = t; el.hidden = !t; el.className = 'msg' + (cls ? ' ' + cls : ''); };

  function offer(r) {
    $('update-text').textContent = 'Nouvelle version ' + r.version + (r.notes ? ' : ' + r.notes : '');
    $('update-install').hidden = false;
    $('update-banner').hidden = false;
  }

  async function check(manual) {
    if (manual) say('Recherche…');
    try {
      const r = await api.check();
      try { localStorage.setItem('arpege.update.last', String(Date.now())); } catch (e) { /* facultatif */ }
      if (r.available) { offer(r); if (manual) say('Version ' + r.version + ' disponible.'); }
      else if (r.shellTooOld) {
        if (manual) say('La version ' + r.version + ' demande de réinstaller l\'application une dernière fois.', 'warn');
      } else if (manual) say('Tu as déjà la dernière version.');
    } catch (e) {
      // Vérification automatique sans réseau : pas de message, l'application marche sans.
      if (manual) say('Recherche impossible : ' + clean(e), 'err');
    }
  }

  $('update-later').addEventListener('click', () => { $('update-banner').hidden = true; });
  $('update-install').addEventListener('click', async () => {
    const b = $('update-install');
    b.disabled = true; $('update-text').textContent = 'Téléchargement et vérification…';
    try {
      await api.install(); // l'application se recharge d'elle-même
    } catch (e) {
      b.disabled = false; $('update-text').textContent = 'Mise à jour impossible : ' + clean(e);
    }
  });
  $('update-check').addEventListener('click', () => check(true));

  api.info().then((i) => {
    if (!i.enabled) return;
    $('about').hidden = false;
    $('app-version').textContent = i.current;
    let last = 0;
    try { last = +localStorage.getItem('arpege.update.last') || 0; } catch (e) { /* facultatif */ }
    if (Date.now() - last > 24 * 3600 * 1000) setTimeout(() => check(false), 3000);
  });
})(window);
