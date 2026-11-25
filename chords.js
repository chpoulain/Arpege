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

  /* Le manche vu par le joueur, comme sur une tablature : corde aiguë en haut.
     Le manche part toujours du sillet et s'arrête à la dernière case appuyée : les cases vides avant l'accord restent visibles.
     Pour un accord haut sur le manche, les cases se resserrent afin que l'image garde une largeur raisonnable. */
  function neckView(frets, tuningKey) {
    const tuning = C.TUNINGS[tuningKey] || C.TUNINGS.standard;
    const pressed = frets.filter((f) => f > 0);
    const base = 1;
    const cols = pressed.length ? Math.max(...pressed) : 1;
    const n = frets.length; const colW = Math.max(30, Math.min(62, Math.round(330 / cols))); const gap = n > 4 ? 19 : 25;
    const left = 46; const top = 18; const boardH = gap * (n - 1) + 22; const w = left + colW * cols + 16; const h = top + boardH + 26;
    const svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img', 'aria-label': 'Position des doigts sur le manche' });
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
      const t = el('text', { x: left + (c + 0.5) * colW, y: top + boardH + 17, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'Arial, sans-serif', fill: '#6d675b' }, svg); t.textContent = (colW >= 50 ? 'case ' : '') + f;
    }
    el('rect', { x: left - 7, y: top - 1, width: 8, height: boardH + 2, rx: 2, fill: '#f3ecdc', stroke: '#9a927f' }, svg);
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
  /* Bémols ou dièses pour écrire les notes d'un accord : on suit l'armure habituelle de sa tonalité (Do7 contient Si♭, pas La♯). */
  function useFlats(label) {
    const m = /^([A-G][#b]?)(.*)$/.exec(label || ''); if (!m) return false;
    const minor = /^m(?!aj)/.test(m[2]) || /^dim/.test(m[2]);
    return (minor ? ['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'] : ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']).includes(m[1]) || (!minor && m[1] === 'C' && /7|9/.test(m[2]) && !/maj7/.test(m[2]));
  }
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

  /* Mes accords : positions créées à la main, gardées sur l'appareil. */
  const mine = {
    all() { try { const v = JSON.parse(localStorage.getItem('myChords') || '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x.label === 'string' && typeof x.shape === 'string') : []; } catch (e) { return []; } },
    save(list) { try { localStorage.setItem('myChords', JSON.stringify(list)); } catch (e) { /* stockage refusé : l'accord reste utilisable dans la séance */ } },
    here() { const n = C.stringCount(tuningKey); return mine.all().filter((x) => x.shape.length === n); },
    add(label, shape) { const list = mine.all().filter((x) => !(x.label === label && x.shape === shape)); list.unshift({ label, shape }); mine.save(list.slice(0, 200)); },
    remove(label, shape) { mine.save(mine.all().filter((x) => !(x.label === label && x.shape === shape))); },
  };
  const fretsOf = (shape) => shape.split('').map((c) => (c === 'x' ? -1 : parseInt(c, 36)));
  const shapeOf = (frets) => frets.map((x) => (x < 0 ? 'x' : x.toString(36))).join('');
  const instrument = () => C.TUNINGS[tuningKey].instrument;

  /* custom : position créée à la main ({ label, shape }) ; sinon la première position calculée de l'accord. */
  function card(label, custom) {
    const chord = C.parseChord(label);
    const list = chord ? C.voicingsFor(chord, tuningKey) : [];
    if (!custom && !list.length) return null;
    const frets = custom ? fretsOf(custom.shape) : list[0].frets;
    const b = node('button', 'chord-card'); b.type = 'button';
    b.appendChild(node('b', '', label));
    b.appendChild(node('small', '', frenchName(label)));
    b.appendChild(bigDiagram(frets));
    b.appendChild(node('span', 'mono', frets.map(C.fretText).join(' ')));
    b.setAttribute('aria-label', 'Accord ' + frenchName(label) + ', position ' + frets.map(C.fretText).join(' ') + '. Ouvrir');
    b.addEventListener('click', () => openDetail(label, 0, custom));
    return b;
  }

  function render(key) {
    if (key && C.TUNINGS[key]) tuningKey = key;
    const t = C.TUNINGS[tuningKey];
    $('chords-title').textContent = 'Accords de ' + (instrument() === 'guitar' ? 'guitare' : 'ukulélé');
    $('chords-tuning').textContent = 'Accordage : ' + t.label + '. Touche un accord pour voir les doigts, l\'écouter et choisir une autre position.';
    const tabs = $('chords-roots'); tabs.innerHTML = '';
    [['first', 'Les premiers']].concat(C.TUNINGS[tuningKey].family === 'guitar' ? [['simple', 'Très simples']] : [], [['mine', 'Mes accords']], ROOTS.map((r) => [r, r.replace('#', '♯').replace(/b$/, '♭')])).forEach(([value, text]) => {
      const b = node('button', value === shown ? 'on' : '', text); b.type = 'button';
      b.setAttribute('aria-pressed', value === shown);
      if (ROOT_FR[value]) b.title = ROOT_FR[value];
      b.addEventListener('click', () => { shown = value; render(); });
      tabs.appendChild(b);
    });
    const box = $('chords-list'); box.innerHTML = '';
    if (shown === 'simple' && C.TUNINGS[tuningKey].family !== 'guitar') shown = 'first';
    if (shown === 'simple') { // les remplaçants à deux ou trois doigts, avec l'accord qu'ils remplacent
      Object.entries(C.SIMPLE_GUITAR).forEach(([from, [label, shape]]) => {
        const c = card(label, { label, shape });
        const names = { 'A#': 'Bb' }; const src = names[from] || from;
        if (src !== label) c.insertBefore(node('small', 'replaces', 'à la place de ' + src), c.children[2]);
        box.appendChild(c);
      });
      return;
    }
    if (shown === 'mine') {
      const list = mine.here();
      list.forEach((x) => box.appendChild(card(x.label, x)));
      if (!list.length) box.appendChild(node('p', 'empty', 'Aucun accord créé pour cet instrument. Touche « Créer un accord » : pose les doigts sur le manche, l\'application trouve son nom.'));
      return;
    }
    const labels = shown === 'first' ? FIRST[instrument()] : QUALITIES.map(([q]) => shown + q);
    labels.forEach((label) => { const c = card(label); if (c) box.appendChild(c); });
  }

  function openDetail(label, index, custom) {
    const chord = C.parseChord(label) || { flat: false };
    const computed = chord.quality !== undefined ? C.voicingsFor(chord, tuningKey).slice(0, 12) : [];
    // Une position créée à la main passe en tête, sans doublon avec les positions calculées.
    const list = custom ? [{ frets: fretsOf(custom.shape), shape: custom.shape, custom: true }].concat(computed.filter((x) => x.shape !== custom.shape)) : computed;
    const v = list[index] || list[0];
    current = { label, frets: v.frets, shape: v.shape, custom: !!v.custom };
    $('chord-delete').hidden = !v.custom;
    $('chord-name').textContent = label + ' — ' + frenchName(label);
    const fig = $('chord-figure'); fig.innerHTML = '';
    fig.appendChild(bigDiagram(v.frets));
    const neck = $('chord-neck'); neck.innerHTML = ''; neck.appendChild(neckView(v.frets, tuningKey));
    const fg = fingering(v.frets);
    const facts = $('chord-facts'); facts.innerHTML = '';
    const fact = (title, text) => { const p = node('p'); p.appendChild(node('b', '', title + ' ')); p.appendChild(document.createTextNode(text)); facts.appendChild(p); };
    fact('Cases, de la corde grave à l\'aiguë :', v.frets.map(C.fretText).join(' ') + (v.frets.includes(-1) ? ' (× = corde non jouée)' : ''));
    fact('Notes :', notesOf(v.frets, tuningKey, useFlats(label)).join(' · '));
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
      b.addEventListener('click', () => openDetail(label, i, custom));
      alts.appendChild(b);
    });
    $('chord-sheet').hidden = false;
  }
  function close() { $('chord-sheet').hidden = true; S.stop(); }

  /* ---------- Créer un accord : on pose les doigts, l'application le nomme ---------- */
  let made = [];
  const FRETS_SHOWN = 12;
  function openMaker() {
    const n = C.stringCount(tuningKey);
    if (made.length !== n) made = new Array(n).fill(0);
    drawMaker();
    $('maker-sheet').hidden = false;
  }
  function closeMaker() { $('maker-sheet').hidden = true; S.stop(); }
  function drawMaker() {
    const t = C.TUNINGS[tuningKey]; const n = made.length; const guitar = n > 4;
    const board = $('maker-board'); board.innerHTML = '';
    board.style.gridTemplateColumns = '34px 40px repeat(' + FRETS_SHOWN + ', 34px)';
    board.appendChild(node('span', 'mk-head', '')); board.appendChild(node('span', 'mk-head', 'vide'));
    for (let f = 1; f <= FRETS_SHOWN; f++) board.appendChild(node('span', 'mk-head', String(f)));
    for (let i = n - 1; i >= 0; i--) { // corde aiguë en haut, comme sur la tablature
      board.appendChild(node('span', 'mk-name', (guitar ? (n - i) + ' ' : '') + t.names[i]));
      const open = node('button', 'mk-open' + (made[i] <= 0 ? ' on' : ''), made[i] < 0 ? '×' : '○'); open.type = 'button';
      open.setAttribute('aria-label', 'Corde ' + t.names[i] + (made[i] < 0 ? ' non jouée' : ' à vide') + (guitar ? '. Toucher pour changer' : ''));
      // Guitare : à vide, puis non jouée. Ukulélé : les quatre cordes sonnent toujours.
      open.addEventListener('click', () => { made[i] = made[i] === 0 && guitar ? -1 : 0; drawMaker(); });
      board.appendChild(open);
      for (let f = 1; f <= FRETS_SHOWN; f++) {
        const b = node('button', 'mk-cell' + (made[i] === f ? ' on' : ''), made[i] === f ? '●' : ''); b.type = 'button';
        b.setAttribute('aria-label', 'Corde ' + t.names[i] + ', case ' + f + (made[i] === f ? ', appuyée' : ''));
        b.setAttribute('aria-pressed', made[i] === f);
        b.addEventListener('click', () => { made[i] = made[i] === f ? 0 : f; drawMaker(); });
        board.appendChild(b);
      }
    }
    const res = C.nameChord(made, tuningKey);
    const pressed = made.filter((f) => f > 0); const span = pressed.length ? Math.max(...pressed) - Math.min(...pressed) : 0;
    $('maker-name').textContent = res.label ? res.label + ' — ' + frenchName(res.label) : res.count < 2 ? 'Pose au moins deux notes différentes' : 'Pas de nom courant pour ces notes';
    $('maker-alt').textContent = (res.alternatives.length ? 'Autres lectures possibles : ' + res.alternatives.join(', ') + '. ' : '')
      + 'Notes : ' + notesOf(made, tuningKey, useFlats(res.label)).join(' · ') + '.'
      + (span > 4 ? ' Écart de ' + (span + 1) + ' cases : difficile à tenir.' : '');
    const fig = $('maker-figure'); fig.innerHTML = '';
    if (made.some((f) => f >= 0) && span <= 4) fig.appendChild(bigDiagram(made));
    $('maker-keep').disabled = !res.label; $('maker-use').disabled = !res.label;
    $('maker-keep').dataset.label = res.label || '';
  }

  function init() {
    $('chord-close').addEventListener('click', close);
    $('chord-sheet').addEventListener('click', (e) => { if (e.target === $('chord-sheet')) close(); });
    $('chord-play').addEventListener('click', () => { if (current) listen(current.frets, tuningKey, false); });
    $('chord-arp').addEventListener('click', () => { if (current) listen(current.frets, tuningKey, true); });
    $('chord-use').addEventListener('click', () => { if (current && api.onUse) { api.onUse(current.label, current.shape, current.custom); close(); } });
    $('chord-delete').addEventListener('click', () => { if (current && current.custom) { mine.remove(current.label, current.shape); close(); render(); } });
    $('chord-make').addEventListener('click', openMaker);
    $('maker-close').addEventListener('click', closeMaker);
    $('maker-sheet').addEventListener('click', (e) => { if (e.target === $('maker-sheet')) closeMaker(); });
    $('maker-clear').addEventListener('click', () => { made = made.map(() => 0); drawMaker(); });
    $('maker-play').addEventListener('click', () => listen(made, tuningKey, false));
    $('maker-keep').addEventListener('click', () => {
      const label = $('maker-keep').dataset.label; if (!label) return;
      mine.add(label, shapeOf(made)); closeMaker(); shown = 'mine'; render();
      if (api.onKeep) api.onKeep(label);
    });
    $('maker-use').addEventListener('click', () => {
      const label = $('maker-keep').dataset.label; if (!label || !api.onUse) return;
      mine.add(label, shapeOf(made)); api.onUse(label, shapeOf(made), true); closeMaker(); if (!$('tab-chords').hidden) render();
    });
  }

  /* ---------- Palette de la page Grille : les accords à cliquer ---------- */
  const MAJOR_DEGREES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'V7'];
  const MINOR_DEGREES = ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII', 'V7'];
  const KEYS_MAJOR = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];
  const KEYS_MINOR = ['A', 'E', 'B', 'F#', 'D', 'G', 'C'];
  /* Groupes proposés dans la liste déroulante : [titre, [[valeur, libellé]…]]. */
  function paletteSources() {
    return [
      ['Pour commencer', [['first', 'Les premiers accords'], ['mine', 'Mes accords créés']]],
      ['Par tonalité', KEYS_MAJOR.map((k) => ['key:' + k + ':major', ROOT_FR[k] + ' majeur']).concat(KEYS_MINOR.map((k) => ['key:' + k + ':minor', ROOT_FR[k] + ' mineur']))],
      ['Par note', ROOTS.map((r) => ['root:' + r, 'Tous les accords de ' + ROOT_FR[r]])],
    ];
  }
  /* Accords d'une source, avec leur position : [{ label, frets, shape, custom }]. */
  function paletteChords(source, key) {
    if (key && C.TUNINGS[key]) tuningKey = key;
    if (source === 'mine') return mine.here().map((x) => ({ label: x.label, frets: fretsOf(x.shape), shape: x.shape, custom: true }));
    let labels;
    const m = /^key:([^:]+):(major|minor)$/.exec(source); const r = /^root:(.+)$/.exec(source);
    if (m) labels = (m[2] === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES).map((d) => C.romanToChord(d, m[1]));
    else if (r) labels = QUALITIES.map(([q]) => r[1] + q);
    else labels = FIRST[instrument()];
    return labels.map((label) => { const c = label && C.parseChord(label); const v = c && C.voicingsFor(c, tuningKey)[0]; return v ? { label, frets: v.frets, shape: v.shape } : null; }).filter(Boolean);
  }

  const api = { render, init, close, closeMaker, fingering, bigDiagram, neckView, paletteSources, paletteChords, isOpen: () => !$('chord-sheet').hidden, isMakerOpen: () => !$('maker-sheet').hidden, onUse: null, onListen: null, onKeep: null };
  global.UkuChords = api;
})(window);
