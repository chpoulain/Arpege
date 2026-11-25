(function () {
  'use strict';
  const C = window.UkuCore; const S = window.UkuScore; const I = window.UkuImport; const K = window.UkuChords;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  /* g : variante guitare du motif (B = la basse de l'accord, quelle que soit la corde qui la porte) ; only : réservé à un instrument. */
  const PRESETS = [
    { name: 'Montée simple', kind: 'strings', p: '4 3 2 1', g: 'B 3 2 1' },
    { name: 'Montée-descente', kind: 'strings', p: '4 3 2 1 2 3', g: 'B 3 2 1 2 3' },
    { name: 'Aller-retour sur 8 pas', kind: 'strings', p: '4 3 2 1 2 3 2 3', g: 'B 3 2 1 2 3 2 3' },
    { name: 'Grand arpège', kind: 'strings', only: 'guitar', p: 'B 4 3 2 1 2 3 4' },
    { name: 'Picking alterné', kind: 'strings', p: '4 2 3 1 4 2 3 1', g: 'B 3 4 2 B 3 4 2' },
    { name: 'Pouce et deux doigts', kind: 'strings', p: '3 2+1 4 2+1', g: 'B 2+1 4 2+1' },
    { name: 'Basse et accord pincé', kind: 'strings', only: 'guitar', p: 'B 3+2+1 B 3+2+1' },
    { name: 'Valse (3/4)', kind: 'strings', p: '3 2+1 2+1', g: 'B 3+2+1 3+2+1' },
    { name: 'Valse lente, une basse et deux pincés (3/4)', kind: 'strings', p: '4 - 2+1 - 2+1 -', g: 'B - 3+2+1 - 3+2+1 -' },
    { name: 'Valse arpégée, montée (3/4)', kind: 'strings', p: '4 3 2 1 2 1', g: 'B 4 3 2 1 2' },
    { name: 'Valse, basse et pincés alternés (3/4)', kind: 'strings', p: '4 3 2+1 3 2+1 3', g: 'B 3 2+1 3 2+1 3' },
    { name: 'Valse, basse puis aigus (3/4)', kind: 'strings', p: '4 - 1 2 1 2', g: 'B - 1 2 3 2' },
    { name: 'Valse par notes, tonique et quinte (3/4)', kind: 'degrees', p: 'T - 3 - 5 -' },
    { name: 'Valse par notes, arpège (3/4)', kind: 'degrees', p: 'T 5 3 5 3 5' },
    { name: 'Basse alternée', kind: 'degrees', p: 'T 3 5 3' },
    { name: 'Accord brisé', kind: 'degrees', p: 'T 3 5 7 5 3' },
    { name: 'Ballade', kind: 'degrees', p: 'T 5 3 5 7 5 3 5' },
    { name: 'Bas, bas-haut, haut-bas-haut', kind: 'strum', p: 'b - b h - h b h' },
    { name: 'Bas-haut régulier', kind: 'strum', p: 'b h b h b h b h' },
    { name: 'Tout en bas', kind: 'strum', p: 'b - b - b - b -' },
    { name: 'Campagne', kind: 'strum', p: 'b - b h b - b h' },
    { name: 'Accents sur 2 et 4', kind: 'strum', p: 'b. h. B h. b. h. B h.' },
    { name: 'Reggae (contretemps)', kind: 'strum', p: '- B - B - B - B' },
    { name: 'Coup étouffé', kind: 'strum', p: 'b h x h b h x h' },
    { name: '3+3+2', kind: 'strum', p: 'B h b H b h B (h)' },
    { name: 'Hauts courts', kind: 'strum', p: 'b - b h2 - h2 b h2', g: 'b - b h3 - h3 b h3' },
    { name: 'Pouce et frappe', kind: 'strum', p: 'p h b h t h b h' },
    { name: 'Basse puis accord', kind: 'strum', only: 'guitar', p: 'p - b h p - b h' },
    { name: 'Coup et doigts', kind: 'strum', p: 'b 2 3 b 2 3 b 2' },
    { name: 'Hawaïen (double-croches)', kind: 'strum', sub: '16', p: 'b - - - b - h - b h b h - - h -' },
    { name: 'Valse rythmique (3/4)', kind: 'strum', p: 'b - b h b h' },
    { name: 'Valse simple, trois temps (3/4)', kind: 'strum', p: 'B - b. - b. -' },
    { name: 'Valse, pouce puis accords (3/4)', kind: 'strum', p: 'p - b - b -' },
    { name: 'Valse, pouce et allers-retours (3/4)', kind: 'strum', p: 'p - b h b h' },
    { name: 'Valse musette (3/4)', kind: 'strum', p: 'B - b h b -' },
    { name: 'Valse étouffée (3/4)', kind: 'strum', p: 'B - x - x -' },
    { name: 'Valse, hauts courts (3/4)', kind: 'strum', p: 'B - h2 - h2 -', g: 'B - h3 - h3 -' },
    { name: 'Berceuse (6/8)', kind: 'strum', p: 'B - h b - h' },
  ];

  const defaults = { title: '', chords: 'Am F C G', pattern: '4 3 2 1 2 3 2 3', patternKind: 'strings', meter: '4/4', subdivision: '8', tuning: 'standard', transpose: 0, mode: 'easy', position: 5, overrides: {}, tempo: 80, view: 'both', simple: false, scoreMode: 'score', scoreDiagrams: false, scoreNeck: false, scoreNames: true, scoreSolfege: false, lyrics: '', sections: null, grid: { key: 'C', mode: 'major', style: 'pop', form: 'verseChorus', bars: 4, perBar: 1, seed: 0, text: '', models: {} } };
  const state = Object.assign({}, defaults, store.get('draft', {}));
  if (!Object.prototype.hasOwnProperty.call(C.TUNINGS, state.tuning)) state.tuning = 'standard';
  /* L'instrument se déduit de l'accordage : rien d'autre à enregistrer dans un morceau. */
  const inst = () => C.TUNINGS[state.tuning].instrument;
  const N = () => C.stringCount(state.tuning);
  const presets = () => PRESETS.filter((p) => !p.only || p.only === inst())
    .map((p) => ({ name: p.name, kind: p.kind, sub: p.sub, p: inst() === 'guitar' && p.g ? p.g : p.p }));
  const shapeText = (frets) => frets.map(C.fretText).join(' ');
  let score = null;
  let importedScore = null; // tablature importée : affichée telle quelle, sans générateur
  let playing = false;

  /* ---------- navigation ---------- */
  function goto(name) {
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 'tab-' + name; });
    document.querySelectorAll('.bottom button').forEach((b) => b.classList.toggle('on', b.dataset.goto === name));
    window.scrollTo(0, 0);
    if (name === 'score') drawScore();
    if (name === 'songs') renderSongs();
    if (name === 'grid') { drawGridPage(); drawPalette(); }
    if (name === 'chords') K.render(state.tuning);
  }
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.goto)));

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function setMsg(el, text, cls) {
    el.textContent = text || ''; el.hidden = !text;
    el.className = 'msg' + (cls ? ' ' + cls : '');
  }

  /* ---------- formulaire ---------- */
  function fillSelects() {
    for (let i = -6; i <= 6; i++) $('transpose').add(new Option(i === 0 ? 'Non' : (i > 0 ? '+' : '−') + Math.abs(i) + ' demi-ton' + (Math.abs(i) > 1 ? 's' : ''), i));
  }
  /* Tout ce qui dépend de l'instrument : accordages proposés, motifs prêts, boutons du nombre de cordes. */
  let shownInst = null;
  function fillInstrument() {
    if (shownInst === inst()) return;
    shownInst = inst();
    const guitar = shownInst === 'guitar';
    document.querySelectorAll('[data-instrument]').forEach((b) => { const on = b.dataset.instrument === shownInst; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('tuning-label').textContent = guitar ? 'Accordage, capo' : 'Accordage';
    $('tuning').innerHTML = '';
    Object.entries(C.TUNINGS).forEach(([k, t]) => { if (t.instrument === shownInst) $('tuning').add(new Option(t.label, k)); });
    $('presets').innerHTML = '';
    $('presets').add(new Option('Choisir…', ''));
    [['strings', 'Arpèges par cordes'], ['degrees', 'Arpèges par notes'], ['strum', 'Rythmiques']].forEach(([kind, label]) => {
      const group = document.createElement('optgroup'); group.label = label;
      presets().forEach((p, i) => { if (p.kind === kind) group.appendChild(new Option(p.name, i)); });
      $('presets').appendChild(group);
    });
    const row = $('count-row'); row.innerHTML = '';
    row.className = 'tool-row ' + (guitar ? 'five' : 'four');
    (guitar ? [[6, 'Toutes'], [4, '4'], [3, '3'], [2, '2'], [1, '1']] : [[4, '4 cordes'], [3, '3'], [2, '2'], [1, '1']]).forEach(([n, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.count = n; b.textContent = label;
      b.addEventListener('click', () => { const cur = strumSteps()[strumSel]; setStrumStep(Object.assign({}, cur, { count: n })); });
      row.appendChild(b);
    });
    fillModelSelect($('grid-all'), true);
  }
  /* Change d'instrument : accordage par défaut, et le motif en cours est traduit s'il vient des motifs prêts. */
  function setInstrument(name) {
    if (!C.INSTRUMENTS[name] || name === inst()) return;
    const before = presets(); const oldN = N();
    const known = before.find((p) => p.kind === state.patternKind && p.p === state.pattern.trim().replace(/\s+/g, ' '));
    const strum = state.patternKind === 'strum' ? C.parsePattern(state.pattern, 'strum', oldN).steps : null;
    state.lastTuning = Object.assign({}, state.lastTuning, { [inst()]: state.tuning });
    const back = state.lastTuning[name];
    state.tuning = back && C.TUNINGS[back] && C.TUNINGS[back].instrument === name ? back : C.INSTRUMENTS[name].tuning;
    state.overrides = {};
    const after = presets();
    const same = known && after.find((p) => p.name === known.name);
    if (same) state.pattern = same.p;
    else if (strum) state.pattern = strum.map((s) => C.strumToText(s.type === 'stroke' && s.count >= oldN ? Object.assign({}, s, { count: N() }) : s, N())).join(' ');
    else if (state.patternKind === 'strings') state.pattern = after.find((p) => p.kind === 'strings').p;
    // Les parties gardent leur motif s'il existe pour cet instrument, sinon elles prennent « mon motif ».
    if (state.sections) state.sections = songSections().map(sectionFromModel);
    syncForm(); saveDraft();
    if (score && !importedScore && score.bars.length) { score = C.buildScore(state); if (!$('tab-score').hidden) drawScore(); }
    if (!$('tab-chords').hidden) K.render(state.tuning);
  }
  document.querySelectorAll('[data-instrument]').forEach((b) => b.addEventListener('click', () => setInstrument(b.dataset.instrument)));

  function syncForm() {
    if (!Object.prototype.hasOwnProperty.call(C.TUNINGS, state.tuning)) state.tuning = 'standard';
    fillInstrument();
    $('title').value = state.title; $('chords').value = state.chords; $('pattern').value = state.pattern;
    ['meter', 'subdivision', 'tuning', 'transpose', 'mode', 'position'].forEach((k) => { $(k).value = state[k]; });
    $('tempo').value = state.tempo; tempoLabel();
    $('position-wrap').hidden = state.mode !== 'position';
    document.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === state.patternKind));
    kindHint(); drawGrid(); checkChords(); drawGridPage(); fillDurations(); drawPalette(); syncSimple();
  }
  function kindHint() {
    $('kind-hint').textContent = state.patternKind === 'strum'
      ? 'Touche un pas pour le régler, touche-le encore pour alterner bas, haut, silence. Au clavier : b bas, h haut, B fort, b. doux, (b) à vide, b2 sur 2 cordes, x étouffé, p pouce, t frappe sur le bois, 2 corde pincée, - silence.'
      : state.patternKind === 'strings'
      ? (inst() === 'guitar'
        ? 'Chaque pas indique la corde à pincer : 1 = ligne du haut de la tablature (mi aigu), 6 = ligne du bas. B = la basse de l\'accord, sur la corde qui la porte (la 5e pour Do, la 4e pour Ré…). 2+1 = ensemble, - = silence.'
        : 'Chaque pas indique la corde à pincer : 1 = ligne du haut de la tablature, 4 = ligne du bas. 2+1 = ensemble, - = silence.')
      : 'Chaque pas indique une note de l\'accord : T tonique, 3 tierce, 5 quinte, 7 septième. La corde est trouvée selon le doigté.';
  }
  function saveDraft() { store.set('draft', state); }

  ['title', 'chords', 'pattern'].forEach((k) => $(k).addEventListener('input', () => {
    state[k] = $(k).value;
    if (k === 'pattern') drawGrid();
    if (k === 'chords') { checkChords(); drawGridView(); }
    saveDraft();
  }));
  ['meter', 'subdivision', 'tuning', 'transpose', 'mode', 'position'].forEach((k) => $(k).addEventListener('change', () => {
    state[k] = k === 'transpose' || k === 'position' ? +$(k).value : $(k).value;
    if (k === 'tuning') state.overrides = {};
    if (k === 'meter') fillDurations();
    $('position-wrap').hidden = state.mode !== 'position';
    drawGrid(); saveDraft();
  }));

  /* ---------- écran de démarrage : choix de l'instrument ---------- */
  const prefs = Object.assign({ askInstrument: true }, store.get('prefs', {}));
  function openStart() {
    $('start-remember').checked = !prefs.askInstrument;
    $('start').hidden = false;
    const cur = document.querySelector('[data-start="' + inst() + '"]'); if (cur) cur.focus();
  }
  document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => {
    prefs.askInstrument = !$('start-remember').checked; store.set('prefs', prefs);
    $('opt-start').checked = prefs.askInstrument;
    setInstrument(b.dataset.start);
    $('start').hidden = true;
    goto('grid');
  }));
  $('opt-start').checked = prefs.askInstrument;
  $('opt-start').addEventListener('change', () => { prefs.askInstrument = $('opt-start').checked; store.set('prefs', prefs); });
  $('start-open').addEventListener('click', openStart);

  /* ---------- page Accords ---------- */
  K.init();
  K.onListen = () => { if (playing) setPlaying(false); };
  K.onUse = (label, shape) => {
    addFromPalette({ label, shape }); // la position choisie dans la fiche est gardée
    toast(label + ' ajouté à la grille');
  };
  K.onKeep = (label) => toast(label + ' gardé dans « Mes accords »');
  document.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    if (state.patternKind === b.dataset.kind) return;
    state.patternKind = b.dataset.kind;
    const preset = presets().find((p) => p.kind === state.patternKind);
    state.pattern = preset.p; $('pattern').value = state.pattern;
    syncForm(); saveDraft();
  }));
  $('presets').addEventListener('change', () => {
    const p = presets()[+$('presets').value];
    if (!p || $('presets').value === '') return;
    state.patternKind = p.kind; state.pattern = p.p;
    if (p.sub) state.subdivision = p.sub; else if (p.kind === 'strum') state.subdivision = '8';
    // Un motif de valse ou en 6/8 règle aussi la mesure du morceau.
    const mm = /\((3\/4|6\/8)\)$/.exec(p.name);
    if (mm && state.meter !== mm[1]) { state.meter = mm[1]; fillDurations(); toast('Mesure réglée sur ' + mm[1]); }
    syncForm(); saveDraft();
  });
  /* Les parties de la grille : [Couplet] en ouvre une. Sans titre, tout le morceau est une seule partie. */
  const songSections = () => C.parseGridText(state.chords);
  /* Mesures d'une partie écrite en tablature (intro, solo), ou null si ce sont des accords. */
  const tabOf = (sec) => C.sectionTab(sec.chords, state.meter, N());
  function checkChords() {
    const parts = songSections().map((sec) => { const tab = tabOf(sec); return tab ? { unknown: [], bars: tab.bars || [] } : C.parseChordText(sec.chords); });
    const unknown = parts.flatMap((r) => r.unknown); const bars = parts.reduce((n, r) => n + r.bars.length, 0);
    if (unknown.length) setMsg($('chord-msg'), 'Non reconnu : ' + [...new Set(unknown)].join(', '), 'warn');
    else setMsg($('chord-msg'), bars ? bars + ' mesure' + (bars > 1 ? 's' : '') + (parts.length > 1 ? ' en ' + parts.length + ' parties' : '') : '');
  }

  /* ---------- grille du motif ---------- */
  function rows() {
    if (state.patternKind === 'degrees') return [['7', '7'], ['5', '5'], ['3', '3'], ['T', 'T']];
    const n = C.TUNINGS[state.tuning].names;
    if (inst() !== 'guitar') return [['1', n[3]], ['2', n[2]], ['3', n[1]], ['4', n[0]]];
    // Deux cordes de mi : le numéro de corde lève le doute. La dernière ligne joue la basse de l'accord.
    return n.map((name, i) => [String(n.length - i), (n.length - i) + ' ' + name]).reverse().concat([['B', 'Basse']]);
  }
  let strumSel = 0;
  function strumSteps() { const s = C.parsePattern(state.pattern, 'strum', N()).steps; return s.length ? s : [{ type: 'rest' }]; }
  function setStrumStep(step) { const s = strumSteps(); s[strumSel] = step; writePattern(s); }
  function drawStrumGrid() {
    const steps = strumSteps();
    strumSel = Math.min(strumSel, steps.length - 1);
    const g = $('pattern-grid'); g.innerHTML = '';
    g.style.gridTemplateColumns = 'repeat(' + steps.length + ', 38px)';
    const stepUnits = state.subdivision === '16' ? 1 : 2;
    const units = C.METERS[state.meter].units;
    steps.forEach((st, i) => {
      const lab = document.createElement('div'); lab.className = 'beatlab';
      lab.textContent = C.beatLabel((i * stepUnits) % units, state.meter);
      g.appendChild(lab);
    });
    const NS = 'http://www.w3.org/2000/svg';
    steps.forEach((st, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'cell stroke' + (i === strumSel ? ' sel' : '');
      b.setAttribute('aria-label', 'Pas ' + (i + 1) + ' : ' + C.strumToText(st, N()));
      b.setAttribute('aria-pressed', i === strumSel);
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 36 50'); svg.setAttribute('aria-hidden', 'true');
      S.drawStroke(svg, 18, 7, 36, st, N());
      b.appendChild(svg);
      b.addEventListener('click', () => {
        if (i !== strumSel) { strumSel = i; drawGrid(); return; }
        // Deuxième toucher : alterne bas, haut, silence.
        const next = st.type === 'stroke' && st.dir === 'down' ? { type: 'stroke', dir: 'up', level: st.level, count: st.count }
          : st.type === 'stroke' ? { type: 'rest' } : { type: 'stroke', dir: 'down', level: 'normal', count: N() };
        setStrumStep(next);
      });
      g.appendChild(b);
    });
    const cur = steps[strumSel];
    const stroke = cur.type === 'stroke';
    const on = (attr, test) => document.querySelectorAll('[' + attr + ']').forEach((x) => {
      const yes = test(x.getAttribute(attr));
      x.classList.toggle('on', yes); x.setAttribute('aria-pressed', yes);
    });
    on('data-gesture', (v) => ({ down: stroke && cur.dir === 'down', up: stroke && cur.dir === 'up', chunk: cur.type === 'chunk', thumb: cur.type === 'thumb', tap: cur.type === 'tap', rest: cur.type === 'rest' })[v]);
    on('data-level', (v) => stroke && cur.level === v);
    on('data-count', (v) => stroke && cur.count === +v);
    document.querySelectorAll('[data-level],[data-count]').forEach((x) => { x.disabled = !stroke; });
  }
  document.querySelectorAll('[data-gesture]').forEach((b) => b.addEventListener('click', () => {
    const cur = strumSteps()[strumSel];
    const v = b.dataset.gesture;
    if (v === 'down' || v === 'up') setStrumStep({ type: 'stroke', dir: v, level: cur.level || 'normal', count: cur.count || N() });
    else if (v === 'chunk') setStrumStep(cur.type === 'chunk' ? { type: 'stroke', dir: cur.dir, level: 'normal', count: N() } : { type: 'chunk', dir: cur.dir || 'down' });
    else setStrumStep({ type: { thumb: 'thumb', tap: 'tap', rest: 'rest' }[v] });
  }));
  document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => { const cur = strumSteps()[strumSel]; setStrumStep(Object.assign({}, cur, { level: b.dataset.level })); }));

  function drawGrid() {
    const isStrum = state.patternKind === 'strum';
    $('strum-tools').hidden = !isStrum;
    if (isStrum) { drawStrumGrid(); return; }
    const pat = C.parsePattern(state.pattern, state.patternKind, N());
    const g = $('pattern-grid'); g.innerHTML = '';
    const steps = pat.steps.length ? pat.steps : [[]];
    const wide = inst() === 'guitar' && state.patternKind === 'strings';
    g.classList.toggle('wide', wide);
    g.style.gridTemplateColumns = (wide ? '48px' : '30px') + ' repeat(' + steps.length + ', 38px)';
    const perBeat = state.meter === '6/8' ? (state.subdivision === '16' ? 6 : 3) : (state.subdivision === '16' ? 4 : 2);
    rows().forEach(([tok, label]) => {
      const lab = document.createElement('div'); lab.className = 'rowlab'; lab.textContent = label; g.appendChild(lab);
      steps.forEach((st, i) => {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'cell' + (st.includes(tok) ? ' on' : '') + (i % perBeat === 0 ? ' beat' : '');
        b.setAttribute('aria-label', 'Pas ' + (i + 1) + ', ' + label + (st.includes(tok) ? ', actif' : ''));
        b.setAttribute('aria-pressed', st.includes(tok));
        b.addEventListener('click', () => {
          const cur = C.parsePattern(state.pattern, state.patternKind, N()).steps;
          if (!cur.length) cur.push([]);
          cur[i] = cur[i].includes(tok) ? cur[i].filter((x) => x !== tok) : cur[i].concat(tok);
          writePattern(cur);
        });
        g.appendChild(b);
      });
    });
  }
  function writePattern(steps) {
    state.pattern = steps.map((s) => (state.patternKind === 'strum' ? C.strumToText(s, N()) : s.length ? s.join('+') : '-')).join(' ');
    $('pattern').value = state.pattern;
    drawGrid(); saveDraft();
  }
  $('step-plus').addEventListener('click', () => { const s = C.parsePattern(state.pattern, state.patternKind, N()).steps; if (s.length < 32) { s.push(state.patternKind === 'strum' ? { type: 'rest' } : []); writePattern(s); } });
  $('step-minus').addEventListener('click', () => { const s = C.parsePattern(state.pattern, state.patternKind, N()).steps; if (s.length > 1) { s.pop(); writePattern(s); } });

  /* ---------- génération ---------- */
  /* Une seule génération pour les deux pages : la grille donne les accords et les parties, la page Motif la façon de les jouer. */
  function generate() {
    const sections = songSections();
    const named = sections.length > 1 || sections.some((sec) => sec.name);
    state.sections = named ? sections.map(sectionFromModel) : null;
    if (!named && sections.length) { const flat = sections[0].chords.trim(); if (flat !== state.chords.trim()) { state.chords = flat; $('chords').value = flat; } }
    importedScore = null;
    score = C.buildScore(state);
    saveDraft();
    goto('score');
  }
  $('generate').addEventListener('click', generate);
  $('generate-grid').addEventListener('click', generate);

  function drawScore() {
    const has = score && score.bars.length;
    const showProblems = score && score.problems.length;
    $('empty-score').hidden = !!has || !!showProblems;
    $('score-area').hidden = !has && !showProblems;
    if (showProblems) setMsg($('score-msg'), score.problems.join(' · '), 'warn'); else setMsg($('score-msg'), '');
    if (!score) return;
    drawDiagrams();
    syncShow(); syncSimple();
    // Une fois dans la partition, les diagrammes ne sont pas imprimés une seconde fois au-dessus.
    $('diagrams').classList.toggle('no-print', state.scoreDiagrams);
    if ($('lyrics').value !== state.lyrics) $('lyrics').value = state.lyrics;
    if (state.lyrics.trim()) $('lyrics-box').open = true;
    // Feuille de chant : pour un morceau fait d'accords (pas pour une tablature importée, qui n'a pas de grille).
    const canSheet = !importedScore && !!has;
    const sheet = canSheet && state.scoreMode === 'sheet';
    $('view-mode-row').hidden = !canSheet;
    document.querySelectorAll('[data-mode]').forEach((b) => { const on = (b.dataset.mode === 'sheet') === sheet; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('show-row').hidden = sheet; $('score').hidden = sheet; $('songsheet').hidden = !sheet;
    if (sheet) { buildSongSheet($('songsheet')); return; }
    try { S.render($('score'), score, state.view, scoreOpts()); }
    catch (e) { console.error(e); setMsg($('score-msg'), 'Gravure impossible : ' + e.message, 'err'); }
  }
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { state.scoreMode = b.dataset.mode; saveDraft(); drawScore(); }));

  /* ---------- feuille de chant : les accords au-dessus des paroles ---------- */
  /* Rythme ou arpège d'une partie, écrit comme sur une feuille : ↓ ↑ pour les coups, le numéro de la corde pincée, · pour un silence. */
  function patternText(sec) {
    const n = C.stringCount(state.tuning);
    if (sec.patternKind !== 'strum') return (sec.patternKind === 'degrees' ? 'notes ' : 'cordes ') + sec.pattern;
    return C.parsePattern(sec.pattern, 'strum', n).steps.map((st) => (st.type === 'rest' ? '·' : st.type === 'pick' ? st.strings.join('+') : C.strumSymbol(st, n))).join(' ');
  }
  function buildSongSheet(host) {
    host.innerHTML = '';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const lyrics = C.parseLyrics(state.lyrics, true); let bar = 0; let scoreBar = 0;
    const t = C.TUNINGS[state.tuning];
    host.appendChild(el('p', 'ss-meta', (t.instrument === 'guitar' ? 'Guitare' : 'Ukulélé') + (t.capo ? ', capo ' + t.capo : state.tuning !== C.INSTRUMENTS[t.instrument].tuning ? ', ' + t.label : '') + ' · ' + state.meter + ' · ' + state.tempo + ' à la noire'));
    const whole = { pattern: state.pattern, patternKind: state.patternKind };
    const sections = songSections();
    const named = sections.length > 1 || sections.some((sec) => sec.name);
    let lastPattern = null;
    sections.forEach((sec) => {
      const tab = tabOf(sec);
      if (tab) { // intro ou solo : la tablature de la partie, dessinée dans la feuille
        if (sec.name) { const h = el('div', 'ss-part'); h.appendChild(el('span', '', '[' + sec.name + ']')); host.appendChild(h); }
        const n = (tab.bars || []).length;
        if (n && score) {
          const box = el('div', 'ss-tab'); host.appendChild(box);
          const part = Object.assign({}, score, { bars: score.bars.slice(scoreBar, scoreBar + n).map((b) => ({ events: b.events })) });
          try { S.draw(box, part, 'tab', { names: false, width: Math.max(460, Math.min(900, 140 + n * 190)) }); } catch (e) { box.textContent = 'Tablature non affichée : ' + e.message; }
        }
        scoreBar += n; return;
      }
      const how = patternText(named ? sectionFromModel(sec) : whole);
      const head = el('div', 'ss-part');
      head.appendChild(el('span', '', sec.name ? '[' + sec.name + ']' : 'Rythme'));
      if (how !== lastPattern) head.appendChild(el('small', '', how)); // le rythme n'est répété que s'il change
      lastPattern = how;
      if (sec.name || how) host.appendChild(head);
      sec.chords.split(/\r?\n/).filter((l) => l.trim()).forEach((line) => {
        const row = el('div', 'ss-line');
        C.parseChordText(line).bars.forEach((chords) => {
          const names = chords.filter((c) => !c.held).map((c) => { const tc = C.transposeChord(c, state.transpose || 0); return (state.simple ? C.simplifyChord(tc, state.tuning) : tc).label; });
          let words = lyrics[bar++] || ''; scoreBar++;
          const cut = /-$/.test(words) && !/ -$/.test(words); // mot coupé par le changement de mesure : la suite se colle
          if (cut) words = words.slice(0, -1);
          // Les repères « ^ » placent chaque accord sur sa syllabe ; un texte avant le premier repère se chante avant l'accord.
          const parts = words.split('^');
          let cells;
          if (parts.length === names.length + 1) cells = [['', parts[0]]].concat(names.map((n, i) => [n, parts[i + 1]]));
          else if (parts.length === names.length) cells = names.map((n, i) => [n, parts[i]]);
          else cells = [[names.join(' '), parts.join('')]];
          cells = cells.filter(([n, w], i) => n || w || i === cells.length - 1);
          cells.forEach(([name, text], i) => {
            const last = i === cells.length - 1;
            const cell = el('span', 'ss-cell' + (!last || cut ? ' join' : '') + (text.trim() ? '' : ' bare'));
            cell.appendChild(el('span', 'ss-ch', name)); cell.appendChild(el('span', 'ss-ly', text));
            row.appendChild(cell);
          });
        });
        host.appendChild(row);
      });
    });
    host.setAttribute('role', 'document'); host.setAttribute('aria-label', 'Feuille de chant');
  }
  function drawDiagrams() {
    const box = $('diagrams'); box.innerHTML = '';
    $('diagram-hint').hidden = !score.voicings.length;
    score.voicings.forEach((v) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dia';
      b.textContent = v.chord.label;
      // « Manche » : la position des doigts sur le manche remplace le petit diagramme.
      if (state.scoreNeck) { b.classList.add('neck'); b.appendChild(K.neckView(v.frets, score.tuning)); } else b.appendChild(S.diagram(v.frets));
      b.setAttribute('aria-label', 'Accord ' + v.chord.label + ', doigté ' + shapeText(v.frets) + '. Changer');
      b.addEventListener('click', () => openSheet(v));
      box.appendChild(b);
    });
  }
  /* Accords très simplifiés : à la guitare seulement, et pour un morceau fait d'accords. */
  function syncSimple() {
    const guitar = C.TUNINGS[state.tuning].family === 'guitar';
    $('simple-wrap').hidden = !guitar; $('simple').checked = !!state.simple;
    const b = $('simple-toggle'); b.hidden = !guitar || !!importedScore || !(score && score.bars.length);
    b.classList.toggle('on', !!state.simple); b.setAttribute('aria-pressed', !!state.simple);
    b.textContent = state.simple ? 'Accords très simplifiés : oui' : 'Accords très simplifiés';
  }
  function setSimple(on) {
    state.simple = !!on; saveDraft();
    if (score && !importedScore && score.bars.length) { score = C.buildScore(state); if (!$('tab-score').hidden) drawScore(); }
    syncSimple();
    if (on) toast('Accords remplacés par leur version à 2 ou 3 doigts');
  }
  $('simple-toggle').addEventListener('click', () => setSimple(!state.simple));
  $('simple').addEventListener('change', () => setSimple($('simple').checked));

  /* Ce que la partition affiche : portée, tablature, noms d'accords, diagrammes, manche, solfège. */
  const shown = () => ({ staff: state.view !== 'tab', tab: state.view !== 'notation', names: state.scoreNames !== false, diagrams: !!state.scoreDiagrams, neck: !!state.scoreNeck, solfege: !!state.scoreSolfege });
  function syncShow() {
    const on = shown();
    const hasShapes = !!score && score.bars.some((b) => b.events.some((e) => e.frets));
    document.querySelectorAll('[data-show]').forEach((b) => {
      const k = b.dataset.show;
      b.classList.toggle('on', on[k]); b.setAttribute('aria-pressed', on[k]);
      b.disabled = (k === 'diagrams' || k === 'neck') && !hasShapes; // tablature importée : pas de doigtés d'accords
    });
  }
  document.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.show; const on = shown();
    if (k === 'staff' || k === 'tab') {
      on[k] = !on[k];
      if (!on.staff && !on.tab) on[k === 'staff' ? 'tab' : 'staff'] = true; // il reste toujours l'une des deux
      state.view = on.staff && on.tab ? 'both' : on.tab ? 'tab' : 'notation';
    } else state[{ names: 'scoreNames', diagrams: 'scoreDiagrams', neck: 'scoreNeck', solfege: 'scoreSolfege' }[k]] = !on[k];
    saveDraft(); drawScore();
  }));
  function scoreOpts() { return { diagrams: state.scoreDiagrams, names: state.scoreNames !== false, solfege: !!state.scoreSolfege, lyrics: score ? C.lyricsFor(score, state.lyrics) : [] }; }

  /* Position des doigts d'un accord de la partition : au survol à la souris, au toucher sur un écran tactile. */
  const pop = $('chord-pop'); let popFor = null;
  function showPop(target) {
    const frets = target.dataset.frets.split(',').map(Number);
    if (!score || frets.length !== C.stringCount(score.tuning)) return;
    pop.innerHTML = '';
    const title = document.createElement('b'); title.textContent = target.dataset.chord; pop.appendChild(title);
    pop.appendChild(K.neckView(frets, score.tuning));
    const sm = document.createElement('small'); sm.textContent = 'Cases, du grave à l\'aigu : ' + shapeText(frets); pop.appendChild(sm);
    pop.hidden = false; popFor = target;
    const r = target.getBoundingClientRect(); const w = pop.offsetWidth; const h = pop.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    const top = r.bottom + 8 + h < window.innerHeight - 70 ? r.bottom + 8 : Math.max(8, r.top - h - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function hidePop() { pop.hidden = true; popFor = null; }
  $('score').addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && e.target.classList && e.target.classList.contains('chord-hit')) showPop(e.target); });
  $('score').addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target === popFor) hidePop(); });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('chord-hit')) { if (popFor === t && !pop.hidden) hidePop(); else showPop(t); } else if (!pop.hidden) hidePop();
  });
  window.addEventListener('scroll', () => { if (!pop.hidden) hidePop(); }, { passive: true });
  let lyricsT;
  $('lyrics').addEventListener('input', () => {
    state.lyrics = $('lyrics').value; saveDraft();
    clearTimeout(lyricsT);
    lyricsT = setTimeout(() => { if (score && score.bars.length) { if (!$('songsheet').hidden) buildSongSheet($('songsheet')); else S.render($('score'), score, state.view, scoreOpts()); } }, 250);
  });
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!$('tab-score').hidden) drawScore(); }, 150); });

  /* ---------- choix du doigté ---------- */
  let sheetChord = null; let sheetPin = null;
  /* Remplace dans la grille une position écrite (C@0007) par une autre, ou par l'accord simple. */
  function repin(label, pin, next) {
    const text = state.chords.replace(/[^\s|]+/g, (tok) => { const c = C.parseChord(tok); return c && c.pin === pin && c.label === label ? label + (next ? '@' + next : '') : tok; });
    state.chords = text; $('chords').value = text; checkChords(); drawGridView();
    if (state.sections) state.sections = songSections().map(sectionFromModel);
  }
  function openSheet(v) {
    sheetChord = v.chord.label; sheetPin = v.chord.pin || null;
    $('sheet-title').textContent = 'Doigtés de ' + v.chord.label + (sheetPin ? ' (position écrite dans la grille)' : '');
    const list = $('sheet-list'); list.innerHTML = '';
    C.voicingsFor(v.chord, score.tuning).slice(0, 12).forEach((alt) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'dia' + (alt.shape === v.shape ? ' sel' : '');
      b.textContent = shapeText(alt.frets); b.appendChild(S.diagram(alt.frets));
      b.addEventListener('click', () => { if (sheetPin) repin(sheetChord, sheetPin, alt.shape); else state.overrides[sheetChord] = alt.shape; applySheet(); });
      list.appendChild(b);
    });
    $('sheet').hidden = false;
  }
  function closeSheet() { $('sheet').hidden = true; }
  function applySheet() { closeSheet(); saveDraft(); score = C.buildScore(state); drawScore(); }
  $('sheet-close').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
  $('sheet-auto').addEventListener('click', () => { if (sheetPin) repin(sheetChord, sheetPin, null); else delete state.overrides[sheetChord]; applySheet(); });
  window.onAndroidBack = function () { if (videoJob) { videoJob.cancel(); return true; } for (const id of ['send-sheet', 'receive-sheet']) if (!$(id).hidden) { $(id).hidden = true; return true; } if (K.isMakerOpen()) { K.closeMaker(); return true; } if (K.isOpen()) { K.close(); return true; } if (!$('start').hidden) { $('start').hidden = true; return true; } if (!$('sheet').hidden) { closeSheet(); return true; } if ($('tab-grid').hidden) { goto('grid'); return true; } return false; };

  /* ---------- grille d'accords ---------- */
  const KEYS = { major: ['C', 'D', 'Eb', 'E', 'F', 'G', 'A', 'Bb'], minor: ['A', 'B', 'C', 'D', 'E', 'F#', 'G'] };
  const MINE = '__mine';
  function fillModelSelect(sel, withKeep) {
    sel.innerHTML = '';
    if (withKeep) sel.add(new Option('Choisir…', ''));
    sel.add(new Option('Mon motif (ci-dessus)', MINE));
    [['strings', 'Arpèges par cordes'], ['degrees', 'Arpèges par notes'], ['strum', 'Rythmiques']].forEach(([kind, label]) => {
      const group = document.createElement('optgroup'); group.label = label;
      presets().filter((p) => p.kind === kind).forEach((p) => group.appendChild(new Option(p.name, p.name)));
      sel.appendChild(group);
    });
  }
  function fillKeys() {
    const g = state.grid;
    if (!KEYS[g.mode].includes(g.key)) g.key = KEYS[g.mode][0];
    $('grid-key').innerHTML = '';
    KEYS[g.mode].forEach((k) => $('grid-key').add(new Option(k + (g.mode === 'minor' ? 'm' : ''), k)));
    $('grid-key').value = g.key;
  }
  /* Motif d'une partie : celui choisi pour elle, sinon « mon motif ». */
  function gridModel(name) { return state.grid.models[name] || MINE; }
  function drawGridPage() {
    const g = state.grid;
    $('grid-mode').value = g.mode; fillKeys();
    $('grid-style').value = g.style; $('grid-form').value = g.form; $('grid-bars').value = String(g.bars); $('grid-perbar').value = String(g.perBar);
    drawGridView();
  }
  /* La grille dessinée (page Grille) et le choix d'un motif par partie (page Motif). */
  function drawGridView() {
    const sections = songSections();
    const view = $('grid-view'); view.innerHTML = '';
    sections.forEach((sec) => {
      if (sec.name) { const h = document.createElement('div'); h.className = 'grid-name'; h.textContent = sec.name; view.appendChild(h); }
      const tab = tabOf(sec);
      if (tab) { // partie en tablature : pas de cases d'accords
        const note = document.createElement('div'); note.className = 'grid-tab' + (tab.problem ? ' warn' : '');
        note.textContent = tab.problem ? 'Tablature : ' + tab.problem : 'Tablature · ' + tab.bars.length + ' mesure' + (tab.bars.length > 1 ? 's' : '');
        view.appendChild(note); return;
      }
      const parsed = C.parseChordText(sec.chords);
      const row = document.createElement('div'); row.className = 'grid-bars';
      parsed.bars.forEach((bar) => {
        // Chaque accord occupe dans la case une largeur proportionnelle à sa durée.
        const c = document.createElement('div'); c.className = 'grid-bar';
        bar.forEach((x, i) => {
          if (x.held) return;
          let span = 1; while (bar[i + span] && bar[i + span].held) span++;
          const slot = document.createElement('div'); slot.className = 'slot'; slot.style.flex = span + ' 1 0'; slot.textContent = x.label;
          if (x.pin) { slot.classList.add('pinned'); slot.title = 'Position ' + x.pin.split('').join(' '); const sm = document.createElement('small'); sm.textContent = x.pin; slot.appendChild(sm); }
          c.appendChild(slot);
        });
        row.appendChild(c);
      });
      view.appendChild(row);
    });
    const names = [...new Set(sections.filter((sec) => !tabOf(sec)).map((s) => s.name))]; // une tablature n'a pas de motif à choisir
    const several = names.length > 0 && (sections.length > 1 || sections.some((sec) => sec.name));
    $('parts').hidden = !several;
    const box = $('grid-models'); box.innerHTML = '';
    if (!several) return;
    names.forEach((name) => {
      const label = document.createElement('label'); label.className = 'inline';
      const span = document.createElement('span'); span.textContent = name || 'Début'; label.appendChild(span);
      const sel = document.createElement('select'); fillModelSelect(sel); sel.value = gridModel(name);
      if (sel.value !== gridModel(name)) sel.value = MINE; // motif prêt d'un autre instrument
      sel.dataset.section = name;
      sel.addEventListener('change', () => { state.grid.models[name] = sel.value; saveDraft(); });
      label.appendChild(sel); box.appendChild(label);
    });
  }
  function proposeGrid() {
    const g = state.grid;
    const style = C.GRID_STYLES[g.style];
    if (style.meter && state.meter !== style.meter) { state.meter = style.meter; $('meter').value = state.meter; fillDurations(); }
    state.chords = C.generateGrid(g).trim();
    g.seed = (g.seed || 0) + 1; // le prochain appui propose un autre enchaînement
    // Le style propose un motif pour chaque partie ; il se change en page Motif.
    g.models = {};
    songSections().forEach((sec) => { g.models[sec.name] = style.models[sec.name] || style.models.Couplet; });
    state.overrides = {};
    $('chords').value = state.chords;
    checkChords(); drawGridView(); saveDraft();
  }
  function sectionFromModel(sec) {
    const value = gridModel(sec.name);
    const p = presets().find((x) => x.name === value);
    const m = p ? { pattern: p.p, patternKind: p.kind, subdivision: p.sub || '8' } : { pattern: state.pattern, patternKind: state.patternKind, subdivision: state.subdivision };
    return Object.assign({ name: sec.name, chords: sec.chords }, m);
  }
  function fillGridSelects() {
    Object.entries(C.GRID_STYLES).forEach(([k, st]) => $('grid-style').add(new Option(st.label, k)));
  }
  ['mode', 'style', 'form', 'bars', 'perbar'].forEach((k) => $('grid-' + k).addEventListener('change', () => {
    const field = k === 'perbar' ? 'perBar' : k;
    const v = $('grid-' + k).value;
    state.grid[field] = k === 'bars' || k === 'perbar' ? +v : v;
    if (k === 'mode') fillKeys();
    saveDraft();
  }));
  $('grid-key').addEventListener('change', () => { state.grid.key = $('grid-key').value; saveDraft(); });
  $('grid-propose').addEventListener('click', proposeGrid);
  $('grid-all').addEventListener('change', () => {
    const v = $('grid-all').value;
    if (!v) return;
    songSections().forEach((s) => { state.grid.models[s.name] = v; });
    $('grid-all').value = ''; drawGridView(); saveDraft();
  });

  /* ---------- palette : construire la grille en touchant les accords ---------- */
  /* Une mesure se découpe en « temps » : 4 en 4/4, 3 en 3/4, 2 en 2/4 et en 6/8. */
  const slotsPerBar = () => ({ '4/4': 4, '3/4': 3, '2/4': 2, '6/8': 2 })[state.meter] || 4;
  const durations = () => ({
    '4/4': [['Mesure', 4], ['½', 2], ['¼', 1]], '3/4': [['Mesure', 3], ['1 temps', 1]], '2/4': [['Mesure', 2], ['½', 1]], '6/8': [['Mesure', 2], ['½', 1]],
  })[state.meter] || [['Mesure', 4]];
  let palSlots = 0; let pal = null; const palHistory = [];
  function fillDurations(keep) {
    const box = $('pal-dur'); box.innerHTML = '';
    const list = durations();
    if (!list.some(([, n]) => n === palSlots)) palSlots = list[0][1];
    list.forEach(([label, n]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.classList.toggle('on', n === palSlots); b.setAttribute('aria-pressed', n === palSlots);
      b.title = n === slotsPerBar() ? 'L\'accord dure toute la mesure' : 'L\'accord dure ' + label + ' de la mesure';
      b.addEventListener('click', () => { palSlots = n; fillDurations(true); });
      box.appendChild(b);
    });
    if (!keep) pal = null; // la mesure du morceau a changé : la prochaine mesure repart à zéro
  }
  /* Écriture d'une mesure : « Am » si un seul accord, « Am F » pour deux moitiés, sinon temps par temps avec des tirets. */
  function barText(tokens) {
    const S = slotsPerBar();
    const t = tokens.concat(new Array(Math.max(0, S - tokens.length)).fill('-')); // mesure en cours : le dernier accord tient jusqu'au bout
    if (t.slice(1).every((x) => x === '-')) return t[0];
    if (S === 4 && t[1] === '-' && t[3] === '-' && t[2] !== '-') return t[0] + ' ' + t[2];
    return t.join(' ');
  }
  function setChords(text) {
    state.chords = text; $('chords').value = text;
    checkChords(); drawGridView(); saveDraft();
  }
  function addFromPalette(c) {
    palHistory.push(state.chords); if (palHistory.length > 100) palHistory.shift();
    const S = slotsPerBar();
    if (!pal || pal.text !== state.chords) { const base = state.chords.replace(/\s+$/, ''); pal = { base: base ? base + '\n' : '', bars: [] }; }
    let cur = pal.bars[pal.bars.length - 1];
    if (!cur || cur.length + palSlots > S) {
      if (pal.bars.length === 4) { pal.base = pal.text + '\n'; pal.bars = []; } // quatre mesures par ligne
      cur = []; pal.bars.push(cur);
    }
    // Une position qui n'est pas celle que l'application choisirait est écrite avec l'accord : C@0007.
    const parsed = C.parseChord(c.label); const usual = parsed && C.voicingsFor(parsed, state.tuning)[0];
    const token = c.shape && (!usual || usual.shape !== c.shape) ? c.label + '@' + c.shape : c.label;
    cur.push(token, ...new Array(palSlots - 1).fill('-'));
    pal.text = pal.base + '| ' + pal.bars.map(barText).join(' | ') + ' |';
    setChords(pal.text);
  }
  function drawPalette() {
    const sel = $('pal-source');
    if (!sel.options.length) K.paletteSources().forEach(([title, items]) => {
      const g = document.createElement('optgroup'); g.label = title;
      items.forEach(([value, label]) => g.appendChild(new Option(label, value)));
      sel.appendChild(g);
    });
    if (state.palette && [...sel.options].some((o) => o.value === state.palette)) sel.value = state.palette;
    const box = $('pal-chords'); box.innerHTML = '';
    const list = K.paletteChords(sel.value, state.tuning);
    list.forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dia';
      b.textContent = c.label; b.appendChild(S.diagram(c.frets));
      b.setAttribute('aria-label', 'Ajouter ' + c.label + ' à la grille');
      b.addEventListener('click', () => addFromPalette(c));
      box.appendChild(b);
    });
    if (!list.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Aucun accord créé pour cet instrument : onglet Accords, « Créer un accord ».'; box.appendChild(p); }
  }
  $('pal-source').addEventListener('change', () => { state.palette = $('pal-source').value; saveDraft(); drawPalette(); });
  $('pal-undo').addEventListener('click', () => { if (!palHistory.length) { toast('Rien à annuler'); return; } pal = null; setChords(palHistory.pop()); });
  $('pal-part').addEventListener('change', () => {
    let name = $('pal-part').value; $('pal-part').value = '';
    if (!name) return;
    palHistory.push(state.chords); pal = null;
    const base = state.chords.replace(/\s+$/, '');
    let body = '';
    if (/^tab:/.test(name)) { // intro ou solo : un modèle de tablature vide, deux mesures à remplir
      name = name.slice(4);
      const t = C.TUNINGS[state.tuning]; const units = C.METERS[state.meter].units;
      body = t.names.map((x, i) => (i === t.names.length - 1 && t.names.length > 4 ? x.toLowerCase() : x)).reverse().map((x) => x.padEnd(2) + '|' + '-'.repeat(units) + '|' + '-'.repeat(units) + '|').join('\n') + '\n';
    }
    setChords((base ? base + '\n\n' : '') + '[' + name + ']\n' + body);
    $('chords').focus();
    if (body) toast('Remplace les tirets par les numéros de case : ' + C.METERS[state.meter].units + ' caractères par mesure');
  });

  /* ---------- lecture ---------- */
  function tempoLabel() { $('tempo-label').textContent = state.tempo + ' à la noire'; }
  $('tempo').addEventListener('input', () => { state.tempo = +$('tempo').value; tempoLabel(); saveDraft(); });
  function setPlaying(v) { playing = v; $('play').textContent = v ? '■' : '▶'; $('play').setAttribute('aria-label', v ? 'Arrêter' : 'Écouter'); }
  $('play').addEventListener('click', () => {
    if (playing) { S.stop(); setPlaying(false); return; }
    if (!score || !score.bars.length) return;
    if (S.play(score, state.tempo, () => setPlaying(false))) setPlaying(true);
  });

  /* ---------- export ---------- */
  const D = window.Desktop;
  const errText = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  if (D) { $('share').textContent = 'Exporter .txt'; }
  $('share').addEventListener('click', async () => {
    if (!score) return;
    const text = C.scoreToText(Object.assign({}, score, { title: state.title, lyrics: C.lyricsFor(score, state.lyrics) }));
    if (D) {
      try { const p = await D.saveText(state.title || 'Tablature', text); if (p) toast('Enregistré : ' + p); }
      catch (e) { toast('Écriture impossible : ' + errText(e)); }
      return;
    }
    if (window.Android && window.Android.shareText) { window.Android.shareText(state.title || 'Tablature', text); return; }
    if (navigator.share) { navigator.share({ title: state.title, text }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Tablature copiée'));
  });
  /* Pages imprimées : titre en haut, 6 lignes de 4 à 6 mesures selon la mesure, même échelle sur toutes les pages. */
  const PX_PER_MM = 96 / 25.4; const PAGE_W = 186; const PAGE_H = 266; const LINES_PER_PAGE = 6;
  function buildPrint() {
    const host = $('print-pages'); host.innerHTML = '';
    if (!score || !score.bars.length) return;
    if (!importedScore && state.scoreMode === 'sheet') { // feuille de chant : titre, diagrammes, puis le texte qui coule de page en page
      const page = document.createElement('section'); page.className = 'sheet-print';
      const h = document.createElement('h1'); h.textContent = state.title.trim() || 'Feuille de chant'; page.appendChild(h);
      const row = document.createElement('div'); row.className = 'page-dias';
      score.voicings.forEach((v) => { const d = document.createElement('div'); d.className = 'dia' + (state.scoreNeck ? ' neck' : ''); d.textContent = v.chord.label; d.appendChild(state.scoreNeck ? K.neckView(v.frets, score.tuning) : S.diagram(v.frets)); row.appendChild(d); });
      page.appendChild(row);
      const body = document.createElement('div'); body.className = 'songsheet'; buildSongSheet(body); page.appendChild(body);
      host.appendChild(page);
      return;
    }
    const perLine = C.printBarsPerLine(score.meter);
    const all = C.fixedLines(score, perLine);
    const pages = [];
    for (let i = 0; i < all.length; i += LINES_PER_PAGE) pages.push(all.slice(i, i + LINES_PER_PAGE));
    const title = state.title.trim() || 'Tablature';
    const opts = Object.assign(scoreOpts(), { perLine });
    const bodies = pages.map((lines, pi) => {
      const page = document.createElement('section'); page.className = 'page';
      const head = document.createElement('header'); head.className = 'page-head' + (pi ? ' small' : '');
      if (pi === 0) {
        const h = document.createElement('h1'); h.textContent = title; head.appendChild(h);
        // Sans diagrammes dans la partition, les doigtés sont rappelés sous le titre.
        if ((state.scoreNeck || !state.scoreDiagrams) && score.voicings.length) {
          const row = document.createElement('div'); row.className = 'page-dias';
          score.voicings.forEach((v) => { const d = document.createElement('div'); d.className = 'dia' + (state.scoreNeck ? ' neck' : ''); d.textContent = v.chord.label; d.appendChild(state.scoreNeck ? K.neckView(v.frets, score.tuning) : S.diagram(v.frets)); row.appendChild(d); });
          head.appendChild(row);
        }
      } else head.textContent = title + ' · ' + (pi + 1) + '/' + pages.length;
      const body = document.createElement('div'); body.className = 'page-score';
      page.appendChild(head); page.appendChild(body); host.appendChild(page);
      return { body, lines };
    });
    // La page la plus chargée (la première, avec son titre) fixe l'échelle : 6 lignes doivent y tenir.
    const headMm = host.querySelector('.page-head').getBoundingClientRect().height / PX_PER_MM;
    const areaMm = PAGE_H - headMm - 2;
    const g = S.geometry(score, state.view, Object.assign({ lines: all }, opts));
    const width = Math.ceil(Math.max((LINES_PER_PAGE * g.lineH + 8) * PAGE_W / areaMm, g.minWidth, 600));
    bodies.forEach((b) => S.draw(b.body, score, state.view, Object.assign({ lines: b.lines, width }, opts)));
  }
  window.addEventListener('beforeprint', buildPrint);
  $('print').addEventListener('click', async () => {
    buildPrint();
    if (D) {
      try { const p = await D.savePdf(state.title || 'Tablature'); if (p) toast('Enregistré : ' + p); }
      catch (e) { toast('Écriture impossible : ' + errText(e)); }
      return;
    }
    if (window.Android && window.Android.printPage) window.Android.printPage(state.title || 'Tablature');
    else window.print();
  });

  /* ---------- vidéo ---------- */
  let videoJob = null;
  function toBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  /* Où écrire un fichier binaire (vidéo, Guitar Pro) : boîte « Enregistrer sous » sur PC,
     dossiers Films ou Téléchargements sur Android, téléchargement dans un navigateur. v : { blob, ext, mime } */
  function binarySaver() {
    const A = window.Android;
    const download = async (name, v) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(v.blob); a.download = name + '.' + v.ext;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      return a.download;
    };
    if (D && D.saveBinary) {
      return async (name, v) => {
        try { return await D.saveBinary(name, v.ext, new Uint8Array(await v.blob.arrayBuffer())); } catch (e) {
          if (!/Format refusé/.test(errText(e))) throw e;
          return download(name, v); // application PC plus ancienne que ce format : téléchargement ordinaire
        }
      };
    }
    if (A && A.saveFileBegin) {
      return async (name, v) => {
        const begin = A.saveFileBegin(name + '.' + v.ext, v.mime);
        if (begin) throw new Error(begin);
        const bytes = new Uint8Array(await v.blob.arrayBuffer());
        for (let i = 0; i < bytes.length; i += 393216) {
          const err = A.saveFileChunk(toBase64(bytes.subarray(i, i + 393216)));
          if (err) throw new Error(err);
        }
        const end = JSON.parse(A.saveFileEnd());
        if (end.error) throw new Error(end.error);
        return end.path;
      };
    }
    if (A) return null; // application Android trop ancienne : pas d'écriture de fichier
    return download;
  }
  function setVideoProgress(f) {
    const pct = Math.round(f * 100);
    $('video-bar').style.width = pct + '%';
    $('video-progress').setAttribute('aria-valuenow', pct);
  }
  $('video').addEventListener('click', async () => {
    if (!score || !score.bars.length || videoJob) return;
    if (!window.UkuVideo.supported()) { toast('Vidéo impossible sur cet appareil'); return; }
    const save = binarySaver();
    if (!save) { toast('Pour enregistrer des vidéos, installe la dernière version de l\'application'); return; }
    if (playing) { S.stop(); setPlaying(false); }
    setVideoProgress(0);
    $('video-msg').textContent = 'La vidéo s\'enregistre pendant la lecture : garde cette fenêtre ouverte jusqu\'à la fin.';
    $('video-sheet').hidden = false;
    videoJob = window.UkuVideo.record(Object.assign({ score, view: state.view, bpm: state.tempo, title: state.title, canvas: $('video-canvas'), onProgress: setVideoProgress }, scoreOpts()));
    try {
      const v = await videoJob.promise;
      if (v) {
        $('video-msg').textContent = 'Écriture du fichier…';
        const where = await save(videoName(), v);
        if (where) toast('Vidéo enregistrée : ' + where);
      }
    } catch (e) { toast('Vidéo impossible : ' + errText(e)); }
    finally { videoJob = null; $('video-sheet').hidden = true; }
  });
  function videoName() { return (state.title.trim() || 'Arpege').replace(/[\\/:*?"<>|]+/g, '-'); }
  $('video-cancel').addEventListener('click', () => { if (videoJob) videoJob.cancel(); });

  /* ---------- Guitar Pro ---------- */
  $('gpx').addEventListener('click', async () => {
    if (!score || !score.bars.length) return;
    const save = binarySaver();
    if (!save) { toast('Pour enregistrer des fichiers Guitar Pro, installe la dernière version de l\'application'); return; }
    try {
      const bytes = await window.UkuGp.exportGp(score, { title: state.title.trim(), tempo: state.tempo, lyrics: C.lyricsFor(score, state.lyrics) });
      const where = await save(videoName(), { blob: new Blob([bytes]), ext: 'gp', mime: 'application/x-gtp' });
      if (where) toast('Fichier Guitar Pro enregistré : ' + where);
    } catch (e) { toast('Export Guitar Pro impossible : ' + errText(e)); }
  });
  /* Paroles d'un fichier : 4 mesures par ligne, « _ » pour une mesure sans paroles. */
  function lyricsText(list) {
    const cells = list.slice(); while (cells.length && !cells[cells.length - 1]) cells.pop();
    const lines = [];
    for (let i = 0; i < cells.length; i += 4) lines.push(cells.slice(i, i + 4).map((w) => w || '_').join(' | '));
    return lines.join('\n');
  }
  async function openGuitarPro(bytes) {
    const r = await window.UkuGp.importGp(bytes, N());
    if (!r.score.bars.length) throw new Error('aucune mesure dans ce fichier');
    if (playing) { S.stop(); setPlaying(false); }
    importedScore = r.score; score = r.score;
    if (r.title) { state.title = r.title; $('title').value = r.title; }
    if (r.tempo) { state.tempo = Math.min(180, Math.max(40, r.tempo)); $('tempo').value = state.tempo; tempoLabel(); }
    state.lyrics = lyricsText(r.lyrics); saveDraft();
    goto('score');
    toast('Fichier Guitar Pro importé : ' + r.score.bars.length + ' mesures');
  }

  /* ---------- morceaux ---------- */
  /* Sur PC : fichiers dans le dossier choisi. Sur Android et navigateur : stockage interne. */
  const library = D ? {
    list: () => D.listSongs(),
    save: (song, text) => D.saveSong(song, text),
    remove: (song) => D.removeSong(song.file),
  } : {
    list: async () => ({ songs: store.get('songs', []), invalid: 0 }),
    save: async (song) => {
      const others = store.get('songs', []).filter((s) => s.title !== song.title);
      if (!store.set('songs', [Object.assign({ at: Date.now() }, song)].concat(others))) throw new Error('stockage plein');
    },
    remove: async (song) => { store.set('songs', store.get('songs', []).filter((s) => s.title !== song.title)); },
  };

  /* Le morceau affiché, sous la forme enregistrée. */
  function currentSong() {
    const item = { title: state.title.trim() };
    if (importedScore) item.imported = Object.assign({}, importedScore, { lyricsText: state.lyrics }); // gardé aussi par les anciennes versions PC
    else item.cfg = Object.assign({}, state);
    return item;
  }
  async function saveSong() {
    if (!score) return;
    if (!state.title.trim()) { toast('Donne un titre en haut de l\'écran'); $('title').focus(); return; }
    const item = currentSong();
    try {
      await library.save(item, C.scoreToText(Object.assign({}, score, { title: item.title, lyrics: C.lyricsFor(score, state.lyrics) })));
      toast('Morceau enregistré');
    } catch (e) { toast('Enregistrement impossible : ' + errText(e)); }
  }
  $('save').addEventListener('click', saveSong);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('tab-score').hidden) { e.preventDefault(); saveSong(); }
  });

  let songsRender = 0;
  async function renderSongs() {
    const ticket = ++songsRender;
    if (D) await renderStorage();
    let res;
    try { res = await library.list(); }
    catch (e) { res = { songs: [], invalid: 0 }; setMsg($('songs-warning'), 'Dossier illisible : ' + errText(e), 'warn'); }
    if (ticket !== songsRender) return; // un affichage plus récent a pris le relais
    if (res.invalid) setMsg($('songs-warning'), res.invalid + ' fichier(s) de morceau illisible(s) ignoré(s) dans le dossier.', 'warn');
    else if (!$('songs-warning').textContent.startsWith('Dossier')) setMsg($('songs-warning'), '');
    const ul = $('songs'); ul.innerHTML = '';
    const list = res.songs;
    $('no-songs').hidden = !!list.length;
    list.forEach((song) => {
      const li = document.createElement('li');
      const open = document.createElement('button'); open.type = 'button'; open.className = 'song-open';
      const b = document.createElement('b'); b.textContent = song.title;
      const sm = document.createElement('small');
      sm.textContent = song.imported ? 'Tablature importée · ' + song.imported.bars.length + ' mesures' : (song.cfg.chords.replace(/\s+/g, ' ') + ' · ' + song.cfg.pattern);
      open.append(b, sm);
      open.addEventListener('click', () => openSong(song));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'song-del'; del.textContent = 'Supprimer';
      del.addEventListener('click', async () => {
        if (!del.classList.contains('confirm')) {
          del.classList.add('confirm'); del.textContent = 'Confirmer ?';
          setTimeout(() => { del.classList.remove('confirm'); del.textContent = 'Supprimer'; }, 3000);
          return;
        }
        try { await library.remove(song); } catch (e) { toast('Suppression impossible : ' + errText(e)); }
        renderSongs();
      });
      li.append(open, del); ul.appendChild(li);
    });
  }

  function openSong(song) {
    if (song.imported) { importedScore = song.imported; score = song.imported; state.title = song.title; state.lyrics = song.imported.lyricsText || ''; $('title').value = song.title; }
    else {
      Object.assign(state, { sections: null, lyrics: '' }, song.cfg, { title: song.title }); importedScore = null; score = C.buildScore(state);
      if (state.sections && state.sections.length) {
        if (!songSections().some((sec) => sec.name) && state.sections.some((x) => x.name)) state.chords = state.sections.map((x) => (x.name ? '[' + x.name + ']\n' : '') + String(x.chords).trim()).join('\n\n');
        const list = presets(); const models = {};
        state.sections.forEach((x) => { const p = list.find((q) => q.kind === x.patternKind && q.p === x.pattern); models[x.name || ''] = p ? p.name : MINE; });
        state.grid = Object.assign({}, state.grid, { models });
      }
      syncForm();
    }
    saveDraft();
    goto('score');
  }

  /* ---------- envoi et réception d'un morceau ---------- */
  // Les liens ouvrent la version web, que l'élève l'ait installée ou non.
  const WEB_URL = 'https://chpoulain.github.io/Arpege/';
  const webBase = () => (D || window.Android || !/^https?:$/.test(location.protocol) ? WEB_URL : location.origin + location.pathname);
  let sending = null;
  $('send').addEventListener('click', async () => {
    if (!score || !score.bars.length) return;
    if (!state.title.trim()) { toast('Donne un titre en haut de l\'écran'); $('title').focus(); return; }
    sending = C.shareSong(currentSong());
    let link = '';
    try { link = webBase() + '#morceau=' + await C.packSong(sending); } catch (e) { link = ''; }
    const fits = link && link.length <= 6000;
    $('send-link-box').hidden = !fits; $('send-long').hidden = !!fits;
    $('send-link').value = fits ? link : '';
    $('send-share').hidden = !(navigator.share || (window.Android && window.Android.shareText));
    $('send-title').textContent = 'Envoyer « ' + sending.title + ' »';
    $('send-sheet').hidden = false;
  });
  $('send-close').addEventListener('click', () => { $('send-sheet').hidden = true; });
  $('send-sheet').addEventListener('click', (e) => { if (e.target === $('send-sheet')) $('send-sheet').hidden = true; });
  $('send-copy').addEventListener('click', async () => {
    const input = $('send-link');
    try { await navigator.clipboard.writeText(input.value); toast('Lien copié'); }
    catch (e) { input.select(); toast('Sélectionné : copie-le avec Ctrl+C ou un appui long'); }
  });
  $('send-share').addEventListener('click', () => {
    const text = 'Morceau « ' + sending.title + ' » pour Arpège';
    if (navigator.share) navigator.share({ title: sending.title, text, url: $('send-link').value }).catch(() => {});
    else window.Android.shareText(sending.title, text + '\n' + $('send-link').value);
  });
  $('send-file').addEventListener('click', async () => {
    const save = binarySaver();
    if (!save) { toast('Pour enregistrer le fichier, installe la dernière version de l\'application, ou envoie le lien'); return; }
    try {
      const blob = new Blob([JSON.stringify(sending)], { type: 'application/json' });
      const where = await save(videoName(), { blob, ext: 'arpege', mime: 'application/json' });
      if (where) toast('Fichier enregistré : ' + where);
    } catch (e) { toast('Enregistrement impossible : ' + errText(e)); }
  });

  let received = null;
  function showReceived(song) {
    received = song;
    $('receive-title').textContent = 'Morceau reçu : ' + song.title;
    $('receive-text').textContent = song.cfg
      ? 'Accords : ' + song.cfg.chords.replace(/\s+/g, ' ').slice(0, 120) + (song.cfg.sections ? ' · ' + song.cfg.sections.length + ' parties' : '')
      : 'Tablature de ' + song.imported.bars.length + ' mesures.';
    $('receive-sheet').hidden = false;
  }
  $('receive-cancel').addEventListener('click', () => { received = null; $('receive-sheet').hidden = true; });
  $('receive-add').addEventListener('click', async () => {
    if (!received) return;
    const song = received; received = null; $('receive-sheet').hidden = true;
    // Un morceau du même nom est peut-être la copie modifiée de l'élève : on ne l'écrase pas.
    let res = { songs: [] };
    try { res = await library.list(); } catch (e) { /* liste illisible : on enregistre quand même */ }
    const taken = new Set(res.songs.map((s) => s.title));
    if (taken.has(song.title)) {
      const base = song.title + ' (reçu le ' + new Date().toLocaleDateString('fr-FR') + ')';
      let t = base; let n = 2;
      while (taken.has(t)) t = base + ' ' + n++;
      song.title = t; if (song.imported) song.imported.title = t;
    }
    try {
      const sc = song.imported || C.buildScore(Object.assign({}, defaults, song.cfg));
      const lyr = song.imported ? song.imported.lyricsText : song.cfg.lyrics;
      await library.save(song, C.scoreToText(Object.assign({}, sc, { title: song.title, lyrics: C.lyricsFor(sc, lyr) })));
      toast('Ajouté à tes morceaux : ' + song.title);
    } catch (e) { toast('Enregistrement impossible : ' + errText(e)); }
    openSong(song);
  });
  async function receiveLink(url) {
    const data = C.songLinkData(url);
    if (!data) return false;
    try { showReceived(await C.unpackSong(data)); }
    catch (e) { toast('Morceau illisible : ' + errText(e)); }
    return true;
  }
  function arpegeFile(bytes) {
    if (bytes[0] !== 0x7b) return null; // {
    try { const o = JSON.parse(new TextDecoder().decode(bytes)); return o && o.app === 'arpege' ? C.readSharedSong(o) : null; }
    catch (e) { if (/Arpège|vide/.test(e.message)) throw e; return null; }
  }

  /* ---------- stockage sur PC ---------- */
  let settings = null;
  async function renderStorage() {
    settings = await D.getSettings();
    $('storage').hidden = false;
    $('storage-folder').textContent = settings.folder;
    $('opt-txt').checked = settings.writeTxt;
    $('opt-backups').checked = settings.backups;
    $('opt-sources').checked = settings.keepSources;
  }
  if (D) {
    const guard = (fn) => async () => { try { await fn(); } catch (e) { toast(errText(e)); } };
    $('folder-change').addEventListener('click', guard(async () => { await D.chooseFolder(); await renderSongs(); }));
    $('folder-open').addEventListener('click', guard(() => D.openFolder()));
    [['opt-txt', 'writeTxt'], ['opt-backups', 'backups'], ['opt-sources', 'keepSources']].forEach(([id, key]) => {
      $(id).addEventListener('change', guard(async () => { settings = await D.setSettings({ [key]: $(id).checked }); }));
    });
    $('zip-export').addEventListener('click', guard(async () => {
      const r = await D.exportZip();
      if (r) toast(r.count + ' morceau(x) exporté(s) : ' + r.path);
    }));
    $('zip-import').addEventListener('click', guard(async () => {
      const r = await D.importZip();
      if (r) { toast(r.imported + ' morceau(x) importé(s)' + (r.skipped ? ', ' + r.skipped + ' ignoré(s)' : '')); renderSongs(); }
    }));
  }

  /* ---------- import ---------- */
  const status = (t, cls) => setMsg($('import-status'), t, cls);
  function progress(v) { const p = $('import-progress'); p.hidden = v === null; if (v !== null) p.firstElementChild.style.width = Math.round(v * 100) + '%'; }
  function resetImport() {
    importTitle = '';
    $('found-links').innerHTML = ''; $('import-result').hidden = true; $('import-preview').hidden = true; progress(null); status('');
  }
  function renderRecent() {
    const ul = $('recent'); ul.innerHTML = '';
    store.get('recent', []).slice(0, 5).forEach((u) => {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.textContent = u;
      b.addEventListener('click', () => { $('url').value = u; loadUrl(u); });
      li.appendChild(b); ul.appendChild(li);
    });
  }
  function remember(u) { store.set('recent', [u].concat(store.get('recent', []).filter((x) => x !== u)).slice(0, 5)); renderRecent(); }

  async function handleBytes(bytes, contentType, name, baseUrl) {
    const kind = I.sniff(bytes, contentType, name);
    if (D && kind !== 'html') {
      try { await D.saveSource(decodeURIComponent(String(name || 'import').split('/').pop()), bytes); }
      catch (e) { toast('Copie du fichier source impossible : ' + errText(e)); }
    }
    if (window.UkuGp.kindOf(bytes)) { await openGuitarPro(bytes); status(''); return; }
    const shared = arpegeFile(bytes);
    if (shared) { status(''); showReceived(shared); return; }
    if (kind === 'pdf') { await openPdf(bytes); return; }
    if (kind === 'html') {
      const { links, text } = I.parseHtml(bytes, baseUrl);
      if (links.length) {
        status(links.length + ' fichier' + (links.length > 1 ? 's' : '') + ' trouvé' + (links.length > 1 ? 's' : '') + ' sur cette page. Choisis-en un :');
        const ul = $('found-links'); ul.innerHTML = '';
        links.slice(0, 100).forEach((l) => {
          const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.textContent = l.label;
          b.addEventListener('click', () => { $('url').value = l.href; loadUrl(l.href); });
          li.appendChild(b); ul.appendChild(li);
        });
      }
      const usable = text && C.detectContent(text, state.meter).type !== 'unknown';
      if (usable || (text && !links.length)) showText(text, !links.length);
      else if (!links.length) status('Cette page ne contient ni texte ni fichier exploitable.', 'warn');
      return;
    }
    if (kind === 'image') {
      const blob = new Blob([bytes]);
      const img = $('import-preview');
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.dataset.url = URL.createObjectURL(blob); img.src = img.dataset.url; img.hidden = false;
      status('Lecture de l\'image…'); progress(0);
      const res = await I.ocr(blob, progress);
      progress(null);
      if (res.staffOnly && !res.text.trim()) {
        status('Partition sur portée sans noms d\'accords : je ne sais pas encore lire les notes dessinées. Essaie un export MusicXML du morceau, ou une tablature.', 'warn');
        return;
      }
      showText(res.text, true, true);
      if (res.staffOnly) status('Accords lus au-dessus de la portée. Vérifie-les sur l\'image : les mesures ne sont pas contrôlées.', 'warn');
      if (res.unread) status(res.unread + ' signe(s) illisible(s) ignoré(s) : compare bien avec l\'image.', 'warn');
      return;
    }
    showText(I.decodeText(bytes), true);
  }

  /* PDF : une feuille de chant par page (recueil) ou un seul morceau. */
  let importTitle = '';
  async function openPdf(bytes) {
    status('Lecture du PDF…'); progress(0);
    let pages;
    try { pages = await I.readPdf(bytes, progress); } finally { progress(null); }
    const songs = pages.map((pg) => Object.assign({ song: C.parseSongSheet(pg.text, { strings: N(), tuning: state.tuning }) }, pg)).filter((x) => x.song.pairs >= 2 && x.song.bars >= 4);
    const pick = (x) => { importTitle = x.title || x.song.title; showText(x.text, false); };
    if (!songs.length) {
      const all = pages.map((pg) => pg.text).join('\n\n').trim();
      importTitle = '';
      if (all) { showText(all, true); status('Aucune chanson avec accords au-dessus des paroles reconnue dans ce PDF. Voici son texte, à corriger au besoin.', 'warn'); }
      else status('Ce PDF ne contient pas de texte : c\'est une image numérisée. Fais-en une capture d\'écran et importe l\'image.', 'warn');
      return;
    }
    if (songs.length === 1) { status(''); pick(songs[0]); return; }
    status(songs.length + ' morceaux trouvés dans ce PDF. Choisis-en un :');
    const ul = $('found-links'); ul.innerHTML = '';
    songs.forEach((x) => {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
      b.textContent = (x.title || x.song.title || 'Page ' + x.page) + ' · ' + x.song.bars + ' mesures · page ' + x.page;
      b.addEventListener('click', () => pick(x));
      li.appendChild(b); ul.appendChild(li);
    });
  }

  let textFromImage = false;
  function showText(text, clearStatus, fromImage) {
    textFromImage = !!fromImage;
    if (clearStatus) status(fromImage ? 'Image lue. Corrige le texte si besoin : l\'OCR peut se tromper.' : '');
    $('import-text').value = text.trim();
    $('import-result').hidden = false;
    detect();
    if (!$('chord-panel').hidden) $('chord-panel').scrollIntoView({ block: 'nearest' });
  }

  let lastDetect = null;
  function showChordPanel(text, note, warn) {
    $('chord-panel').hidden = false;
    $('found-chords').value = text;
    const n = $('chord-note'); n.textContent = note; n.classList.toggle('warn', !!warn);
  }
  function detect() {
    const text = $('import-text').value;
    lastDetect = C.detectContent(text, state.meter, N());
    const found = C.findChords(text, { meter: state.meter, tuning: state.tuning });
    const el = $('import-detect'); const btn = $('transform');
    $('chord-panel').hidden = true;
    btn.hidden = lastDetect.type !== 'tab'; $('tab-add').hidden = lastDetect.type !== 'tab';
    const isSong = lastDetect.type === 'song';
    $('use-song').hidden = !isSong; $('song-note').hidden = !isSong;
    if (isSong) {
      const sg = lastDetect.song;
      setMsg(el, 'Chanson avec paroles : ' + sg.bars + ' mesures' + (sg.sections.length > 1 ? ' en ' + sg.sections.length + ' parties' : '') + (sg.tempo ? ', ' + sg.tempo + ' à la noire' : '') + '.');
      $('song-note').textContent = 'Chaque accord est compté pour une mesure : à vérifier à l\'écoute, puis à ajuster dans l\'onglet Grille.'
        + (sg.pattern ? ' Rythme repris de la feuille : ' + sg.pattern + '.' : '')
        + (sg.ignored.length ? ' Laissé de côté : ' + sg.ignored.slice(0, 12).join(' ') + '.' : '');
      return;
    }
    if (lastDetect.type === 'tab') setMsg(el, 'Tablature ' + (C.stringCount(lastDetect.score.tuning) === 6 ? 'guitare' : 'ukulélé') + ' détectée : ' + lastDetect.count + ' mesure' + (lastDetect.count > 1 ? 's' : '') + '.');
    else if (lastDetect.type === 'chords') setMsg(el, 'Grille d\'accords trouvée : ' + lastDetect.count + ' accord' + (lastDetect.count > 1 ? 's' : '') + '.');
    else {
      setMsg(el, lastDetect.type === 'unsupported-tab'
        ? 'Tablature à ' + lastDetect.strings + ' cordes détectée : seules les tablatures à 4 cordes (ukulélé) et à 6 cordes (guitare) sont converties.'
        : 'Ni accords ni tablature reconnus. Corrige le texte ci-dessus.', 'warn');
    }
    if (found.source === 'written') showChordPanel(found.chordsText, textFromImage ? 'Noms d\'accords lus sur l\'image : compare-les avec elle, un nom peut manquer ou être mal lu.' : 'Noms d\'accords lus dans le fichier.');
    else if (found.source === 'tab' || found.source === 'score') {
      const origin = found.source === 'tab' ? 'de la tablature' : 'de la partition';
      const doubts = found.uncertain.length ? ' À vérifier en priorité : ' + found.uncertain.join(', ') + '.' : '';
      if (found.melodyOnly) showChordPanel(found.chordsText, 'Simple proposition : ce passage ressemble à une mélodie seule, qui ne donne pas l\'harmonie avec certitude.' + doubts, true);
      else showChordPanel(found.chordsText, 'Accords déduits des notes ' + origin + ', à écouter et à vérifier. Tonalité probable : ' + found.key + '.' + doubts);
    }
  }
  $('import-text').addEventListener('input', detect);
  $('transform').addEventListener('click', () => {
    detect();
    if (lastDetect.type === 'tab') {
      importedScore = lastDetect.score; score = importedScore;
      state.lyrics = ''; saveDraft();
      goto('score');
    }
  });
  $('tab-to-grid').addEventListener('click', () => {
    detect();
    if (lastDetect.type !== 'tab') return;
    const n = C.stringCount(lastDetect.score.tuning);
    if (n !== N()) { toast('Cette tablature a ' + n + ' lignes : choisis d\'abord ' + (n === 6 ? 'la guitare' : 'le ukulélé')); return; }
    const lines = C.findTabBlocks($('import-text').value).filter((b) => b.length === n).map((b) => b.join('\n')).join('\n\n');
    const name = $('tab-part').value || 'Intro';
    const rest = state.chords.trim();
    // Une intro se place en tête ; les autres parties à la suite.
    state.chords = name === 'Intro' ? '[' + name + ']\n' + lines + (rest ? '\n\n' + rest : '') : (rest ? rest + '\n\n' : '') + '[' + name + ']\n' + lines;
    $('chords').value = state.chords; checkChords(); drawGridView(); saveDraft();
    goto('grid'); toast('Tablature ajoutée à la grille, partie « ' + name + ' »');
  });
  $('use-song').addEventListener('click', () => {
    detect();
    if (lastDetect.type !== 'song') return;
    const sg = lastDetect.song;
    state.title = (importTitle || sg.title || state.title || '').slice(0, 80); $('title').value = state.title;
    state.chords = sg.chordsText; state.lyrics = sg.lyricsText; state.overrides = {}; state.grid.models = {}; state.transpose = 0;
    if (sg.tempo) state.tempo = sg.tempo;
    if (sg.pattern) { state.patternKind = 'strum'; state.pattern = sg.pattern; state.subdivision = '8'; }
    syncForm(); generate();
  });
  $('use-chords').addEventListener('click', () => {
    const chords = $('found-chords').value.trim();
    if (!chords) return;
    if (lastDetect && lastDetect.title) { state.title = lastDetect.title; $('title').value = lastDetect.title; }
    state.chords = chords; state.overrides = {};
    syncForm(); saveDraft(); generate();
  });

  async function loadUrl(raw) {
    resetImport();
    const input = (raw || '').trim();
    if (C.songLinkData(input)) { await receiveLink(input); return; }
    if (!input) { status('Colle d\'abord une adresse.', 'warn'); return; }
    const url = C.directLink(/^[a-z]+:\/\//i.test(input) ? input : 'https://' + input);
    $('fetch').disabled = true; status('Connexion…');
    try {
      const r = await I.fetchRemote(url);
      status('');
      remember(input);
      await handleBytes(r.bytes, r.contentType, new URL(r.finalUrl).pathname, r.finalUrl);
    } catch (e) {
      progress(null);
      status('Lecture impossible : ' + (e.message || e) + '. Vérifie le lien et ta connexion.', 'err');
    } finally { $('fetch').disabled = false; }
  }
  $('fetch').addEventListener('click', () => loadUrl($('url').value));
  $('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadUrl($('url').value); } });
  $('file').addEventListener('change', async () => {
    const f = $('file').files[0];
    $('file').value = '';
    if (!f) return;
    resetImport();
    if (f.size > I.MAX_BYTES) { status('Fichier trop volumineux (15 Mo maximum).', 'err'); return; }
    try { await handleBytes(new Uint8Array(await f.arrayBuffer()), f.type, f.name, location.href); }
    catch (e) { progress(null); status('Lecture impossible : ' + (e.message || e), 'err'); }
  });

  fillSelects(); fillGridSelects();
  // Lien direct vers un instrument : …?instrument=guitare ou …?instrument=ukulele
  const asked = { guitare: 'guitar', guitar: 'guitar', ukulele: 'ukulele', 'ukulélé': 'ukulele' }[(new URLSearchParams(location.search).get('instrument') || '').toLowerCase()];
  syncForm();
  if (asked) setInstrument(asked);
  renderRecent(); goto('grid');
  // Au démarrage, on demande l'instrument, sauf si un lien l'a déjà dit ou apporte un morceau.
  if (prefs.askInstrument && !asked && !C.songLinkData(location.hash)) openStart();
  // Lien de morceau ouvert dans la version web : on propose de l'ajouter, puis on nettoie l'adresse.
  if (C.songLinkData(location.hash)) {
    const link = location.href;
    history.replaceState(null, '', location.pathname + location.search);
    receiveLink(link);
  }
  window.__arpegeReady = true; // Sans ce signal, une mise à jour qui plante au démarrage est annulée au lancement suivant.
})();
