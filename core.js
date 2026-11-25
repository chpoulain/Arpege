/* Moteur musical : accords, doigtés, motifs d'arpège, analyse de fichiers. Sans dépendance DOM. */
(function (global) {
  'use strict';

  /* L'accordage dit l'instrument : 4 cordes pour le ukulélé, 6 pour la guitare.
     ref : cordes à vide de l'accordage de référence sur lequel les formes sont calculées ; offset : écart de l'accordage avec lui.
     staff : la guitare s'écrit une octave au-dessus de ce qu'elle sonne. */
  const UKE_REF = [7, 0, 4, 9];
  const GUITAR_REF = [4, 9, 2, 7, 11, 4];
  const TUNINGS = {
    standard: { label: 'Standard G C E A', midi: [67, 60, 64, 69], names: ['G', 'C', 'E', 'A'], offset: 0 },
    lowg: { label: 'Sol grave g C E A', midi: [55, 60, 64, 69], names: ['G', 'C', 'E', 'A'], offset: 0 },
    d: { label: 'En ré A D F# B', midi: [69, 62, 66, 71], names: ['A', 'D', 'F#', 'B'], offset: 2 },
    baritone: { label: 'Baryton D G B E', midi: [50, 55, 59, 64], names: ['D', 'G', 'B', 'E'], offset: 7 },
    guitar: { label: 'Standard E A D G B E', midi: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'], offset: 0 },
    dropd: { label: 'Drop D : D A D G B E', midi: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'], offset: 0, ref: [2, 9, 2, 7, 11, 4], family: 'dropd' },
  };
  // Capodastre : comme dans les recueils, les accords gardent le nom de leur forme et les cases se comptent à partir du capo ;
  // seul le son monte. Pour garder la tonalité d'origine, on transpose d'autant vers le bas.
  for (let k = 1; k <= 7; k++) {
    TUNINGS['capo' + k] = { label: 'Capo ' + k + (k === 1 ? ' (1re case)' : ' (' + k + 'e case)'), midi: TUNINGS.guitar.midi.map((m) => m + k), names: TUNINGS.guitar.names, offset: 0, capo: k };
  }
  Object.keys(TUNINGS).forEach((k) => {
    const t = TUNINGS[k]; const six = t.midi.length === 6;
    t.instrument = six ? 'guitar' : 'ukulele';
    t.ref = t.ref || (six ? GUITAR_REF : UKE_REF);
    t.family = t.family || t.instrument;
    t.staff = six ? 12 : 0;
  });
  const INSTRUMENTS = { ukulele: { label: 'Ukulélé', tuning: 'standard' }, guitar: { label: 'Guitare', tuning: 'guitar' } };
  const tuningOf = (key) => TUNINGS[Object.prototype.hasOwnProperty.call(TUNINGS, key) ? key : 'standard'];
  const stringCount = (key) => tuningOf(key).midi.length;
  const fretText = (f) => (f < 0 ? 'x' : String(f));
  const METERS = { '4/4': { units: 16, beats: 4, value: 4 }, '3/4': { units: 12, beats: 3, value: 4 }, '2/4': { units: 8, beats: 2, value: 4 }, '6/8': { units: 12, beats: 6, value: 8 } };

  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const FR = { Do: 'C', 'Ré': 'D', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  const QUALITY = {
    '': { iv: [0, 4, 7], req: [0, 4] }, m: { iv: [0, 3, 7], req: [0, 3] },
    7: { iv: [0, 4, 7, 10], req: [0, 4, 10] }, maj7: { iv: [0, 4, 7, 11], req: [0, 4, 11] },
    m7: { iv: [0, 3, 7, 10], req: [0, 3, 10] }, 6: { iv: [0, 4, 7, 9], req: [4, 9] }, m6: { iv: [0, 3, 7, 9], req: [3, 9] },
    9: { iv: [0, 4, 7, 10, 2], req: [4, 10, 2] }, m9: { iv: [0, 3, 7, 10, 2], req: [3, 10, 2] }, add9: { iv: [0, 4, 7, 2], req: [4, 2, 0] },
    sus2: { iv: [0, 2, 7], req: [0, 2] }, sus4: { iv: [0, 5, 7], req: [0, 5] }, '7sus4': { iv: [0, 5, 7, 10], req: [0, 5, 10] },
    dim: { iv: [0, 3, 6], req: [0, 3, 6] }, dim7: { iv: [0, 3, 6, 9], req: [0, 3, 6, 9] }, aug: { iv: [0, 4, 8], req: [0, 4, 8] },
    m7b5: { iv: [0, 3, 6, 10], req: [0, 3, 6, 10] }, 5: { iv: [0, 7], req: [0, 7] },
  };
  const QUALITY_ALIAS = {
    '': '', M: '', maj: '', m: 'm', min: 'm', mi: 'm', '-': 'm', 7: '7', dom7: '7', maj7: 'maj7', M7: 'maj7', Maj7: 'maj7', '7M': 'maj7', '△': 'maj7', '△7': 'maj7',
    m7: 'm7', min7: 'm7', '-7': 'm7', 6: '6', m6: 'm6', min6: 'm6', 9: '9', m9: 'm9', min9: 'm9', add9: 'add9', add2: 'add9',
    sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '7sus4': '7sus4', '7sus': '7sus4', dim: 'dim', '°': 'dim', dim7: 'dim7', '°7': 'dim7', aug: 'aug', '+': 'aug',
    m7b5: 'm7b5', 'm7(b5)': 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', 5: '5',
  };

  // Formes usuelles (G C E A) : privilégiées en mode « facile ».
  const COMMON = {
    C: '0003', C7: '0001', Cmaj7: '0002', Cm: '0333', Cm7: '3333', C6: '0000', Csus4: '0013', Csus2: '0233',
    'C#': '1114', 'C#m': '1104', 'C#7': '1112', D: '2220', Dm: '2210', D7: '2223', Dm7: '2213', Dmaj7: '2224', Dsus4: '0230', Dsus2: '2200',
    'D#': '0331', 'D#m': '3321', 'D#7': '3334', E: '4442', Em: '0432', E7: '1202', Em7: '0202', Emaj7: '1302',
    F: '2010', Fm: '1013', F7: '2313', Fmaj7: '2413', Fm7: '1313', 'F#': '3121', 'F#m': '2120', 'F#7': '3424', 'F#m7': '2424',
    G: '0232', Gm: '0231', G7: '0212', Gm7: '0211', Gmaj7: '0222', Gsus4: '0233', G6: '0202',
    'G#': '5343', 'G#m': '4342', 'G#7': '1323', A: '2100', Am: '2000', A7: '0100', Am7: '0000', Amaj7: '1100', Asus4: '2200', A6: '2424',
    'A#': '3211', 'A#m': '3111', 'A#7': '1211', 'A#maj7': '3210', B: '4322', Bm: '4222', B7: '2322', Bm7: '2222',
  };

  // Formes usuelles de guitare (E A D G B E), de la corde grave à l'aiguë ; x = corde non jouée.
  const COMMON_GUITAR = {
    C: 'x32010', C7: 'x32310', Cmaj7: 'x32000', Cm: 'x35543', Cm7: 'x35343', C6: 'x32210', Csus4: 'x33011', Csus2: 'x30033', Cadd9: 'x32030',
    'C#': 'x46664', 'C#m': 'x46654', 'C#7': 'x46464', 'C#m7': 'x46454',
    D: 'xx0232', Dm: 'xx0231', D7: 'xx0212', Dm7: 'xx0211', Dmaj7: 'xx0222', Dsus4: 'xx0233', Dsus2: 'xx0230', D6: 'xx0202',
    'D#': 'x68886', 'D#m': 'x68876', 'D#7': 'x68686',
    E: '022100', Em: '022000', E7: '020100', Em7: '022030', Emaj7: '021100', Esus4: '022200', E6: '022120',
    F: '133211', Fm: '133111', F7: '131211', Fmaj7: 'xx3210', Fm7: '131111',
    'F#': '244322', 'F#m': '244222', 'F#7': '242322', 'F#m7': '242222',
    G: '320003', Gm: '355333', G7: '320001', Gm7: '353333', Gmaj7: '320002', Gsus4: '330013', G6: '320000',
    'G#': '466544', 'G#m': '466444', 'G#7': '464544',
    A: 'x02220', Am: 'x02210', A7: 'x02020', Am7: 'x02010', Amaj7: 'x02120', Asus4: 'x02230', Asus2: 'x02200', A6: 'x02222',
    'A#': 'x13331', 'A#m': 'x13321', 'A#7': 'x13131', 'A#maj7': 'x13231',
    B: 'x24442', Bm: 'x24432', B7: 'x21202', Bm7: 'x24232', Bdim: 'x2343x',
    E5: '022xxx', F5: '133xxx', 'F#5': '244xxx', G5: '355xxx', 'G#5': '466xxx', A5: 'x022xx', 'A#5': 'x133xx', B5: 'x244xx', C5: 'x355xx', 'C#5': 'x466xx', D5: 'xx023x', 'D#5': 'xx134x',
  };

  const CHORD_RES = [/^(Do|Ré|Re|Mi|Fa|Sol|La|Si)(#|♯|b|♭)?(.*)$/, /^([A-G])(#|♯|b|♭)?(.*)$/];

  /* « C@0007 » : l'accord de Do joué à cette position précise (une lettre ou un chiffre par corde, de la grave à l'aiguë, x = non jouée).
     Deux positions d'un même accord peuvent ainsi se suivre dans une grille. */
  function parseChord(token) {
    if (!token) return null;
    const at = token.indexOf('@');
    if (at > 0) {
      const base = parseChord(token.slice(0, at)); const pin = token.slice(at + 1).trim().toLowerCase();
      return base && /^[0-9a-wx]{4,6}$/.test(pin) ? Object.assign(base, { pin }) : null;
    }
    const t = token.trim();
    const bassSplit = t.split('/');
    let bass = null;
    if (bassSplit.length === 2) {
      if (!/^(Do|Ré|Re|Mi|Fa|Sol|La|Si|[A-G])(#|♯|b|♭)?$/.test(bassSplit[1])) return null;
      bass = bassSplit[1];
    } else if (bassSplit.length > 2) return null;
    // « Faug » = F + aug et non Fa + ug : on essaie le solfège puis les lettres.
    const has = (x) => Object.prototype.hasOwnProperty.call(QUALITY_ALIAS, x);
    const m = CHORD_RES.map((re) => re.exec(bassSplit[0])).find((x) => x && has(x[3]));
    if (!m) return null;
    const q = m[3];
    const letter = FR[m[1]] || m[1];
    const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2] || '';
    const quality = QUALITY_ALIAS[q];
    const root = (PC[letter] + (acc === '#' ? 1 : acc === 'b' ? 11 : 0)) % 12;
    return { label: t, root, quality, flat: acc === 'b', bass };
  }

  function transposeChord(ch, n) {
    if (!n) return ch;
    const root = (ch.root + n + 120) % 12;
    const names = ch.flat || n < 0 ? FLAT : SHARP;
    const body = ch.quality;
    let bass = '';
    if (ch.bass) {
      const b = parseChord(ch.bass);
      bass = '/' + names[(b.root + n + 120) % 12];
    }
    return { label: names[root] + body + bass, root, quality: ch.quality, flat: names === FLAT, bass: bass ? bass.slice(1) : null };
  }

  /* « Am F | C G » → mesures ; sans barre, un accord par mesure. « x2 » répète la ligne. */
  function parseChordText(text) {
    const bars = [];
    const unknown = [];
    for (let raw of String(text || '').split(/\r?\n/)) {
      let line = raw.trim();
      if (!line) continue;
      let times = 1;
      const rep = /[\s)]\(?[x×*]\s*(\d{1,2})\)?\s*$/i.exec(' ' + line);
      if (rep) { times = Math.min(+rep[1], 32); line = (' ' + line).slice(0, rep.index + 1).trim(); }
      line = line.replace(/[()]/g, ' ').replace(/[,;]/g, ' ');
      const hasBars = line.includes('|');
      const groups = hasBars ? line.split('|') : line.split(/\s+/);
      const lineBars = [];
      for (const g of groups) {
        const chords = [];
        for (const tok of g.trim().split(/\s+/).filter(Boolean)) {
          // « - » prolonge l'accord précédent : « Am - F C » = Am une demi-mesure, puis F et C un quart chacun.
          if (tok === '-' || tok === '/' || tok === '%') { if (chords.length) chords.push(Object.assign({}, chords[chords.length - 1], { held: true })); continue; }
          const c = parseChord(tok);
          if (c) chords.push(c); else unknown.push(tok);
        }
        if (chords.length) lineBars.push(chords);
      }
      for (let i = 0; i < times; i++) lineBars.forEach((b) => bars.push(b));
    }
    return { bars, unknown };
  }

  /* ---------- Doigtés ---------- */
  const voicingCache = new Map();

  /* Ukulélé : les 4 cordes sonnent toujours. Guitare : les cordes graves peuvent rester muettes (-1),
     et la note la plus grave est de préférence la fondamentale (ou la basse demandée, « C/G »). */
  function voicingsFor(chord, tuningKey) {
    const tuning = tuningOf(tuningKey);
    const ref = tuning.ref; const n = ref.length; const guitar = n > 4;
    const refRoot = (chord.root - tuning.offset + 120) % 12;
    const bassChord = guitar && chord.bass ? parseChord(chord.bass) : null;
    const wantLow = bassChord ? (bassChord.root - tuning.offset + 120) % 12 : refRoot;
    const cacheKey = tuning.family + ':' + refRoot + ':' + chord.quality + (bassChord ? '/' + wantLow : '');
    if (voicingCache.has(cacheKey)) return voicingCache.get(cacheKey);
    const q = QUALITY[chord.quality];
    const allowed = new Set(q.iv.map((i) => (refRoot + i) % 12));
    if (bassChord) allowed.add(wantLow);
    const need = q.req.map((i) => (refRoot + i) % 12);
    const common = bassChord ? null : (guitar ? COMMON_GUITAR : COMMON)[SHARP[refRoot] + chord.quality];
    const minSounding = guitar ? Math.min(4, Math.max(3, q.iv.length + 1)) : n;
    const maxTop = guitar ? (q.iv.length === 2 ? 3 : 1) : 0; // cordes aiguës muettes : une au plus, trois pour un accord de puissance
    const out = [];
    // Recherche normale, puis élargie (grand écart ou manche haut) pour les rares accords sans forme compacte.
    for (const [maxFret, maxSpan] of [[12, 3], [12, 4], [15, 3], [15, 4]]) {
      if (out.length) break;
      const candidates = ref.map((open) => {
        const fr = [];
        for (let f = 0; f <= maxFret; f++) if (allowed.has((open + f) % 12)) fr.push(f);
        return fr;
      });
      const fr = new Array(n);
      const keep = () => {
        const sounding = []; fr.forEach((x, i) => { if (x >= 0) sounding.push(i); });
        if (sounding.length < minSounding) return;
        const fretted = fr.filter((x) => x > 0);
        const min = fretted.length ? Math.min(...fretted) : 0;
        const max = fretted.length ? Math.max(...fretted) : 0;
        const pcs = new Set(sounding.map((i) => (ref[i] + fr[i]) % 12));
        if (!need.every((p) => pcs.has(p))) return;
        const missing = q.iv.filter((i) => !pcs.has((refRoot + i) % 12)).length;
        const atMin = fr.reduce((acc, x, i) => (x === min && min > 0 ? acc.concat(i) : acc), []);
        let barre = false;
        if (atMin.length >= 2) {
          barre = true;
          for (let i = atMin[0]; i <= atMin[atMin.length - 1]; i++) if (fr[i] === 0) barre = false;
        }
        const fingers = fretted.length - (barre ? atMin.length - 1 : 0);
        if (fingers > 4) return;
        let cost = (maxSpan > 3 || maxFret > 12 ? 4 : 0) + fingers * 0.8 + (max - min) * 0.7 + min * 0.55 + missing * 1.5 + (barre ? 0.6 : 0);
        if (guitar) {
          const top = n - 1 - sounding[sounding.length - 1];
          const low = (ref[sounding[0]] + fr[sounding[0]]) % 12;
          cost += sounding[0] * 0.45 + top * (q.iv.length === 2 ? 0 : 0.9) + (low === wantLow ? 0 : 4);
          // Cordes à vide au milieu d'une position haute : difficile à faire sonner proprement.
          if (min > 4 && sounding.some((i) => fr[i] === 0 && i > sounding[0])) cost += 1.5;
        }
        const shape = fr.map(fretText).join('');
        if (common === shape && max < 10) cost -= 5;
        out.push({ frets: fr.slice(), cost, shape: fr.map((x) => (x < 0 ? 'x' : x.toString(36))).join('') });
      };
      // Parcours corde par corde ; l'écart entre cases est vérifié dès que possible.
      const walk = (i, lo, hi, mutedSoFar) => {
        if (i === n) { keep(); return; }
        if (guitar && mutedSoFar === i && i < 2) { fr[i] = -1; walk(i + 1, lo, hi, mutedSoFar + 1); }
        if (i > mutedSoFar && i >= n - maxTop) { for (let k = i; k < n; k++) fr[k] = -1; keep(); }
        for (const f of candidates[i]) {
          const nlo = f > 0 ? Math.min(lo, f) : lo; const nhi = f > 0 ? Math.max(hi, f) : hi;
          if (nhi - nlo > maxSpan && nlo !== Infinity) continue;
          fr[i] = f; walk(i + 1, nlo, nhi, mutedSoFar);
        }
      };
      walk(0, Infinity, 0, 0);
    }
    out.sort((x, y) => x.cost - y.cost);
    voicingCache.set(cacheKey, out);
    return out;
  }

  function moveCost(a, b) {
    let m = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] <= 0 || b[i] <= 0) m += 0.4; else m += Math.abs(a[i] - b[i]);
    }
    return m;
  }
  function position(fr) {
    const f = fr.filter((x) => x > 0);
    return f.length ? Math.min(...f) : 0;
  }

  /* Choix global par programmation dynamique : minimise difficulté + déplacements sur toute la grille. */
  function chooseVoicings(chords, opts) {
    const mode = opts.mode || 'easy';
    const W = { easy: { c: 1, m: 0.12, p: 0 }, smooth: { c: 0.3, m: 1, p: 0 }, position: { c: 0.3, m: 0.15, p: 2 } }[mode];
    const target = opts.position || 0;
    const layers = chords.map((ch) => {
      // La position écrite dans la grille (C@0007) passe avant le doigté choisi pour tous les C.
      const pinned = (ch.pin && ch.pin.length === stringCount(opts.tuning) ? ch.pin : null) || (opts.overrides && opts.overrides[ch.label]);
      const all = voicingsFor(ch, opts.tuning);
      if (pinned) {
        const v = all.find((x) => x.shape === pinned);
        if (v) return [v];
        // Position créée à la main : elle n'est pas dans la liste calculée, on la prend telle quelle.
        const n = stringCount(opts.tuning);
        if (pinned.length === n && /^[0-9a-wx]+$/.test(pinned)) {
          const frets = pinned.split('').map((c) => (c === 'x' ? -1 : parseInt(c, 36)));
          if (frets.some((f) => f >= 0)) return [{ frets, cost: 0, shape: pinned }];
        }
      }
      let list;
      if (mode === 'position') {
        list = all.slice().sort((a, b) => a.cost * W.c + Math.abs(position(a.frets) - target) * W.p - (b.cost * W.c + Math.abs(position(b.frets) - target) * W.p)).slice(0, 30);
      } else list = all.slice(0, 30);
      return list;
    });
    if (layers.some((l) => !l.length)) throw new Error('Aucun doigté possible pour ' + chords[layers.findIndex((l) => !l.length)].label);
    const local = (v) => v.cost * W.c + Math.abs(position(v.frets) - target) * W.p;
    let prev = layers[0] ? layers[0].map((v) => ({ v, total: local(v), from: null })) : [];
    const table = [prev];
    for (let i = 1; i < layers.length; i++) {
      const cur = layers[i].map((v) => {
        let best = null; let bestT = Infinity;
        for (const p of prev) {
          const t = p.total + moveCost(p.v.frets, v.frets) * W.m;
          if (t < bestT) { bestT = t; best = p; }
        }
        return { v, total: bestT + local(v), from: best };
      });
      table.push(cur); prev = cur;
    }
    if (!prev.length) return [];
    let node = prev.reduce((a, b) => (b.total < a.total ? b : a));
    const res = [];
    while (node) { res.unshift(node.v); node = node.from; }
    return res;
  }

  /* ---------- Motifs ---------- */
  /* Un pas de rythmique : b/d ↓ bas, h/u ↑ haut, majuscule ou ! fort, . doux, (b) à vide, b2 sur 2 cordes,
     x étouffé (xh vers le haut), p pouce, t frappe sur le bois, 2+1 cordes pincées, - silence. */
  const STROKE_DIR = { b: 'down', d: 'down', '↓': 'down', h: 'up', u: 'up', '↑': 'up' };
  function parseStrumToken(tok, strings) {
    const all = strings || 4;
    if (/^[-_]$/.test(tok)) return { type: 'rest' };
    if (/^[pP]$/.test(tok)) return { type: 'thumb' };
    if (/^[tT]$/.test(tok)) return { type: 'tap' };
    if (/^[1-6](\+[1-6])*$/.test(tok) && tok.split('+').every((x) => +x <= all)) return { type: 'pick', strings: [...new Set(tok.split('+').map(Number))] };
    const chunk = /^[xX]([bdhu↓↑])?$/i.exec(tok);
    if (chunk) return { type: 'chunk', dir: chunk[1] ? STROKE_DIR[chunk[1].toLowerCase()] : 'down' };
    const ghost = /^\((.+)\)$/.exec(tok);
    const m = /^([bdhuBDHU↓↑])([1-6])?([.!])?$/.exec(ghost ? ghost[1] : tok);
    if (!m) return null;
    const upper = m[1] !== m[1].toLowerCase();
    const level = ghost ? 'ghost' : m[3] === '.' ? 'soft' : (m[3] === '!' || upper) ? 'strong' : 'normal';
    return { type: 'stroke', dir: STROKE_DIR[m[1].toLowerCase()], level, count: m[2] ? Math.min(+m[2], all) : all };
  }
  function strumToText(s, strings) {
    const all = strings || 4;
    if (s.type === 'thumb') return 'p';
    if (s.type === 'tap') return 't';
    if (s.type === 'pick') return s.strings.join('+');
    if (s.type === 'chunk') return s.dir === 'up' ? 'xh' : 'x';
    if (s.type !== 'stroke') return '-';
    const body = (s.dir === 'up' ? 'h' : 'b') + (s.count < all ? s.count : '');
    if (s.level === 'ghost') return '(' + body + ')';
    if (s.level === 'strong') return body[0].toUpperCase() + body.slice(1);
    return body + (s.level === 'soft' ? '.' : '');
  }
  /* Les cordes sont frappées dans l'ordre du geste : un coup court vers le bas ne touche que les cordes du haut du manche. */
  function strumNotes(s, frets) {
    const n = frets.length;
    const note = (i, muted) => (muted ? { string: i, fret: 0, muted: true } : { string: i, fret: frets[i] });
    const sounding = frets.map((f, i) => i).filter((i) => frets[i] >= 0); // guitare : les cordes muettes de l'accord ne sont pas jouées
    const bass = sounding[0];
    const playable = (i) => Math.min(sounding[sounding.length - 1], Math.max(bass, i));
    if (s.type === 'rest') return { notes: [], strum: null };
    if (s.type === 'tap') return { notes: [], strum: s };
    if (s.type === 'thumb') return { notes: [note(bass)], strum: s };
    if (s.type === 'pick') return { notes: [...new Set(s.strings.map((k) => playable(n - k)))].map((i) => note(i)), strum: s };
    if (s.level === 'ghost') return { notes: [], strum: s };
    if (s.type === 'chunk') { const every = frets.map((f, i) => i); return { notes: (s.dir === 'up' ? every.reverse() : every).map((i) => note(i, true)), strum: s }; }
    const order = s.dir === 'up' ? sounding.slice().reverse() : sounding;
    return { notes: order.slice(0, s.count).map((i) => note(i)), strum: s };
  }
  /* Compteur sous les flèches : 1 & 2 & en noires, 1 2 3 4 5 6 en 6/8. */
  function beatLabel(start, meterKey) {
    const meter = METERS[meterKey] || METERS['4/4'];
    if (meter.value === 8) return start % 2 ? '' : String(start / 2 + 1);
    return start % 4 === 0 ? String(start / 4 + 1) : start % 4 === 2 ? '&' : '';
  }

  /* strings : nombre de cordes de l'instrument (4 par défaut). En arpège par cordes, B désigne la basse de l'accord. */
  function parsePattern(text, kind, strings) {
    const all = strings || 4;
    if (kind === 'strum') {
      const errors = [];
      const steps = String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((tok) => {
        const s = parseStrumToken(tok, all);
        if (!s) errors.push(tok);
        return s || { type: 'rest' };
      });
      return { steps, errors };
    }
    const valid = kind === 'degrees' ? { test: (p) => /^(T|3|5|7)$/.test(p) } : { test: (p) => p === 'B' || (/^[1-6]$/.test(p) && +p <= all) };
    const errors = [];
    const steps = String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((tok) => {
      if (/^[-.xX_]$/.test(tok)) return [];
      const parts = tok.toUpperCase().split('+').filter(Boolean);
      const good = [];
      for (const p of parts) { if (valid.test(p)) { if (!good.includes(p)) good.push(p); } else errors.push(tok); }
      return good;
    });
    return { steps, errors };
  }

  function degreeOfString(frets, i, chord, tuning) {
    const refRoot = (chord.root - tuning.offset + 120) % 12;
    return ((tuning.ref[i] + frets[i] - refRoot) % 12 + 12) % 12;
  }

  /* Trouve la corde qui porte le degré voulu dans le doigté retenu (avec repli si la note manque). */
  function stringForDegree(token, frets, chord, tuning) {
    const iv = frets.map((f, i) => (f < 0 ? -1 : degreeOfString(frets, i, chord, tuning)));
    const pitches = frets.map((f, i) => (f < 0 ? Infinity : tuning.midi[i] + f));
    const lookup = {
      T: [0], 3: [3, 4, 2, 5], 5: [7, 6, 8], 7: [10, 11, 9, 2],
    }[token];
    for (const want of lookup) {
      const hits = iv.map((v, i) => (v === want ? i : -1)).filter((i) => i >= 0);
      if (hits.length) return hits.reduce((a, b) => (pitches[b] < pitches[a] ? b : a));
    }
    // Note absente : la corde la plus aiguë pour 7, la plus grave sinon.
    const order = pitches.map((_, i) => i).filter((i) => frets[i] >= 0).sort((a, b) => pitches[a] - pitches[b]);
    return token === '7' ? order[order.length - 1] : order[0];
  }

  /* Version très simple pour la guitare : un accord voisin à deux ou trois doigts remplace l'accord écrit
     (Do devient Do majeur 7, La devient La sus2…). La couleur change un peu, la main gauche beaucoup. */
  const SIMPLE_GUITAR = {
    C: ['C7M', 'x32000'], D: ['Dsus2', 'xx0230'], F: ['F7M', 'xx3210'], G: ['G6', '320000'], A: ['Asus2', 'x02200'], B: ['B7sus4', 'x22200'], 'A#': ['Bb6', 'xx3333'],
    Am: ['Am7', 'x02010'], Dm: ['Dm7', 'xx0211'], Bm: ['Bm7', 'x20202'], 'F#m': ['F#m7', 'xx2222'], Gm: ['Gm7', 'xx3333'], Fm: ['Fm7', 'xx1111'], Cm: ['Cm', 'x3101x'],
    B7: ['B7', 'x2120x'], Em7: ['Em7', '020000'], F7: ['F7', 'xx1211'],
  };
  /* Renvoie l'accord simplifié (avec sa position), ou l'accord lui-même s'il n'a pas de version simple ou si sa position est déjà écrite. */
  function simplifyChord(chord, tuningKey) {
    if (!chord || chord.held || chord.pin || tuningOf(tuningKey).family !== 'guitar') return chord;
    const hit = SIMPLE_GUITAR[SHARP[chord.root] + chord.quality];
    if (!hit) return chord;
    const c = parseChord(hit[0]);
    return Object.assign(c, { pin: hit[1], simplified: chord.label });
  }

  /* cfg.sections, s'il existe, donne à chaque partie ses accords et son motif ; sinon tout le morceau est une seule partie. */
  function buildScore(cfg) {
    const meter = METERS[cfg.meter] || METERS['4/4'];
    const tuningKey = Object.prototype.hasOwnProperty.call(TUNINGS, cfg.tuning) ? cfg.tuning : 'standard';
    const tuning = TUNINGS[tuningKey];
    const N = tuning.midi.length;
    const tabProblems = [];
    const sections = (cfg.sections && cfg.sections.length ? cfg.sections : [cfg]).map((s) => {
      // Partie écrite en tablature (intro, solo) : ses notes sont reprises telles quelles, sans accords ni motif.
      const tab = sectionTab(s.chords, cfg.meter, N);
      if (tab && tab.problem) tabProblems.push((s.name ? '« ' + s.name + ' » : ' : '') + tab.problem);
      if (tab) return { name: s.name || '', tabBars: tab.bars || [], parsed: { bars: [], unknown: [] }, pat: { steps: [0], errors: [] } };
      return { name: s.name || '', kind: s.patternKind, subdivision: s.subdivision, parsed: parseChordText(s.chords), pat: parsePattern(s.pattern, s.patternKind, N) };
    });
    const unknown = sections.flatMap((s) => s.parsed.unknown);
    const patErrors = sections.flatMap((s) => s.pat.errors);
    const problems = tabProblems;
    const some = sections.some((s) => s.parsed.bars.length || (s.tabBars && s.tabBars.length));
    if (unknown.length) problems.push('Accords non reconnus : ' + [...new Set(unknown)].join(', '));
    if (patErrors.length) problems.push('Motif : symboles ignorés (' + [...new Set(patErrors)].join(', ') + ')');
    if (!some) problems.push('Saisis au moins un accord.');
    if (sections.some((s) => !s.pat.steps.length)) problems.push('Le motif est vide.');
    const score = { title: cfg.title || '', meter: cfg.meter in METERS ? cfg.meter : '4/4', tuning: tuningKey, bars: [], voicings: [], problems, source: 'generated' };
    if (!some || sections.some((s) => !s.pat.steps.length)) return score;
    sections.forEach((s) => { s.bars = s.parsed.bars.map((b) => b.map((c) => (c.held ? { held: true } : (cfg.simple ? simplifyChord(transposeChord(c, cfg.transpose || 0), tuningKey) : transposeChord(c, cfg.transpose || 0))))); });
    const flat = sections.flatMap((s) => s.bars.flat().filter((c) => !c.held));
    let voicings;
    try { voicings = chooseVoicings(flat, { mode: cfg.mode, position: cfg.position, tuning: tuningKey, overrides: cfg.overrides }); }
    catch (e) { problems.push(e.message); return score; }
    let idx = 0;
    const seen = new Set();
    for (const sec of sections) {
     if (sec.tabBars) { sec.tabBars.forEach((b, i) => score.bars.push(i === 0 && sec.name ? { events: b.events, section: sec.name, tab: true } : { events: b.events, tab: true })); continue; }
     sec.bars.forEach((chords, barIndex) => {
      const pat = sec.pat;
      const stepUnits = sec.subdivision === '16' ? 1 : 2;
      const stepsPerBar = Math.floor(meter.units / stepUnits);
      const events = [];
      chords.forEach((chord, ci) => {
        if (chord.held) return; // déjà compté dans la durée de l'accord qu'il prolonge
        let span = 1; while (chords[ci + span] && chords[ci + span].held) span++;
        const v = voicings[idx++];
        const id = chord.label + (chord.pin ? '@' + chord.pin : '');
        if (!seen.has(id)) { seen.add(id); score.voicings.push({ chord, frets: v.frets, shape: v.shape }); }
        const startStep = Math.round(ci * stepsPerBar / chords.length);
        const endStep = Math.round((ci + span) * stepsPerBar / chords.length);
        for (let s = startStep; s < endStep; s++) {
          const tok = pat.steps[(s - startStep) % pat.steps.length];
          const label = s === startStep ? chord.label : null;
          if (sec.kind === 'strum') {
            const { notes, strum } = strumNotes(tok, v.frets);
            if (notes.length || label || strum) events.push({ start: s * stepUnits, dur: stepUnits, notes, chord: label, frets: label ? v.frets : null, strum });
            continue;
          }
          // Corde muette dans ce doigté (guitare) ou « B » : c'est la basse de l'accord qui est jouée.
          const bass = v.frets.findIndex((f) => f >= 0);
          const last = v.frets.length - 1 - v.frets.slice().reverse().findIndex((f) => f >= 0);
          const byNumber = (t) => (t === 'B' ? bass : Math.min(last, Math.max(bass, N - +t)));
          const strs = [...new Set(tok.map((t) => (sec.kind === 'degrees' ? stringForDegree(t, v.frets, chord, tuning) : byNumber(t))))];
          if (strs.length || label) {
            events.push({ start: s * stepUnits, dur: stepUnits, notes: strs.map((i) => ({ string: i, fret: v.frets[i] })), chord: label, frets: label ? v.frets : null });
          }
        }
      });
      score.bars.push(barIndex === 0 && sec.name ? { events, section: sec.name } : { events });
     });
    }
    score.preferFlats = flat.some((c) => c.flat);
    return score;
  }

  /* Événement joué à cet instant (en double-croches depuis le début) : ni silence ni blanc entre deux notes. */
  function eventAt(score, unit) {
    const units = METERS[score.meter].units;
    const bar = Math.floor(unit / units);
    const b = score.bars[bar];
    if (!b) return null;
    const pos = unit - bar * units;
    const index = b.events.findIndex((e) => (e.notes.length || (e.strum && e.strum.type !== 'rest')) && pos >= e.start && pos < e.start + e.dur);
    return index < 0 ? null : { bar, index };
  }

  /* Paroles : une ligne par mesure, ou plusieurs mesures séparées par « | ». Les titres [Couplet] et les lignes vides sont ignorés. */
  /* « ^ » dans les paroles d'une mesure marque la syllabe où tombe un accord (feuille de chant) ; la partition ne l'affiche pas.
     marks : garder ces repères. */
  function parseLyrics(text, marks) {
    if (!marks) text = String(text || '').replace(/ ?\^/g, (m) => (m[0] === ' ' ? ' ' : ''));
    const out = [];
    String(text || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line || /^\[[^\]]*\]$/.test(line)) return;
      line.replace(/^\|+|\|+$/g, '').split('|').forEach((s) => { const w = s.trim().replace(/\s+/g, ' '); out.push(w === '_' ? '' : w); });
    });
    return out;
  }

  /* Paroles mesure par mesure, pour cette partition : les mesures d'une partie en tablature (intro, solo) n'en prennent pas. */
  function lyricsFor(score, text) {
    const list = parseLyrics(text); let i = 0;
    return score.bars.map((b) => (b.tab ? '' : list[i++] || ''));
  }
  /* Mise en page imprimée : 4 mesures par ligne en 4/4, jusqu'à 6 pour les mesures courtes. */
  function printBarsPerLine(meter) {
    return Math.min(6, Math.max(4, Math.floor(72 / METERS[meter in METERS ? meter : '4/4'].units)));
  }
  /* Lignes de mesures de longueur fixe ; une partie commence toujours une nouvelle ligne. */
  function fixedLines(score, perLine) {
    const lines = []; let cur = [];
    score.bars.forEach((b, i) => {
      if (cur.length && (b.section || cur.length === perLine)) { lines.push(cur); cur = []; }
      cur.push(i);
    });
    if (cur.length) lines.push(cur);
    return lines;
  }

  /* ---------- Envoi d'un morceau : lien ou fichier .arpege ---------- */
  const SHARE_CFG = ['chords', 'pattern', 'patternKind', 'meter', 'subdivision', 'tuning', 'transpose', 'mode', 'position', 'overrides', 'tempo', 'sections', 'lyrics', 'scoreDiagrams', 'scoreNeck', 'scoreNames', 'scoreSolfege', 'simple'];
  function shareSong(song) {
    const out = { app: 'arpege', v: 1, title: song.title };
    if (song.imported) {
      const s = song.imported;
      out.imported = { meter: s.meter, tuning: s.tuning, bars: s.bars };
      out.lyrics = s.lyricsText || '';
    } else {
      out.cfg = {};
      SHARE_CFG.forEach((k) => { if (song.cfg[k] !== undefined && song.cfg[k] !== null) out.cfg[k] = song.cfg[k]; });
    }
    return out;
  }
  const clip = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const clamp = (v, lo, hi, d) => (v !== null && v !== '' && Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  /* Le morceau reçu vient de l'extérieur : chaque champ est vérifié et borné. */
  const own = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
  function readSharedSong(o) {
    if (!o || typeof o !== 'object' || o.app !== 'arpege') throw new Error('ce n\'est pas un morceau Arpège');
    const title = clip(o.title, 120).replace(/[\u0000-\u001f]/g, ' ').trim() || 'Morceau reçu';
    const kind = (k) => (['strings', 'degrees', 'strum'].includes(k) ? k : 'strings');
    const sub = (v) => (v === '16' ? '16' : '8');
    if (o.cfg && typeof o.cfg === 'object') {
      const c = o.cfg;
      const cfg = {
        chords: clip(c.chords, 20000), pattern: clip(c.pattern, 2000), patternKind: kind(c.patternKind),
        meter: own(METERS, c.meter) ? c.meter : '4/4', subdivision: sub(c.subdivision), tuning: own(TUNINGS, c.tuning) ? c.tuning : 'standard',
        transpose: clamp(c.transpose, -6, 6, 0), mode: ['easy', 'smooth', 'position'].includes(c.mode) ? c.mode : 'easy',
        position: clamp(c.position, 0, 12, 5), tempo: clamp(c.tempo, 40, 180, 80), lyrics: clip(c.lyrics, 20000),
        simple: c.simple === true, scoreDiagrams: c.scoreDiagrams === true, scoreNeck: c.scoreNeck === true, scoreNames: c.scoreNames !== false, scoreSolfege: c.scoreSolfege === true, overrides: {}, sections: null,
      };
      if (c.overrides && typeof c.overrides === 'object') {
        Object.entries(c.overrides).slice(0, 100).forEach(([k, v]) => { if (k.length <= 20 && typeof v === 'string' && /^([0-9a-z]{4}|[0-9a-wx]{6})$/.test(v)) cfg.overrides[k] = v; });
      }
      if (Array.isArray(c.sections) && c.sections.length) {
        cfg.sections = c.sections.slice(0, 40).filter((x) => x && typeof x === 'object')
          .map((x) => ({ name: clip(x.name, 60), chords: clip(x.chords, 5000), pattern: clip(x.pattern, 2000), patternKind: kind(x.patternKind), subdivision: sub(x.subdivision) }));
      }
      return { title, cfg };
    }
    if (o.imported && typeof o.imported === 'object' && Array.isArray(o.imported.bars)) {
      const meter = own(METERS, o.imported.meter) ? o.imported.meter : '4/4';
      const units = METERS[meter].units;
      const tuningKey = own(TUNINGS, o.imported.tuning) ? o.imported.tuning : 'standard';
      const N = stringCount(tuningKey);
      const bars = o.imported.bars.slice(0, 2000).map((b) => {
        const events = (b && Array.isArray(b.events) ? b.events : []).slice(0, 64).filter((e) => e && typeof e === 'object').map((e) => {
          const start = clamp(e.start, 0, units - 1, 0);
          const ev = { start, dur: clamp(e.dur, 1, units - start, 1), notes: [] };
          (Array.isArray(e.notes) ? e.notes : []).slice(0, N).forEach((n) => {
            const str = n && typeof n === 'object' ? clamp(n.string, 0, N - 1, -1) : -1;
            if (str < 0 || ev.notes.some((x) => x.string === str)) return;
            ev.notes.push(n.muted === true ? { string: str, fret: 0, muted: true } : { string: str, fret: clamp(n.fret, 0, 24, 0) });
          });
          if (typeof e.chord === 'string' && e.chord) ev.chord = e.chord.slice(0, 16);
          if (Array.isArray(e.frets) && e.frets.length === N) ev.frets = e.frets.map((f) => clamp(f, N > 4 ? -1 : 0, 24, 0));
          if (e.strum && typeof e.strum === 'object') {
            try { const st = parseStrumToken(strumToText(e.strum, N), N); if (st && st.type !== 'rest') ev.strum = st; } catch (x) { /* geste inconnu : ignoré */ }
          }
          return ev;
        });
        return typeof b.section === 'string' && b.section ? { events, section: b.section.slice(0, 60) } : { events };
      });
      if (!bars.length) throw new Error('morceau vide');
      return { title, imported: { title, meter, tuning: tuningKey, bars, voicings: [], problems: [], source: 'imported', lyricsText: clip(o.lyrics, 20000) } };
    }
    throw new Error('morceau vide');
  }
  const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64url = (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  /* Morceau → texte court pour un lien (JSON compressé). */
  async function packSong(obj) {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    const z = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return b64url(new Uint8Array(z));
  }
  /* Lien → morceau vérifié. La décompression s'arrête à 2 Mo : un lien piégé ne peut pas saturer la mémoire. */
  async function unpackSong(packed) {
    if (typeof packed !== 'string' || !/^[A-Za-z0-9_-]{1,300000}$/.test(packed)) throw new Error('lien de morceau abîmé');
    let bytes;
    try { bytes = unb64url(packed); } catch (e) { throw new Error('lien de morceau abîmé'); }
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2e6) { reader.cancel(); throw new Error('morceau trop gros'); }
        parts.push(value);
      }
    } catch (e) { throw new Error(e.message === 'morceau trop gros' ? e.message : 'lien de morceau abîmé'); }
    const all = new Uint8Array(size); let n = 0; parts.forEach((p) => { all.set(p, n); n += p.length; });
    let obj;
    try { obj = JSON.parse(new TextDecoder().decode(all)); } catch (e) { throw new Error('lien de morceau abîmé'); }
    return readSharedSong(obj);
  }
  /* Lien de morceau dans une adresse : …#morceau=… */
  function songLinkData(url) { const m = /#morceau=([A-Za-z0-9_-]+)/.exec(String(url || '')); return m ? m[1] : null; }

  /* ---------- Grilles d'accords ---------- */
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
  /* Degré → accord : la lettre suit le degré, pour écrire Bb et non A# en fa majeur. */
  function romanToChord(token, key) {
    const m = /^(b?)(vii|vi|v|iv|iii|ii|i)(.*)$/i.exec(token);
    const k = /^([A-G])([#b]?)$/.exec(key);
    if (!m || !k) return null;
    const degree = ROMAN.indexOf(m[2].toLowerCase());
    const letterIndex = 'CDEFGAB'.indexOf(k[1]);
    const keyPc = MAJOR_STEPS[letterIndex] + (k[2] === '#' ? 1 : k[2] === 'b' ? -1 : 0);
    const pc = keyPc + MAJOR_STEPS[degree] - (m[1] ? 1 : 0);
    const target = (letterIndex + degree) % 7;
    const diff = ((pc - MAJOR_STEPS[target]) % 12 + 18) % 12 - 6;
    const accidental = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
    const lower = m[2] === m[2].toLowerCase();
    const quality = m[3] === '°' ? 'dim' : (lower ? 'm' : '') + m[3];
    return 'CDEFGAB'[target] + accidental + quality;
  }
  const words = (s) => s.split(' ');
  /* Enchaînements courants, par style. models : modèle proposé pour chaque partie. */
  const GRID_STYLES = {
    pop: { label: 'Pop', models: { Couplet: 'Aller-retour sur 8 pas', Refrain: 'Bas, bas-haut, haut-bas-haut', Pont: 'Accents sur 2 et 4' },
      major: ['I V vi IV', 'vi IV I V', 'I vi IV V', 'I IV vi V'], minor: ['i bVI bIII bVII', 'i bVII bVI bVII', 'i iv bVI bVII'] },
    chanson: { label: 'Chanson', models: { Couplet: 'Montée-descente', Refrain: 'Campagne', Pont: 'Coup et doigts' },
      major: ['I vi ii V', 'I IV V I', 'I V vi iii', 'IV V I vi'], minor: ['i iv V7 i', 'i bVII bVI V7', 'i iv bVII bIII'] },
    folk: { label: 'Folk', models: { Couplet: 'Picking alterné', Refrain: 'Campagne', Pont: 'Hauts courts' },
      major: ['I IV I V', 'I V IV I', 'I IV V IV'], minor: ['i bVII i bVII', 'i bIII bVII i', 'i bVI bVII i'] },
    jazz: { label: 'Jazz', models: { Couplet: 'Accord brisé', Refrain: 'Accents sur 2 et 4', Pont: 'Ballade' },
      major: ['Imaj7 vi7 ii7 V7', 'ii7 V7 Imaj7 Imaj7', 'iii7 vi7 ii7 V7'], minor: ['i7 iv7 bVII7 bIIImaj7', 'ii° V7 i i', 'i7 bVImaj7 ii° V7'] },
    reggae: { label: 'Reggae', models: { Couplet: 'Reggae (contretemps)', Refrain: 'Reggae (contretemps)', Pont: 'Coup étouffé' },
      major: ['I IV I V', 'I V vi IV', 'vi IV I V'], minor: ['i bVII i bVII', 'i iv i bVII', 'i bVI bVII i'] },
    blues: { label: 'Blues (12 mesures)', models: { Couplet: 'Coup étouffé', Refrain: 'Coup étouffé', Pont: 'Coup étouffé' },
      major: ['I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7'], minor: ['i i i i iv iv i i bVI V7 i V7'] },
    valse: { label: 'Valse', meter: '3/4', models: { Couplet: 'Valse (3/4)', Refrain: 'Valse rythmique (3/4)', Pont: 'Valse (3/4)' },
      major: ['I IV V I', 'I vi IV V', 'I V IV I'], minor: ['i iv V7 i', 'i bVI iv V7', 'i bIII iv V7'] },
  };
  const GRID_FORMS = {
    loop: ['Grille'],
    verseChorus: ['Couplet', 'Refrain'],
    song: ['Couplet', 'Refrain', 'Couplet', 'Refrain'],
    full: ['Couplet', 'Refrain', 'Couplet', 'Refrain', 'Pont', 'Refrain'],
  };
  /* o : { key, mode: 'major'|'minor', style, form, bars, perBar, seed }. Le même seed donne la même grille ; seed + 1 en propose une autre. */
  function generateGrid(o) {
    const style = GRID_STYLES[o.style] || GRID_STYLES.pop;
    const list = style[o.mode === 'minor' ? 'minor' : 'major'];
    const names = GRID_FORMS[o.form] || GRID_FORMS.loop;
    const seed = o.seed || 0;
    const distinct = [...new Set(names)];
    const lines = {};
    distinct.forEach((name, i) => {
      const prog = words(list[(seed + i) % list.length]).map((d) => romanToChord(d, o.key));
      const perBar = prog.length > 4 ? 1 : (o.perBar === 2 ? 2 : 1); // une grille longue garde un accord par mesure
      const oneRound = [];
      for (let k = 0; k < prog.length; k += perBar) oneRound.push(prog.slice(k, k + perBar).join(' '));
      const wanted = Math.max(+o.bars || 4, oneRound.length);
      const bars = [];
      while (bars.length < wanted) bars.push(...oneRound);
      const rows = [];
      for (let k = 0; k < wanted; k += 4) rows.push(bars.slice(k, k + 4).join(' | '));
      lines[name] = rows.join('\n');
    });
    return names.map((name) => '[' + name + ']\n' + lines[name]).join('\n\n') + '\n';
  }
  /* Une partie écrite en tablature plutôt qu'en accords : renvoie ses mesures, ou null si ce sont des accords.
     Une ligne par corde, l'aiguë en haut ; l'écart entre les chiffres donne les durées (16 caractères par mesure = des doubles-croches). */
  function sectionTab(text, meterKey, strings) {
    if (!findTabBlocks(text).length) return null;
    const t = parseTabText(text, meterKey, '', strings);
    if (!t) return null;
    if (t.unsupported) return { problem: 'tablature à ' + t.unsupported + ' lignes, non lue (il en faut ' + strings + ')' };
    if (stringCount(t.tuning) !== strings) return { problem: 'tablature à ' + stringCount(t.tuning) + ' lignes, alors que l\'instrument a ' + strings + ' cordes' };
    return { bars: t.bars };
  }
  /* Découpe une grille écrite en parties : [Couplet] ouvre une partie, [C] reste un accord. */
  function parseGridText(text) {
    const sections = [];
    let cur = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const head = /^\s*\[([^\]]{1,40})\]\s*$/.exec(raw);
      if (head && !parseChord(head[1].trim())) { cur = { name: head[1].trim(), chords: '' }; sections.push(cur); continue; }
      if (!raw.trim()) continue;
      if (!cur) { cur = { name: '', chords: '' }; sections.push(cur); }
      cur.chords += raw.trim().replace(/^\[(.+)\]$/, '$1') + '\n';
    }
    return sections.filter((s) => s.chords);
  }

  /* ---------- Sortie texte ---------- */
  function strumSymbol(s, strings) {
    const all = strings || 4;
    if (!s || s.type === 'pick') return '';
    if (s.type === 'thumb') return 'p';
    if (s.type === 'tap') return 't';
    const arrow = s.dir === 'up' ? '↑' : '↓';
    if (s.type === 'chunk') return arrow + 'x';
    if (s.level === 'ghost') return '(' + arrow + ')';
    return arrow + (s.count < all ? s.count : '') + (s.level === 'strong' ? '>' : s.level === 'soft' ? '·' : '');
  }
  const STRUM_LEGEND = [
    [/[↓↑]/, '↓ bas, ↑ haut'], [/>/, '> fort'], [/·/, '· doux'], [/\(/, '(↓) à vide'], [/[↓↑][1-5]/, '↓2 sur 2 cordes'],
    [/[↓↑]x/, '↓x étouffé'], [/(^|\s)p(\s|$)/, 'p pouce'], [/(^|\s)t(\s|$)/, 't frappe sur le bois'],
  ];

  function scoreToText(score) {
    const t = tuningOf(score.tuning);
    const N = t.midi.length;
    const rowsDown = t.midi.map((_, i) => N - 1 - i); // ligne du haut = corde la plus aiguë du manche
    const units = METERS[score.meter].units;
    const blocks = [];
    const lines = () => ({ chord: '   ', strum: '   ', lyric: '', s: rowsDown.map((i) => t.names[i].padEnd(2).slice(0, 2) + '|') });
    const lyrics = score.lyrics || [];
    let cur = lines();
    let allStrum = '';
    let head = '';
    const flush = () => {
      const row = cur.strum.trimEnd();
      if (row.trim()) allStrum += ' ' + row;
      blocks.push([...(head ? [head] : []), cur.chord.trimEnd(), ...(row.trim() ? [row] : []), ...cur.s, ...(cur.lyric.trim() ? [cur.lyric.trimEnd()] : [])].join('\n'));
      cur = lines(); head = '';
    };
    let count = 0;
    score.bars.forEach((bar, barIndex) => {
      if (bar.section) {
        if (count % 4) flush();
        count = 0;
        head = '[' + bar.section + ']';
      }
      const barStartS = cur.s[0].length;
      const byStart = new Map(bar.events.map((e) => [e.start, e]));
      const anySixteenth = bar.events.some((e) => e.start % 2 || e.dur === 1);
      const step = anySixteenth ? 1 : 2;
      for (let u = 0; u < units; u += step) {
        const e = byStart.get(u);
        const label = e && e.chord ? e.chord : '';
        const cell = rowsDown.map((i) => {
          const n = e && e.notes.find((x) => x.string === i);
          return n ? (n.muted ? 'x' : String(n.fret)) : '';
        });
        const stroke = e ? strumSymbol(e.strum, N) : '';
        const w = Math.max(3, label.length + 1, stroke.length + 1, ...cell.map((c) => c.length + 1));
        cur.chord += label.padEnd(w);
        cur.strum += stroke.padEnd(w);
        cur.s = cur.s.map((l, k) => l + cell[k].padEnd(w, '-'));
      }
      // Paroles sous la mesure : la mesure s'élargit si elles sont plus longues qu'elle.
      const words = lyrics[barIndex] || '';
      const barStart = cur.chord.length - (cur.s[0].length - barStartS);
      const extra = words.length + 1 - (cur.s[0].length - barStartS);
      if (words && extra > 0) {
        cur.chord += ' '.repeat(extra); cur.strum += ' '.repeat(extra);
        cur.s = cur.s.map((l) => l + '-'.repeat(extra));
      }
      if (words) cur.lyric = cur.lyric.padEnd(barStart) + words;
      cur.chord += ' ';
      cur.strum += ' ';
      cur.s = cur.s.map((l) => l + '|');
      if (++count % 4 === 0) flush();
    });
    if (count % 4) flush();
    const legend = STRUM_LEGEND.filter(([re]) => re.test(allStrum)).map(([, txt]) => txt).join(', ');
    return (score.title ? score.title + '\n\n' : '') + blocks.join('\n\n') + '\n' + (legend ? '\n' + legend + '\n' : '');
  }

  /* ---------- Import : tablature ASCII ---------- */
  const TAB_LINE = /^\s*(?:[A-Ga-g][#b]?\s*)?[|:\[]?\s*(?=[-0-9xX]*-)[-0-9hpbsrxXHPBS/\\~|:.()\s]{5,}$/;

  function cleanOcrLine(l) {
    if (!/[-—–_]{2}/.test(l)) return l;
    const m = /^\s*([A-Ga-g][#b]?)?(.*)$/.exec(l);
    const body = m[2].replace(/[—–_=~]/g, '-').replace(/[Oo]/g, '0').replace(/[lI!\[\]]/g, '|').replace(/\s+/g, '');
    return (m[1] || '') + body;
  }

  function findTabBlocks(text) {
    const lines = String(text).split(/\r?\n/).map(cleanOcrLine);
    const blocks = [];
    let run = [];
    const end = () => { if (run.length >= 4) blocks.push(run); run = []; };
    for (const l of lines) { if (TAB_LINE.test(l) && (l.match(/-/g) || []).length >= 4) run.push(l); else end(); }
    end();
    return blocks;
  }

  function bodyOf(line) {
    const m = /^\s*(?:[A-Ga-g][#b]?\s*)?[|:\[]?/.exec(line);
    return line.slice(m[0].length);
  }

  const DIVISORS = { 16: [1, 2, 4, 8, 16], 12: [1, 2, 3, 4, 6, 12], 8: [1, 2, 4, 8] };
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);

  /* Place les colonnes d'une mesure sur la grille rythmique : l'écart régulier entre colonnes donne la valeur de note. */
  function quantize(cols, barStart, barEnd, units) {
    const lead = cols[0] - barStart;
    const first = lead > (barEnd - barStart) / 3 ? barStart : cols[0];
    let g = cols.reduce((acc, c) => gcd(acc, c - first), 0);
    if (!g) g = Math.max(barEnd - first, 1);
    const needed = Math.ceil((barEnd - first) / g - 0.25);
    const slots = (DIVISORS[units] || [units]).find((d) => d >= needed);
    if (slots) return cols.map((c) => (c - first) / g * (units / slots));
    return cols.map((c) => Math.min(units - 1, Math.round((c - first) / (barEnd - first) * units)));
  }

  /* Blocs de 4 lignes = ukulélé, de 6 lignes = guitare. prefer : nombre de cordes à retenir si le texte contient les deux. */
  function parseTabText(text, meterKey, title, prefer) {
    const meter = METERS[meterKey] || METERS['4/4'];
    const blocks = findTabBlocks(text);
    if (!blocks.length) return null;
    const sizes = [4, 6].filter((k) => blocks.some((b) => b.length === k));
    if (!sizes.length) return { unsupported: Math.max(...blocks.map((b) => b.length)) };
    const L = sizes.includes(prefer) ? prefer : sizes[0];
    const bars = [];
    for (const blk of blocks) {
      if (blk.length !== L) continue;
      const bodies = blk.map(bodyOf);
      const len = Math.max(...bodies.map((b) => b.length));
      const notes = new Map();
      const barCols = new Set();
      bodies.forEach((b, row) => {
        const re = /\d{1,2}|[xX]/g; let m;
        while ((m = re.exec(b))) {
          const col = m.index;
          if (!notes.has(col)) notes.set(col, []);
          notes.get(col).push(/\d/.test(m[0]) ? { string: L - 1 - row, fret: +m[0] } : { string: L - 1 - row, fret: 0, muted: true });
        }
        for (let i = 0; i < b.length; i++) if (b[i] === '|') barCols.add(i);
      });
      const cols = [...notes.keys()].sort((a, b) => a - b);
      // Barres verticales : on garde celles présentes sur au moins 2 cordes (tolère les erreurs d'OCR).
      const confirmed = [...barCols].filter((c) => bodies.filter((b) => b[c] === '|').length >= 2).sort((a, b) => a - b);
      const edges = [0, ...confirmed.filter((c) => c > 0), len].filter((v, i, a) => i === 0 || v > a[i - 1]);
      let ranges = [];
      for (let i = 0; i < edges.length - 1; i++) ranges.push([edges[i], edges[i + 1]]);
      if (ranges.length === 1) {
        // Pas de barres de mesure : découpe en croches régulières.
        const per = meter.units / 2;
        for (let i = 0; i < cols.length; i += per) {
          const slice = cols.slice(i, i + per);
          bars.push({ events: slice.map((c, k) => ({ start: k * 2, dur: 2, notes: notes.get(c) })) });
        }
        continue;
      }
      for (const [a, b] of ranges) {
        const inBar = cols.filter((c) => c >= a && c < b);
        if (!inBar.length) continue;
        const starts = quantize(inBar, a, b, meter.units);
        const events = [];
        inBar.forEach((c, k) => {
          const last = events[events.length - 1];
          if (last && last.start === starts[k]) last.notes = last.notes.concat(notes.get(c));
          else events.push({ start: starts[k], dur: 0, notes: notes.get(c) });
        });
        events.forEach((e, k) => { e.dur = (k + 1 < events.length ? events[k + 1].start : meter.units) - e.start; });
        bars.push({ events });
      }
    }
    if (!bars.length) return null;
    return { title: title || '', meter: meterKey in METERS ? meterKey : '4/4', tuning: L === 6 ? 'guitar' : 'standard', bars, voicings: [], problems: [], source: 'imported' };
  }

  /* ---------- Import : grille d'accords ---------- */
  function extractChordSheet(text) {
    const lines = String(text).split(/\r?\n/);
    const out = [];
    let title = '';
    const tabLines = new Set(findTabBlocks(text).flat());
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || tabLines.has(cleanOcrLine(raw))) continue;
      const directive = /^\{\s*(?:title|t)\s*:\s*(.+?)\s*\}$/i.exec(line);
      if (directive) { title = directive[1]; continue; }
      if (/^\{.*\}$/.test(line) || /^\[[^\]]*\]$/.test(line) && !parseChord(line.slice(1, -1))) continue;
      const inline = [...line.matchAll(/\[([^\]\s]{1,12})\]/g)].map((m) => m[1]).filter(parseChord);
      if (inline.length) { out.push(inline.join(' ')); continue; }
      const cleaned = line.replace(/[()]/g, ' ').replace(/[,;]/g, ' ').replace(/\s[x×*]\s*\d+\s*$/i, ' ');
      const tokens = cleaned.split(/[\s|]+/).filter(Boolean);
      const usable = tokens.filter((t) => !/^[-/%.]+$/.test(t));
      if (usable.length && usable.every(parseChord)) {
        // Un mot isolé type « La » ou « A » seul reste ambigu en français : on le garde seulement avec d'autres accords.
        const ambiguous = usable.length === 1 && /^(A|La|Si|Do|Mi|Fa|Re|Ré)$/.test(usable[0]);
        if (!ambiguous || lines.filter((l) => l.trim()).length <= 2) out.push(line.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim());
      }
    }
    const parsed = parseChordText(out.join('\n'));
    return { chordsText: out.join('\n'), count: parsed.bars.flat().length, title };
  }

  /* ---------- Import : feuille de chant (accords écrits au-dessus des paroles) ----------
     Chaque accord vaut une mesure et les paroles sont découpées sous lui. Notations reconnues :
     « / » rejoue l'accord une mesure de plus, « D* » (italique) dure une demi-mesure, « Dm7[5557] » ou « [0232] » impose des cases,
     « [Refrain] » ouvre une partie. Flèches, « | », notes de mélodie (e0, c2) et commentaires sont laissés de côté. */
  const ARROWS = /[↓↑]/;
  function sheetToken(raw, strings) {
    let t = raw.replace(/[↓↑…]+/g, '').replace(/[.,;:!?]+$/, '');
    if (!t) return null;
    if (t === '/' || t === '%') return { repeat: true };
    const frets = /\[([0-9xX]{4,6})\]/.exec(t);
    let pin = null;
    let other = null; // cases écrites pour un autre instrument (ukulélé lu à la guitare) : elles donnent le nom, pas la position
    if (frets) { if (frets[1].length === strings) pin = frets[1].toLowerCase(); else other = frets[1].toLowerCase(); t = t.replace(frets[0], ''); }
    const again = /\/$/.test(t); if (again) t = t.slice(0, -1);
    t = t.replace(/[|_]+/g, '');
    const half = /\*/.test(t); t = t.replace(/\*/g, '');
    if (!t) return pin || other ? { pin, other, again, half } : null;
    const c = parseChord(t);
    if (c) return { label: t, pin, again, half };
    return pin || other ? { pin, other, again, half } : { word: true }; // nom inconnu mais cases données : les cases suffisent
  }
  /* Deux colonnes sur la page : si beaucoup de lignes reprennent à la même colonne après un grand blanc, la colonne de droite est lue à la suite. */
  function splitColumns(lines) {
    const starts = new Map();
    lines.forEach((l) => { const re = / {4,}(?=\S)/g; let m; const seen = new Set(); while ((m = re.exec(l))) { const c = m.index + m[0].length; if (c >= 30 && !seen.has(c)) { seen.add(c); starts.set(c, (starts.get(c) || 0) + 1); } } });
    let best = 0; let col = 0;
    starts.forEach((n, c) => { if (n > best) { best = n; col = c; } });
    if (best < 6) return lines;
    const left = []; const right = [];
    lines.forEach((l) => {
      const cut = l.length > col && /^ {2,}$/.test(l.slice(Math.max(0, col - 2), col)) || (l.length > col && !l.slice(0, col).trim());
      if (cut) { if (l.slice(0, col).trim()) left.push(l.slice(0, col).replace(/\s+$/, '')); right.push(l.slice(col)); } else left.push(l);
    });
    return left.concat([''], right);
  }
  function parseSongSheet(text, opts) {
    const o = opts || {}; const strings = o.strings || 4;
    const tuningKey = o.tuning && stringCount(o.tuning) === strings ? o.tuning : (strings === 6 ? 'guitar' : 'standard');
    const raw = String(text || '').replace(/[\u200b\u00ad]/g, '').replace(/\t/g, '    ').split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
    const lines = splitColumns(raw);
    const out = { title: o.title || '', tempo: null, pattern: null, sections: [], bars: 0, pairs: 0, ignored: [] };
    let cur = null; let pending = null; // pending : mesures de la dernière ligne d'accords, en attente de leurs paroles
    const section = (name) => { cur = { name, lines: [] }; out.sections.push(cur); };
    const tokensOf = (line) => { const list = []; const re = /\S+/g; let m; while ((m = re.exec(line))) list.push({ col: m.index, raw: m[0] }); return list; };
    const readChords = (line, offset) => {
      // Une remarque entre parenthèses sur la ligne d'accords (« (| = jouer juste ↓) ») n'en fait pas une ligne de paroles.
      const bare = line.replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length));
      const toks = tokensOf(bare).map((t) => Object.assign(t, { col: t.col + (offset || 0), k: sheetToken(t.raw, strings) }));
      const chords = toks.filter((t) => t.k && (t.k.label || t.k.pin || t.k.other)); const words = toks.filter((t) => t.k && t.k.word);
      if (!chords.length || words.length > chords.length) return null;
      words.forEach((w) => { if (!/^[(\[]|^[a-g]\d|^ral|^x\d/i.test(w.raw) && !out.ignored.includes(w.raw)) out.ignored.push(w.raw); });
      const bars = []; let halfOpen = null;
      toks.forEach((t) => {
        const k = t.k; if (!k) return;
        if (k.repeat) { const last = bars[bars.length - 1]; if (last) bars.push({ col: t.col, cols: [t.col], tokens: [last.tokens[last.tokens.length - 1]] }); halfOpen = null; return; }
        if (!k.label && !k.pin && !k.other) return;
        let label = k.label;
        if (!label) { // cases seules : on retrouve le nom de l'accord
          const shape = k.pin || k.other;
          const named = nameChord(shape.split('').map((c) => (c === 'x' ? -1 : +c)), k.pin ? tuningKey : (shape.length === 6 ? 'guitar' : 'standard'));
          if (!named.label) { if (!out.ignored.includes('[' + shape + ']')) out.ignored.push('[' + shape + ']'); return; }
          label = named.label.split('/')[0];
        }
        const token = label + (k.pin ? '@' + k.pin : '');
        if (k.half && halfOpen) { halfOpen.tokens.push(token); halfOpen.cols.push(t.col); halfOpen = null; } else {
          const bar = { col: t.col, cols: [t.col], tokens: [token] }; bars.push(bar); halfOpen = k.half ? bar : null;
        }
        if (k.again) { bars.push({ col: t.col + t.raw.length, cols: [t.col + t.raw.length], tokens: [token] }); halfOpen = null; }
      });
      return bars.length ? bars : null;
    };
    const flush = () => { if (pending) { cur.lines.push({ bars: pending.map((b) => b.tokens), lyrics: pending.map(() => '') }); pending = null; } };
    for (const line of lines) {
      if (!line.trim()) continue;
      const bpm = /(\d{2,3})\s*BPM/i.exec(line); if (bpm && !out.tempo) { out.tempo = Math.min(180, Math.max(40, +bpm[1])); continue; }
      const head = /^\s*\[([^\]]{2,40})\]/.exec(line);
      let body = line; let offset = 0;
      if (head && !/^[0-9xX]{4,6}$/.test(head[1]) && !parseChord(head[1].trim())) {
        flush(); section(head[1].trim());
        // Premier rythme indiqué après le titre de la partie : ↓ bas, ↑ haut, un chiffre = la corde pincée.
        const rhythm = /[↓↑][↓↑\d ]{2,}/.exec(line.slice(head[0].length));
        if (rhythm && !out.pattern) { const steps = rhythm[0].replace(/\s/g, '').split('').map((c) => (c === '↓' ? 'b' : c === '↑' ? 'h' : c)); if ([4, 6, 8].includes(steps.length) && steps.every((x) => x === 'b' || x === 'h' || +x <= strings)) out.pattern = steps.join(' '); }
        offset = head[0].length; body = line.slice(offset);
        if (!body.trim()) continue;
      }
      const stripped = body.replace(/[↓↑…\s()]/g, '');
      if (!stripped || (ARROWS.test(body) && !/[A-G]/.test(stripped))) continue; // ligne de flèches seule
      const chordLine = readChords(body, offset);
      if (chordLine) { if (!cur) section(''); flush(); pending = chordLine; continue; }
      if (pending) { // paroles de la ligne d'accords précédente, découpées sous chaque accord
        const cols = pending.map((b) => b.col);
        // Un accord qui tombe au milieu d'un mot le coupe : un tiret le signale.
        const cutWord = (c) => c !== undefined && c > 0 && c < line.length && /\S/.test(line[c - 1]) && /\S/.test(line[c]) && line[c - 1] !== '-';
        // « ^ » garde la place de chaque accord dans les paroles de sa mesure : la syllabe sur laquelle il tombe.
        const lyr = pending.map((b, i) => {
          const start = i === 0 ? 0 : cols[i]; const end = i + 1 < cols.length ? cols[i + 1] : Math.max(line.length, start);
          let seg = ''; let pos = start;
          b.cols.forEach((c, j) => {
            const at = Math.min(Math.max(c, start), end);
            if (j > 0 || line.slice(start, at).trim()) { seg += line.slice(pos, at) + '^'; pos = at; }
          });
          seg += line.slice(pos, end);
          return seg.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim() + (cutWord(cols[i + 1]) ? '-' : '');
        });
        cur.lines.push({ bars: pending.map((b) => b.tokens), lyrics: lyr }); pending = null; out.pairs++;
      } else if (!out.sections.length && !out.title) out.title = line.trim().replace(/\s{2,}.*$/, '').replace(/\s*\(?\b(19|20)\d\d\)?.*$/, '').replace(/\s+wiki$/i, '').slice(0, 80);
    }
    if (cur) flush();
    out.sections = out.sections.filter((sec) => sec.lines.length);
    // Sortie au format de l'application : grille et paroles, une ligne de la feuille par ligne.
    const barText = (toks) => (toks.length > 1 ? toks.join(' ') : toks[0]);
    const chordLines = []; const lyricLines = [];
    out.sections.forEach((sec, i) => {
      if (i) { chordLines.push(''); lyricLines.push(''); }
      if (sec.name) { chordLines.push('[' + sec.name + ']'); lyricLines.push('[' + sec.name + ']'); }
      sec.lines.forEach((l) => {
        chordLines.push('| ' + l.bars.map(barText).join(' | ') + ' |');
        lyricLines.push(l.lyrics.map((w) => w.replace(/\|/g, ' ') || '_').join(' | '));
        out.bars += l.bars.length;
      });
    });
    out.chordsText = chordLines.join('\n'); out.lyricsText = lyricLines.join('\n');
    return out;
  }

  function detectContent(text, meter, prefer) {
    if (isMusicXml(text)) {
      const found = findChords(text);
      return found.count ? { type: 'chords', chordsText: found.chordsText, count: found.count, title: found.title } : { type: 'unknown' };
    }
    const tab = parseTabText(text, meter, '', prefer);
    if (tab && tab.unsupported) return { type: 'unsupported-tab', strings: tab.unsupported };
    if (tab) return { type: 'tab', score: tab, count: tab.bars.length };
    // Accords au-dessus des paroles : la chanson entière, avec ses parties et ses paroles par mesure.
    const song = parseSongSheet(text, { strings: prefer || 4 });
    if (song.pairs >= 2 && song.bars >= 4) return { type: 'song', song, count: song.bars };
    const sheet = extractChordSheet(text);
    if (sheet.count) return { type: 'chords', ...sheet };
    return { type: 'unknown' };
  }

  /* ---------- Recherche des accords ----------
     Trois sources, de la plus sûre à la moins sûre : noms écrits dans le fichier, notes d'une partition MusicXML ou d'une tablature (déduction). */
  const CANDIDATES = [['', 0], ['m', 0], ['7', 0.07], ['m7', 0.08], ['maj7', 0.12], ['sus4', 0.12], ['sus2', 0.14], ['6', 0.2], ['dim', 0.14], ['aug', 0.16]];
  const KEY_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KEY_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 9, 10, 11]; // mineur naturel + 6e et 7e montantes
  const FLAT_KEYS = new Set(['F', 'A#', 'D#', 'G#', 'C#', 'Dm', 'Gm', 'Cm', 'Fm', 'A#m']);

  /* Poids de chaque note entre deux instants : sa durée, avec un bonus sur le premier temps du segment. */
  function segmentProfile(events, from, to, tuningKey) {
    const w = new Array(12).fill(0);
    let low = null; let lowMidi = Infinity;
    for (const e of events) {
      const overlap = Math.min(e.start + Math.max(e.dur, 1), to) - Math.max(e.start, from);
      if (overlap <= 0) continue;
      const accent = e.start === from ? 1.5 : 1;
      for (const n of e.notes) {
        if (n.muted) continue; // une note étouffée n'a pas de hauteur
        const midi = n.midi !== undefined ? n.midi : midiOf(n, tuningKey);
        w[((midi % 12) + 12) % 12] += overlap * accent;
        if (midi < lowMidi) { lowMidi = midi; low = ((midi % 12) + 12) % 12; }
      }
    }
    const total = w.reduce((a, b) => a + b, 0);
    return { w: total ? w.map((v) => v / total) : w, total, low, distinct: w.filter((v) => v > 0).length };
  }

  function estimateKey(hist) {
    const mean = (a) => a.reduce((x, y) => x + y, 0) / 12;
    const corr = (a, b) => {
      const ma = mean(a); const mb = mean(b); let n = 0; let da = 0; let db = 0;
      for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
      return da && db ? n / Math.sqrt(da * db) : 0;
    };
    let best = { root: 0, minor: false, r: -2 };
    for (let root = 0; root < 12; root++) {
      const rotated = hist.map((_, i) => hist[(i + root) % 12]);
      const maj = corr(rotated, KEY_MAJOR); const min = corr(rotated, KEY_MINOR);
      if (maj > best.r) best = { root, minor: false, r: maj };
      if (min > best.r) best = { root, minor: true, r: min };
    }
    return best;
  }

  function rankChords(p, key) {
    const out = [];
    for (let root = 0; root < 12; root++) for (const [q, prior] of CANDIDATES) {
      const iv = QUALITY[q].iv;
      let inside = 0; let missing = 0;
      for (const i of iv) { const v = p.w[(root + i) % 12]; inside += v; if (v <= 0.02) missing++; }
      let score = inside - 0.3 * missing / iv.length - prior + 0.12 * p.w[root] + (p.low === root ? 0.1 : 0);
      if (key) {
        const scale = key.minor ? SCALE_MINOR : SCALE_MAJOR;
        if (iv.slice(0, 3).every((i) => scale.includes((root + i - key.root + 120) % 12))) score += 0.04;
      }
      out.push({ root, quality: q, score, inside, missing, size: iv.length });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /* Déduit les accords d'une partition déjà lue : un accord par mesure, deux si la mesure change nettement à mi-parcours. */
  function detectChords(score, tuningKey) {
    // L'accordage demandé ne vaut que s'il a autant de cordes que la tablature lue.
    const tuning = TUNINGS[tuningKey] && stringCount(tuningKey) === stringCount(score.tuning) ? tuningKey : (score.tuning || 'standard');
    const units = (METERS[score.meter] || METERS['4/4']).units;
    const canSplit = score.meter !== '3/4';
    const hist = new Array(12).fill(0);
    let stringsSum = 0; let counted = 0; let chordEvents = 0; let eventsTotal = 0;
    for (const bar of score.bars) {
      const p = segmentProfile(bar.events, 0, units, tuning);
      p.w.forEach((v, i) => { hist[i] += v * p.total; });
      if (p.total) { stringsSum += new Set(bar.events.flatMap((e) => e.notes.map((n) => n.string))).size; counted++; }
      bar.events.forEach((e) => { eventsTotal++; if (e.notes.length > 2) chordEvents++; });
    }
    const key = estimateKey(hist);
    const names = FLAT_KEYS.has(SHARP[key.root] + (key.minor ? 'm' : '')) ? FLAT : SHARP;
    const label = (c) => names[c.root] + c.quality;
    const pack = (ranked) => {
      const top = ranked[0];
      const confidence = Math.max(0, Math.min(1, top.inside * (1 - 0.5 * top.missing / top.size)));
      const alternatives = ranked.slice(1).filter((c) => top.score - c.score < 0.05).slice(0, 2).map(label);
      return { label: label(top), root: top.root, quality: top.quality, confidence, alternatives };
    };
    const bars = [];
    let previous = null;
    for (const bar of score.bars) {
      const whole = segmentProfile(bar.events, 0, units, tuning);
      if (!whole.total) { bars.push(previous ? [previous] : []); continue; }
      const rankedWhole = rankChords(whole, key);
      let chords = [pack(rankedWhole)];
      const perfect = rankedWhole[0].inside > 0.99 && !rankedWhole[0].missing;
      if (canSplit && !perfect) {
        const a = segmentProfile(bar.events, 0, units / 2, tuning);
        const b = segmentProfile(bar.events, units / 2, units, tuning);
        if (a.distinct >= 2 && b.distinct >= 2) {
          const ra = rankChords(a, key); const rb = rankChords(b, key);
          if (ra[0].root + ra[0].quality !== rb[0].root + rb[0].quality && (ra[0].score + rb[0].score) / 2 - rankedWhole[0].score > 0.1) chords = [pack(ra), pack(rb)];
        }
      }
      previous = chords[chords.length - 1];
      bars.push(chords);
    }
    const all = bars.flat();
    const confidence = all.length ? all.reduce((n, c) => n + c.confidence, 0) / all.length : 0;
    return {
      bars, key: names[key.root] + (key.minor ? 'm' : ''), confidence,
      // Une ligne mélodique seule n'indique pas l'harmonie : le résultat n'est alors qu'une proposition.
      melodyOnly: counted > 0 && chordEvents / Math.max(eventsTotal, 1) < 0.1 && (confidence < 0.8 || stringsSum / counted <= 2),
      uncertain: [...new Set(all.filter((c) => c.confidence < 0.8).map((c) => c.label))],
      chordsText: barsToText(bars),
    };
  }

  function barsToText(bars) {
    const lines = [];
    const cells = bars.filter((b) => b.length).map((b) => b.map((c) => c.label).join(' '));
    for (let i = 0; i < cells.length; i += 4) lines.push(cells.slice(i, i + 4).join(' | '));
    return lines.join('\n');
  }

  /* ---------- MusicXML (export de MuseScore, Finale, Sibelius…) ---------- */
  const XML_KINDS = {
    major: '', minor: 'm', dominant: '7', 'major-seventh': 'maj7', 'minor-seventh': 'm7', 'major-sixth': '6', 'minor-sixth': 'm6', 'dominant-ninth': '9', 'minor-ninth': 'm9',
    diminished: 'dim', 'diminished-seventh': 'dim7', augmented: 'aug', 'half-diminished': 'm7b5', 'suspended-fourth': 'sus4', 'suspended-second': 'sus2', power: '5',
  };
  const xmlValue = (src, tag) => { const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>\\s*([^<]*?)\\s*</' + tag + '>').exec(src); return m ? m[1] : null; };
  const isMusicXml = (text) => /<score-partwise[\s>]/.test(String(text).slice(0, 4000));

  function parseMusicXml(text) {
    const src = String(text).replace(/<!--[\s\S]*?-->/g, '');
    const beats = xmlValue(src, 'beats'); const beatType = xmlValue(src, 'beat-type');
    const meter = beats && METERS[beats + '/' + beatType] ? beats + '/' + beatType : '4/4';
    const title = (xmlValue(src, 'work-title') || xmlValue(src, 'movement-title') || '').trim();
    const measures = new Map();
    for (const part of src.match(/<part[\s>][\s\S]*?<\/part>/g) || []) {
      let divisions = 1; let shift = 0; let index = 0;
      for (const body of part.match(/<measure[\s>][\s\S]*?<\/measure>/g) || []) {
        if (!measures.has(index)) measures.set(index, { events: [], written: [] });
        const bar = measures.get(index++);
        const d = xmlValue(body, 'divisions'); if (d) divisions = +d || 1;
        const t = xmlValue(body, 'chromatic'); if (t !== null) shift = +t || 0;
        let cursor = 0; let last = 0;
        for (const m of body.matchAll(/<(note|backup|forward|harmony)[\s>][\s\S]*?<\/\1>/g)) {
          const el = m[0];
          const len = (+xmlValue(el, 'duration') || 0) * 4 / divisions;
          if (m[1] === 'backup') { cursor -= len; continue; }
          if (m[1] === 'forward') { cursor += len; continue; }
          if (m[1] === 'harmony') {
            const step = xmlValue(el, 'root-step');
            if (step) {
              const alter = +xmlValue(el, 'root-alter') || 0;
              const q = XML_KINDS[xmlValue(el, 'kind')];
              const bassStep = xmlValue(el, 'bass-step');
              const bassAlter = +xmlValue(el, 'bass-alter') || 0;
              const acc = (a) => (a > 0 ? '#' : a < 0 ? 'b' : '');
              bar.written.push({ label: step + acc(alter) + (q === undefined ? '' : q) + (bassStep ? '/' + bassStep + acc(bassAlter) : '') });
            }
            continue;
          }
          const inChord = /<chord\s*\/>/.test(el);
          const start = inChord ? last : cursor;
          if (!inChord) { last = cursor; cursor += len; }
          const step = xmlValue(el, 'step');
          if (!step || /<rest[\s/>]/.test(el) || /<grace[\s/>]/.test(el)) continue;
          const midi = (+xmlValue(el, 'octave') + 1) * 12 + PC[step] + (+xmlValue(el, 'alter') || 0) + shift;
          bar.events.push({ start, dur: len, notes: [{ midi }] });
        }
      }
    }
    const list = [...measures.keys()].sort((a, b) => a - b).map((k) => measures.get(k));
    return { title, meter, bars: list.map((b) => ({ events: b.events })), written: list.map((b) => b.written), tuning: 'standard' };
  }

  /* Point d'entrée : lit ce que le fichier écrit noir sur blanc, sinon déduit à partir des notes. */
  function findChords(text, opts) {
    const o = opts || {};
    if (isMusicXml(text)) {
      const mx = parseMusicXml(text);
      if (mx.written.some((b) => b.length)) {
        let carry = null;
        const bars = mx.written.map((b) => { if (b.length) { carry = b[b.length - 1]; return b; } return carry ? [carry] : []; });
        return { source: 'written', chordsText: barsToText(bars), count: bars.flat().length, title: mx.title, uncertain: [] };
      }
      if (!mx.bars.some((b) => b.events.length)) return { source: 'none' };
      const d = detectChords(mx);
      return Object.assign({ source: 'score', count: d.bars.flat().length, title: mx.title }, d);
    }
    const sheet = extractChordSheet(text);
    const tab = parseTabText(text, o.meter || '4/4', '', o.tuning ? stringCount(o.tuning) : undefined);
    const hasTab = tab && tab.bars;
    if (sheet.count >= (hasTab ? 2 : 1)) return { source: 'written', chordsText: sheet.chordsText, count: sheet.count, title: sheet.title, uncertain: [] };
    if (!hasTab) return { source: 'none' };
    const d = detectChords(tab, o.tuning);
    return Object.assign({ source: 'tab', count: d.bars.flat().length }, d);
  }

  /* ---------- Hauteurs ---------- */
  function midiOf(note, tuningKey) { return tuningOf(tuningKey).midi[note.string] + note.fret; }

  /* Son d'une corde nylon pincée au doigt, caisse de ukulélé comprise.
     Karplus-Strong étendu : accord exact (passe-tout fractionnaire), aigus amortis en secondes et non
     par période (sinon les notes graves sonnent métalliques), excitation douce pincée vers la rosace,
     puis résonances de caisse. Hasard déterministe : une même note sonne toujours pareil. */
  const WAVE_SECONDS = 2.6;
  function pluckWave(midi, sr, instrument) {
    const guitar = instrument === 'guitar';
    let seed = (midi * 2654435761) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; };
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    const N = sr / f0; const w0 = 2 * Math.PI * f0 / sr;
    const high = Math.min(1, Math.max(0, (midi - 57) / 24));
    const t60 = (guitar ? 3.6 : 3) - 1.3 * high; // durée de résonance du fondamental
    const t60Bright = guitar ? 0.3 : 0.22; // vers 2,5 kHz, le nylon s'éteint vite
    // Filtre de boucle à un pôle : p tel que 2,5 kHz perde 60 dB en t60Bright.
    const wB = 2 * Math.PI * Math.min(2500, sr / 4) / sr;
    const wantB = Math.pow(0.001, 1 / (f0 * t60Bright));
    const mag = (p, w) => (1 - p) / Math.sqrt(1 - 2 * p * Math.cos(w) + p * p);
    let lo = 0; let hi = 0.95;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (mag(m, wB) > wantB) lo = m; else hi = m; }
    const p = lo;
    const lpDelay = Math.atan2(p * Math.sin(w0), 1 - p * Math.cos(w0)) / w0;
    const rho = Math.pow(0.001, 1 / (f0 * t60)) / mag(p, w0); // perte par période, fondamental réglé sur t60
    const L = Math.max(2, Math.floor(N - lpDelay - 0.5));
    const d = N - lpDelay - L; const c = (1 - d) / (1 + d);
    // Excitation : bruit adouci (pulpe du doigt), creusé par la position du pincé (~1/5 de la corde).
    const line = new Float32Array(L);
    let s = 0;
    for (let i = 0; i < L; i++) { s = 0.45 * rnd() + 0.55 * s; line[i] = s; }
    const P = Math.max(1, Math.round(L * 0.2));
    const ex = line.map((v, i) => v - (i >= P ? line[i - P] : 0));
    let mean = 0; ex.forEach((v) => { mean += v; }); mean /= L;
    for (let i = 0; i < L; i++) line[i] = ex[i] - mean;

    const len = Math.floor(sr * WAVE_SECONDS); const out = new Float32Array(len);
    let idx = 0; let lp = 0; let apX = 0; let apY = 0;
    for (let n = 0; n < len; n++) {
      const x = line[idx];
      lp = (1 - p) * x + p * lp;
      const y = c * lp + apX - c * apY; apX = lp; apY = y;
      line[idx] = rho * y; idx = idx + 1 === L ? 0 : idx + 1;
      out[n] = x;
    }
    // Petit bruit d'attaque du doigt sur la corde.
    const nA = Math.floor(sr * 0.006);
    for (let n = 0; n < nA; n++) out[n] += 0.08 * rnd() * (1 - n / nA);
    // Caisse : coupe du très grave, résonance d'air, table, aigus adoucis.
    if (guitar) {
      // Caisse de guitare : plus grande, donc résonances d'air et de table plus basses.
      biquad(out, sr, 'highpass', 55, 0.7, 0);
      biquad(out, sr, 'peak', 105, 2, 5);
      biquad(out, sr, 'peak', 210, 2, 3);
      biquad(out, sr, 'peak', 900, 1.5, -2);
      biquad(out, sr, 'highshelf', 5000, 0.7, -7);
    } else {
      biquad(out, sr, 'highpass', 85, 0.7, 0);
      biquad(out, sr, 'peak', 290, 2.2, 6);
      biquad(out, sr, 'peak', 520, 2, 3);
      biquad(out, sr, 'peak', 1100, 1.5, -2);
      biquad(out, sr, 'highshelf', 4500, 0.7, -8);
    }
    // Attaque sans clic, fin de son en fondu ; niveau calé sur le début de la note.
    const nIn = Math.floor(sr * 0.002); const nOut = Math.floor(sr * 0.4);
    for (let n = 0; n < nIn; n++) out[n] *= n / nIn;
    for (let n = 0; n < nOut; n++) out[len - 1 - n] *= n / nOut;
    const win = Math.floor(sr * 0.25); let e = 0;
    for (let n = 0; n < win; n++) e += out[n] * out[n];
    const k = 0.12 / Math.sqrt(e / win || 1);
    for (let n = 0; n < len; n++) out[n] *= k;
    return out;
  }
  /* Filtre biquadratique (formules RBJ), appliqué sur place. */
  function biquad(x, sr, type, f, q, db) {
    const A = Math.pow(10, db / 40); const w = 2 * Math.PI * f / sr; const cs = Math.cos(w); const al = Math.sin(w) / (2 * q);
    let b0; let b1; let b2; let a0; let a1; let a2;
    if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    else { const r = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cs + r); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - r); a0 = (A + 1) - (A - 1) * cs + r; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - r; }
    let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
    for (let n = 0; n < x.length; n++) {
      const v = x[n];
      const y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = v; y2 = y1; y1 = y; x[n] = y;
    }
  }
  /* Nom d'un accord posé à la main sur le manche. La note la plus grave décide entre deux lectures possibles
     (Do6 ou La mineur 7) ; si elle n'est pas la fondamentale, l'accord est écrit avec sa basse (C/E). */
  const NAME_ORDER = ['', 'm', '7', 'm7', 'maj7', '6', 'm6', 'sus4', 'sus2', '7sus4', 'add9', '9', 'm9', 'dim', 'dim7', 'm7b5', 'aug', '5'];
  const ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  function nameChord(frets, tuningKey) {
    const t = tuningOf(tuningKey); const guitar = t.midi.length > 4;
    const notes = []; frets.forEach((f, i) => { if (f >= 0) notes.push(t.midi[i] + f - (t.capo || 0)); });
    const pcs = [...new Set(notes.map((m) => m % 12))];
    if (pcs.length < 2) return { label: null, alternatives: [], count: pcs.length };
    const bass = Math.min(...notes) % 12;
    const found = [];
    for (let r = 0; r < 12; r++) NAME_ORDER.forEach((q, rank) => {
      const set = QUALITY[q].iv.map((i) => (r + i) % 12);
      if (!pcs.includes(r) || !pcs.every((p) => set.includes(p))) return;
      const missing = set.filter((p) => !pcs.includes(p));
      // Seule la quinte peut manquer, et seulement dans un accord de quatre sons ou plus.
      if (missing.length > 1 || (missing.length === 1 && (set.length < 4 || missing[0] !== (r + 7) % 12))) return;
      // Au ukulélé, la corde grave ne fait pas une basse : l'accord garde son nom simple.
      const slash = guitar && r !== bass;
      found.push({ label: ROOT_NAMES[r] + q + (slash ? '/' + ROOT_NAMES[bass] : ''), missing: missing.length, score: missing.length * 2 + (r === bass ? 0 : guitar ? 1 : 0.05) + rank * 0.1 });
    });
    found.sort((a, b) => a.score - b.score);
    if (found.length && !found[0].missing) found.splice(0, found.length, ...found.filter((x) => !x.missing)); // lecture exacte trouvée : pas de lecture incomplète en plus
    return { label: found.length ? found[0].label : null, alternatives: found.slice(1, 4).map((x) => x.label), count: pcs.length };
  }
  /* Nom français d'une note (solfège) : Do, Fa♯, Si♭… */
  const SOLFEGE_SHARP = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const SOLFEGE_FLAT = ['Do', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  function noteName(midi, flats) { return (flats ? SOLFEGE_FLAT : SOLFEGE_SHARP)[((midi % 12) + 12) % 12]; }
  function spell(midi, flats) {
    const pc = ((midi % 12) + 12) % 12;
    const name = (flats ? FLAT : SHARP)[pc];
    return { letter: name[0].toLowerCase(), accidental: name[1] || '', octave: Math.floor(midi / 12) - 1 };
  }
  /* Découpe une durée (en double-croches) en valeurs écrivables. */
  const VALUES = [[16, 'w', 0], [12, 'h', 1], [8, 'h', 0], [6, 'q', 1], [4, 'q', 0], [3, '8', 1], [2, '8', 0], [1, '16', 0]];
  function splitDuration(units) {
    const res = [];
    let left = units;
    while (left > 0) {
      const v = VALUES.find((x) => x[0] <= left);
      res.push({ units: v[0], value: v[1], dots: v[2] });
      left -= v[0];
    }
    return res;
  }

  function directLink(url) {
    const u = String(url || '').trim();
    let m = /^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/.exec(u) || /^https?:\/\/drive\.google\.com\/open\?id=([\w-]+)/.exec(u);
    if (m) return 'https://drive.google.com/uc?export=download&id=' + m[1];
    if (/^https?:\/\/(www\.)?dropbox\.com\//.test(u)) return /[?&]dl=0/.test(u) ? u.replace(/([?&])dl=0/, '$1dl=1') : u + (u.includes('?') ? '&' : '?') + 'dl=1';
    m = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/.exec(u);
    if (m) return 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2];
    return u;
  }

  const api = { simplifyChord, SIMPLE_GUITAR, lyricsFor, sectionTab, parseSongSheet, nameChord, noteName, TUNINGS, INSTRUMENTS, stringCount, fretText, COMMON_GUITAR, strumSymbol, METERS, QUALITY, COMMON, parseChord, parseChordText, voicingsFor, chooseVoicings, generateGrid, parseGridText, romanToChord, GRID_STYLES, parsePattern, parseStrumToken, strumToText, beatLabel, stringForDegree, buildScore, eventAt, parseLyrics, printBarsPerLine, fixedLines, shareSong, readSharedSong, packSong, unpackSong, songLinkData, scoreToText, parseTabText, extractChordSheet, detectContent, findChords, detectChords, parseMusicXml, midiOf, pluckWave, spell, splitDuration, directLink, transposeChord, findTabBlocks };
  global.UkuCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
