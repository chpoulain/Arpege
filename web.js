/* Version web (navigateur, écran d'accueil) : hors ligne et mises à jour par le service worker.
   Sans effet dans les applications PC et Android, qui ont leur propre mise à jour. */
(function (global) {
  'use strict';
  if (global.Desktop || global.Android || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const $ = (id) => document.getElementById(id);
  const say = (t) => { const el = $('update-status'); el.textContent = t; el.hidden = !t; el.className = 'msg'; };
  let waiting = null;
  function offer(worker) {
    waiting = worker;
    $('update-text').textContent = 'Nouvelle version d\'Arpège disponible.';
    $('update-banner').hidden = false;
  }
  let reloading = false; let accepted = false;
  $('update-install').addEventListener('click', () => { accepted = true; if (waiting) waiting.postMessage('skip'); $('update-banner').hidden = true; });
  $('update-later').addEventListener('click', () => { $('update-banner').hidden = true; });
  // Recharger seulement pour une mise à jour acceptée : à la première visite, le service worker prend aussi la main.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (accepted && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    $('about').hidden = false;
    $('update-check').addEventListener('click', async () => {
      say('Recherche…');
      try { await reg.update(); say(reg.installing || reg.waiting ? '' : 'Tu as déjà la dernière version.'); }
      catch (e) { say('Recherche impossible : vérifie ta connexion.'); }
    });
    setInterval(() => reg.update().catch(() => {}), 3600 * 1000);
  }).catch(() => { /* service worker refusé (navigation privée…) : l'application marche quand même en ligne */ });
  fetch('version.txt').then((r) => r.text()).then((v) => { $('app-version').textContent = v.trim(); }).catch(() => {});
  // Demande au navigateur de ne pas effacer les morceaux pour faire de la place.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})(window);
