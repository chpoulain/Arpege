/* Page Accords : les accords de l'instrument choisi, avec doigts, vue du manche, notes et écoute. */
(function (global) {
  'use strict';
  const C = global.UkuCore; const S = global.UkuScore;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const el = (n, a, parent) => { const e = document.createElementNS(NS, n); Object.entries(a || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (parent) parent.appendChild(e); return e; };
  const node = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const ROOT_FR = { C: 'Do', 'C#': 'Do♯', D: 'Ré', Eb: 'Mi♭', E: 'Mi', F: 'Fa', 'F#': 'Fa♯', G: 'Sol', Ab: 'La♭', A: 'La', Bb: 'Si♭', B: 'Si' };
  const NOTE_SHARP = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const NOTE_FLAT = ['Do', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const QUALITIES = [
    ['', 'majeur'], ['m', 'mineur'], ['7', 'septième'], ['m7', 'mineur 7'], ['maj7', 'majeur 7'], ['6', 'sixte'], ['m6', 'mineur 6'],
    ['sus2', 'sus2'], ['sus4', 'sus4'], ['7sus4', '7 sus4'], ['add9', 'add9'], ['9', 'neuvième'], ['m9', 'mineur 9'],
    ['dim', 'diminué'], ['dim7', 'diminué 7'], ['m7b5', 'mineur 7 ♭5'], ['aug', 'augmenté'], ['5', 'quinte (puissance)'],
  ];
  const QUALITY_FR = Object.fromEntries(QUALITIES);
  // Les premiers accords appris, dans l'ordre où on les rencontre.
  const FIRST = {
    guitar: ['Em', 'Am', 'E', 'A', 'D', 'G', 'C', 'Dm', 'E7', 'A7', 'D7', 'B7', 'G7', 'F', 'Bm'],
    ukulele: ['C', 'Am', 'F', 'G', 'G7', 'C7', 'A', 'A7', 'Dm', 'D', 'D7', 'Em', 'E7', 'Bb', 'Bm'],
  };
  const FINGER_NAMES = '1 index · 2 majeur · 3 annulaire · 4 auriculaire';

  /* Doigts de la main gauche : barré de l'index quand plusieurs cordes partagent la case la plus basse,
     puis les autres doigts dans l'ordre des cases. Renvoie null si la position demande plus de quatre doigts. */
  function fingering(frets) {
    const fretted = []; frets.forEach((f, i) => { if (f > 0) fretted.push(i); });
    const out = { fingers: frets.map(() => 0), barre: null };
    if (!fretted.length) return out;
    const min = Math.min(...fretted.map((i) => frets[i]));
    const atMin = fretted.filter((i) => frets[i] === min);
    const last = frets.length - 1 - frets.slice().reverse().findIndex((f) => f >= 0);
    let rest = fretted;
    let next = 1;
    if (atMin.length >= 2 && (fretted.length >= 4 || atMin.length >= 3)) {
      let clear = true;
      for (let i = atMin[0]; i <= last; i++) if (frets[i] === 0) clear = false;
      if (clear) {
        out.barre = { fret: min, from: atMin[0], to: atMin[atMin.length - 1] };
        atMin.forEach((i) => { out.fingers[i] = 1; });
        rest = fretted.filter((i) => frets[i] !== min); next = 2;
      }
    }
    rest.slice().sort((a, b) => frets[a] - frets[b] || a - b).forEach((i) => { out.fingers[i] = next++; });
    return next > 5 ? null : out;
  }

  function window5(frets) {
    const fretted = frets.filter((f) => f > 0);
    const max = fretted.length ? Math.max(...fretted) : 0;
    return max <= 5 ? 1 : Math.min(...fretted);
  }

  /* Grand diagramme vertical, avec le numéro du doigt dans chaque pastille. */
  function bigDiagram(frets) {
    const n = frets.length; const step = n > 4 ? 22 : 28; const rowH = 30; const rows = 5;
    const left = 26; const top = 34; const w = left * 2 + step * (n - 1) + 14; const h = top + rowH * rows + 12;
    const svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img', 'aria-label': 'Diagramme : ' + frets.map(C.fretText).join(' ') });
    const fg = fingering(frets);
    const base = window5(frets);
    const x = (i) => left + i * step; const y = (r) => top + r * rowH;
    for (let r = 0; r <= rows; r++) el('line', { x1: x(0), x2: x(n - 1), y1: y(r), y2: y(r), stroke: r === 0 && base === 1 ? '#23211c' : '#9a927f', 'stroke-width': r === 0 && base === 1 ? 5 : 1.2 }, svg);
    for (let i = 0; i < n; i++) el('line', { x1: x(i), x2: x(i), y1: y(0), y2: y(rows), stroke: '#9a927f', 'stroke-width': 1.2 }, svg);
    if (base > 1) { const t = el('text', { x: x(n - 1) + 12, y: y(0.65), 'font-size': 14, 'font-family': 'Arial, sans-serif', fill: '#6d675b' }, svg); t.textContent = base + 'e'; }
    if (fg && fg.barre) el('rect', { x: x(fg.barre.from) - 9, y: y(fg.barre.fret - base + 0.5) - 9, width: x(fg.barre.to) - x(fg.barre.from) + 18, height: 18, rx: 9, fill: '#0f6b63' }, svg);
    frets.forEach((f, i) => {
      if (f < 0) { const t = el('text', { x: x(i), y: top - 12, 'text-anchor': 'middle', 'font-size': 16, 'font-family': 'Arial, sans-serif', fill: '#23211c' }, svg); t.textContent = '×'; return; }
      if (f === 0) { el('circle', { cx: x(i), cy: top - 17, r: 5.5, fill: 'none', stroke: '#23211c', 'stroke-width': 1.5 }, svg); return; }
      el('circle', { cx: x(i), cy: y(f - base + 0.5), r: 10, fill: '#0f6b63' }, svg);
      if (fg && fg.fingers[i]) { const t = el('text', { x: x(i), y: y(f - base + 0.5) + 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, 'font-family': 'Arial, sans-serif', fill: '#fff' }, svg); t.textContent = fg.fingers[i]; }
    });
    return svg;
  }

  /* Le manche vu par le joueur, comme sur une tablature : sillet à gauche, corde aiguë en haut. */
  function neckView(frets, tuningKey) {
    const tuning = C.TUNINGS[tuningKey] || C.TUNINGS.standard;
    const n = frets.length; const cols = 5; const colW = 62; const gap = n > 4 ? 19 : 25;
    const left = 46; const top = 18; const boardH = gap * (n - 1) + 22; const w = left + colW * cols + 16; const h = top + boardH + 26;
    const svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'Position des doigts sur le manche' });
    const base = window5(frets);
    const fg = fingering(frets);
    const sy = (i) => top + 11 + (n - 1 - i) * gap; // corde 0 (grave) en bas
    const fx = (f) => left + (f - base + 0.5) * colW;
    el('rect', { x: left, y: top, width: colW * cols, height: boardH, rx: 3, fill: '#6b4a2f' }, svg);
    el('rect', { x: left, y: top, width: colW * cols, height: boardH, rx: 3, fill: '#3b2a1c', 'fill-opacity': 0.25 }, svg);
    const dots = n > 4 ? [3, 5, 7, 9, 12, 15] : [5, 7, 10, 12, 15];
    for (let c = 0; c < cols; c++) {
      const f = base + c;
      if (dots.includes(f)) el('circle', { cx: left + (c + 0.5) * colW, cy: top + boardH / 2, r: 5, fill: '#e9dfc8', 'fill-opacity': 0.75 }, svg);
      el('rect', { x: left + (c + 1) * colW - 2, y: top, width: 4, height: boardH, fill: '#c9c4b8' }, svg);
      const t = el('text', { x: left + (c + 0.5) * colW, y: top + boardH + 17, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'Arial, sans-serif', fill: '#6d675b' }, svg); t.textContent = 'case ' + f;
    }
    if (base === 1) el('rect', { x: left - 7, y: top - 1, width: 8, height: boardH + 2, rx: 2, fill: '#f3ecdc', stroke: '#9a927f' }, svg);
    for (let i = 0; i < n; i++) {
      const thick = n > 4 ? 3.2 - i * 0.42 : 2.2;
      el('line', { x1: left - 7, x2: left + colW * cols, y1: sy(i), y2: sy(i), stroke: frets[i] < 0 ? '#8b8475' : '#efe6cf', 'stroke-width': Math.max(1.1, thick), 'stroke-opacity': frets[i] < 0 ? 0.6 : 1 }, svg);
      const name = el('text', { x: 6, y: sy(i) + 4, 'font-size': 11, 'font-weight': 700, 'font-family': 'Arial, sans-serif', fill: '#6d675b' }, svg); name.textContent = tuning.names[i];
      const mark = el('text', { x: left - 20, y: sy(i) + 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-family': 'Arial, sans-serif', fill: frets[i] < 0 ? '#a32222' : '#23211c' }, svg);
      mark.textContent = frets[i] < 0 ? '×' : frets[i] === 0 ? '○' : '';
    }
    if (fg && fg.barre) el('rect', { x: fx(fg.barre.fret) - 9, y: sy(fg.barre.to) - 9, width: 18, height: sy(fg.barre.from) - sy(fg.barre.to) + 18, rx: 9, fill: '#f6d55c', stroke: '#23211c', 'stroke-width': 0.8 }, svg);
    frets.forEach((f, i) => {
      if (f <= 0) return;
      el('circle', { cx: fx(f), cy: sy(i), r: 9, fill: '#f6d55c', stroke: '#23211c', 'stroke-width': 0.8 }, svg);
      if (fg && fg.fingers[i]) { const t = el('text', { x: fx(f), y: sy(i) + 4.2, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, 'font-family': 'Arial, sans-serif', fill: '#23211c' }, svg); t.textContent = fg.fingers[i]; }
    });
    return svg;
  }

  const frenchName = (label) => {
    const c = C.parseChord(label); if (!c) return label;
    const m = /^([A-G][#b]?)/.exec(label);
    return (ROOT_FR[m[1]] || m[1]) + ' ' + (QUALITY_FR[c.quality] || c.quality);
  };
  function notesOf(frets, tuningKey, flat) {
    const tuning = C.TUNINGS[tuningKey];
    return frets.map((f, i) => (f < 0 ? '×' : (flat ? NOTE_FLAT : NOTE_SHARP)[(tuning.midi[i] + f) % 12]));
  }

  /* Un accord joué : d'un coup (accord plaqué) ou corde après corde. */
  function listen(frets, tuningKey, spread) {
    const notes = []; frets.forEach((f, i) => { if (f >= 0) notes.push({ string: i, fret: f }); });
    const events = spread
      ? notes.map((n, k) => ({ start: k * 2, dur: 2, notes: [n] }))
      : [{ start: 0, dur: 16, notes, strum: { type: 'stroke', dir: 'down', level: 'normal', count: frets.length } }];
    const bars = spread && events.length > 8 ? [{ events: events.slice(0, 8) }, { events: events.slice(8).map((e) => Object.assign({}, e, { start: e.start - 16 })) }] : [{ events }];
    if (api.onListen) api.onListen();
    S.play({ meter: '4/4', tuning: tuningKey, bars }, 96, null, { follow: false });
  }

  let tuningKey = 'standard'; let shown = 'first'; let current = null;
  const instrument = () => C.TUNINGS[tuningKey].instrument;

  function card(label) {
    const chord = C.parseChord(label);
    const list = chord ? C.voicingsFor(chord, tuningKey) : [];
    if (!list.length) return null;
    const v = list[0];
    const b = node('button', 'chord-card'); b.type = 'button';
    b.appendChild(node('b', '', label));
    b.appendChild(node('small', '', frenchName(label)));
    b.appendChild(bigDiagram(v.frets));
    b.appendChild(node('span', 'mono', v.frets.map(C.fretText).join(' ')));
    b.setAttribute('aria-label', 'Accord ' + frenchName(label) + ', position ' + v.frets.map(C.fretText).join(' ') + '. Ouvrir');
    b.addEventListener('click', () => openDetail(label, 0));
    return b;
  }

  function render(key) {
    if (key && C.TUNINGS[key]) tuningKey = key;
    const t = C.TUNINGS[tuningKey];
    $('chords-title').textContent = 'Accords de ' + (instrument() === 'guitar' ? 'guitare' : 'ukulélé');
    $('chords-tuning').textContent = 'Accordage : ' + t.label + '. Touche un accord pour voir les doigts, l\'écouter et choisir une autre position.';
    const tabs = $('chords-roots'); tabs.innerHTML = '';
    [['first', 'Les premiers']].concat(ROOTS.map((r) => [r, r.replace('#', '♯').replace(/b$/, '♭')])).forEach(([value, text]) => {
      const b = node('button', value === shown ? 'on' : '', text); b.type = 'button';
      b.setAttribute('aria-pressed', value === shown);
      if (value !== 'first') b.title = ROOT_FR[value];
      b.addEventListener('click', () => { shown = value; render(); });
      tabs.appendChild(b);
    });
    const box = $('chords-list'); box.innerHTML = '';
    const labels = shown === 'first' ? FIRST[instrument()] : QUALITIES.map(([q]) => shown + q);
    labels.forEach((label) => { const c = card(label); if (c) box.appendChild(c); });
  }

  function openDetail(label, index) {
    const chord = C.parseChord(label);
    const list = C.voicingsFor(chord, tuningKey).slice(0, 12);
    const v = list[index] || list[0];
    current = { label, frets: v.frets, shape: v.shape };
    $('chord-name').textContent = label + ' — ' + frenchName(label);
    const fig = $('chord-figure'); fig.innerHTML = '';
    fig.appendChild(bigDiagram(v.frets));
    const neck = $('chord-neck'); neck.innerHTML = ''; neck.appendChild(neckView(v.frets, tuningKey));
    const fg = fingering(v.frets);
    const facts = $('chord-facts'); facts.innerHTML = '';
    const fact = (title, text) => { const p = node('p'); p.appendChild(node('b', '', title + ' ')); p.appendChild(document.createTextNode(text)); facts.appendChild(p); };
    fact('Cases, de la corde grave à l\'aiguë :', v.frets.map(C.fretText).join(' ') + (v.frets.includes(-1) ? ' (× = corde non jouée)' : ''));
    fact('Notes :', notesOf(v.frets, tuningKey, chord.flat).join(' · '));
    fact('Doigts :', fg ? FINGER_NAMES + (fg.barre ? '. Barré de l\'index en case ' + fg.barre.fret + '.' : '.') : 'position à plus de quatre doigts, à adapter.');
    // Photo de la position, si un fichier photos/<instrument>/<position>.jpg a été ajouté à l'application.
    const photo = $('chord-photo');
    photo.hidden = true;
    photo.onload = () => { photo.hidden = false; };
    photo.onerror = () => { photo.hidden = true; };
    photo.alt = 'Photo de la position ' + label;
    photo.src = 'photos/' + (instrument() === 'guitar' ? 'guitare' : 'ukulele') + '/' + v.shape + '.jpg';
    const alts = $('chord-alts'); alts.innerHTML = '';
    list.forEach((alt, i) => {
      const b = node('button', 'dia' + (i === index ? ' sel' : ''), alt.frets.map(C.fretText).join(' ')); b.type = 'button';
      b.appendChild(S.diagram(alt.frets));
      b.addEventListener('click', () => openDetail(label, i));
      alts.appendChild(b);
    });
    $('chord-sheet').hidden = false;
  }
  function close() { $('chord-sheet').hidden = true; S.stop(); }

  function init() {
    $('chord-close').addEventListener('click', close);
    $('chord-sheet').addEventListener('click', (e) => { if (e.target === $('chord-sheet')) close(); });
    $('chord-play').addEventListener('click', () => { if (current) listen(current.frets, tuningKey, false); });
    $('chord-arp').addEventListener('click', () => { if (current) listen(current.frets, tuningKey, true); });
    $('chord-use').addEventListener('click', () => { if (current && api.onUse) { api.onUse(current.label, current.shape); close(); } });
  }

  const api = { render, init, close, fingering, bigDiagram, neckView, isOpen: () => !$('chord-sheet').hidden, onUse: null, onListen: null };
  global.UkuChords = api;
})(window);
