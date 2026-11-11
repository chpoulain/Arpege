/* Moteur musical : accords, doigtés, motifs d'arpège, analyse de fichiers. Sans dépendance DOM. */
(function (global) {
  'use strict';

  const TUNINGS = {
    standard: { label: 'Standard G C E A', midi: [67, 60, 64, 69], names: ['G', 'C', 'E', 'A'], offset: 0 },
    lowg: { label: 'Sol grave g C E A', midi: [55, 60, 64, 69], names: ['G', 'C', 'E', 'A'], offset: 0 },
    d: { label: 'En ré A D F# B', midi: [69, 62, 66, 71], names: ['A', 'D', 'F#', 'B'], offset: 2 },
    baritone: { label: 'Baryton D G B E', midi: [50, 55, 59, 64], names: ['D', 'G', 'B', 'E'], offset: 7 },
  };
  const REF_OPEN = [7, 0, 4, 9]; // formes calculées sur G C E A, puis valables sur tout accordage transposé
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

  const CHORD_RES = [/^(Do|Ré|Re|Mi|Fa|Sol|La|Si)(#|♯|b|♭)?(.*)$/, /^([A-G])(#|♯|b|♭)?(.*)$/];

  function parseChord(token) {
    if (!token) return null;
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
          if (tok === '-' || tok === '/' || tok === '%') { if (chords.length) chords.push(chords[chords.length - 1]); continue; }
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

  function voicingsFor(chord, tuningKey) {
    const tuning = TUNINGS[tuningKey] || TUNINGS.standard;
    const refRoot = (chord.root - tuning.offset + 120) % 12;
    const cacheKey = refRoot + ':' + chord.quality;
    if (voicingCache.has(cacheKey)) return voicingCache.get(cacheKey);
    const q = QUALITY[chord.quality];
    const allowed = new Set(q.iv.map((i) => (refRoot + i) % 12));
    const need = q.req.map((i) => (refRoot + i) % 12);
    const common = COMMON[SHARP[refRoot] + chord.quality];
    const out = [];
    // Recherche normale, puis élargie (grand écart ou manche haut) pour les rares accords sans forme compacte.
    for (const [maxFret, maxSpan] of [[12, 3], [12, 4], [15, 3], [15, 4]]) {
      if (out.length) break;
    const candidates = REF_OPEN.map((open) => {
      const fr = [];
      for (let f = 0; f <= maxFret; f++) if (allowed.has((open + f) % 12)) fr.push(f);
      return fr;
    });
    for (const a of candidates[0]) for (const b of candidates[1]) for (const c of candidates[2]) for (const d of candidates[3]) {
      const fr = [a, b, c, d];
      const fretted = fr.filter((x) => x > 0);
      const min = fretted.length ? Math.min(...fretted) : 0;
      const max = fretted.length ? Math.max(...fretted) : 0;
      if (max - min > maxSpan) continue;
      const pcs = new Set(fr.map((x, i) => (REF_OPEN[i] + x) % 12));
      if (!need.every((p) => pcs.has(p))) continue;
      const missing = q.iv.filter((i) => !pcs.has((refRoot + i) % 12)).length;
      const atMin = fr.reduce((acc, x, i) => (x === min && min > 0 ? acc.concat(i) : acc), []);
      let barre = false;
      if (atMin.length >= 2) {
        barre = true;
        for (let i = atMin[0]; i <= atMin[atMin.length - 1]; i++) if (fr[i] === 0) barre = false;
      }
      const fingers = fretted.length - (barre ? atMin.length - 1 : 0);
      if (fingers > 4) continue;
      let cost = (maxSpan > 3 || maxFret > 12 ? 4 : 0) + fingers * 0.8 + (max - min) * 0.7 + min * 0.55 + missing * 1.5 + (barre ? 0.6 : 0);
      const shape = fr.join('');
      if (common === shape && max < 10) cost -= 5;
      out.push({ frets: fr, cost, shape: fr.map((x) => x.toString(36)).join('') });
    }
    }
    out.sort((x, y) => x.cost - y.cost);
    voicingCache.set(cacheKey, out);
    return out;
  }

  function moveCost(a, b) {
    let m = 0;
    for (let i = 0; i < 4; i++) {
      if (a[i] === 0 || b[i] === 0) m += 0.4; else m += Math.abs(a[i] - b[i]);
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
      const pinned = opts.overrides && opts.overrides[ch.label];
      const all = voicingsFor(ch, opts.tuning);
      if (pinned) {
        const v = all.find((x) => x.shape === pinned);
        if (v) return [v];
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
  function parseStrumToken(tok) {
    if (/^[-_]$/.test(tok)) return { type: 'rest' };
    if (/^[pP]$/.test(tok)) return { type: 'thumb' };
    if (/^[tT]$/.test(tok)) return { type: 'tap' };
    if (/^[1-4](\+[1-4])*$/.test(tok)) return { type: 'pick', strings: [...new Set(tok.split('+').map(Number))] };
    const chunk = /^[xX]([bdhu↓↑])?$/i.exec(tok);
    if (chunk) return { type: 'chunk', dir: chunk[1] ? STROKE_DIR[chunk[1].toLowerCase()] : 'down' };
    const ghost = /^\((.+)\)$/.exec(tok);
    const m = /^([bdhuBDHU↓↑])([1-3])?([.!])?$/.exec(ghost ? ghost[1] : tok);
    if (!m) return null;
    const upper = m[1] !== m[1].toLowerCase();
    const level = ghost ? 'ghost' : m[3] === '.' ? 'soft' : (m[3] === '!' || upper) ? 'strong' : 'normal';
    return { type: 'stroke', dir: STROKE_DIR[m[1].toLowerCase()], level, count: m[2] ? +m[2] : 4 };
  }
  function strumToText(s) {
    if (s.type === 'thumb') return 'p';
    if (s.type === 'tap') return 't';
    if (s.type === 'pick') return s.strings.join('+');
    if (s.type === 'chunk') return s.dir === 'up' ? 'xh' : 'x';
    if (s.type !== 'stroke') return '-';
    const body = (s.dir === 'up' ? 'h' : 'b') + (s.count < 4 ? s.count : '');
    if (s.level === 'ghost') return '(' + body + ')';
    if (s.level === 'strong') return body[0].toUpperCase() + body.slice(1);
    return body + (s.level === 'soft' ? '.' : '');
  }
  /* Les cordes sont frappées dans l'ordre du geste : un coup court vers le bas ne touche que les cordes du haut du manche. */
  function strumNotes(s, frets) {
    const note = (i, muted) => (muted ? { string: i, fret: 0, muted: true } : { string: i, fret: frets[i] });
    if (s.type === 'rest') return { notes: [], strum: null };
    if (s.type === 'tap') return { notes: [], strum: s };
    if (s.type === 'thumb') return { notes: [note(0)], strum: s };
    if (s.type === 'pick') return { notes: s.strings.map((n) => note(4 - n)), strum: s };
    if (s.level === 'ghost') return { notes: [], strum: s };
    const order = s.dir === 'up' ? [3, 2, 1, 0] : [0, 1, 2, 3];
    return { notes: order.slice(0, s.type === 'chunk' ? 4 : s.count).map((i) => note(i, s.type === 'chunk')), strum: s };
  }
  /* Compteur sous les flèches : 1 & 2 & en noires, 1 2 3 4 5 6 en 6/8. */
  function beatLabel(start, meterKey) {
    const meter = METERS[meterKey] || METERS['4/4'];
    if (meter.value === 8) return start % 2 ? '' : String(start / 2 + 1);
    return start % 4 === 0 ? String(start / 4 + 1) : start % 4 === 2 ? '&' : '';
  }

  function parsePattern(text, kind) {
    if (kind === 'strum') {
      const errors = [];
      const steps = String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((tok) => {
        const s = parseStrumToken(tok);
        if (!s) errors.push(tok);
        return s || { type: 'rest' };
      });
      return { steps, errors };
    }
    const valid = kind === 'degrees' ? /^(T|3|5|7)$/ : /^[1-4]$/;
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
    return ((REF_OPEN[i] + frets[i] - refRoot) % 12 + 12) % 12;
  }

  /* Trouve la corde qui porte le degré voulu dans le doigté retenu (avec repli si la note manque). */
  function stringForDegree(token, frets, chord, tuning) {
    const iv = frets.map((_, i) => degreeOfString(frets, i, chord, tuning));
    const pitches = frets.map((f, i) => tuning.midi[i] + f);
    const lookup = {
      T: [0], 3: [3, 4, 2, 5], 5: [7, 6, 8], 7: [10, 11, 9, 2],
    }[token];
    for (const want of lookup) {
      const hits = iv.map((v, i) => (v === want ? i : -1)).filter((i) => i >= 0);
      if (hits.length) return hits.reduce((a, b) => (pitches[b] < pitches[a] ? b : a));
    }
    // Note absente : la corde la plus aiguë pour 7, la plus grave sinon.
    const order = pitches.map((_, i) => i).sort((a, b) => pitches[a] - pitches[b]);
    return token === '7' ? order[3] : order[0];
  }

  /* cfg.sections, s'il existe, donne à chaque partie ses accords et son motif ; sinon tout le morceau est une seule partie. */
  function buildScore(cfg) {
    const meter = METERS[cfg.meter] || METERS['4/4'];
    const tuningKey = TUNINGS[cfg.tuning] ? cfg.tuning : 'standard';
    const tuning = TUNINGS[tuningKey];
    const sections = (cfg.sections && cfg.sections.length ? cfg.sections : [cfg]).map((s) => ({
      name: s.name || '', kind: s.patternKind, subdivision: s.subdivision, parsed: parseChordText(s.chords), pat: parsePattern(s.pattern, s.patternKind),
    }));
    const unknown = sections.flatMap((s) => s.parsed.unknown);
    const patErrors = sections.flatMap((s) => s.pat.errors);
    const problems = [];
    if (unknown.length) problems.push('Accords non reconnus : ' + [...new Set(unknown)].join(', '));
    if (patErrors.length) problems.push('Motif : symboles ignorés (' + [...new Set(patErrors)].join(', ') + ')');
    if (!sections.some((s) => s.parsed.bars.length)) problems.push('Saisis au moins un accord.');
    if (sections.some((s) => !s.pat.steps.length)) problems.push('Le motif est vide.');
    const score = { title: cfg.title || '', meter: cfg.meter in METERS ? cfg.meter : '4/4', tuning: tuningKey, bars: [], voicings: [], problems, source: 'generated' };
    if (!sections.some((s) => s.parsed.bars.length) || sections.some((s) => !s.pat.steps.length)) return score;
    sections.forEach((s) => { s.bars = s.parsed.bars.map((b) => b.map((c) => transposeChord(c, cfg.transpose || 0))); });
    const flat = sections.flatMap((s) => s.bars.flat());
    let voicings;
    try { voicings = chooseVoicings(flat, { mode: cfg.mode, position: cfg.position, tuning: tuningKey, overrides: cfg.overrides }); }
    catch (e) { problems.push(e.message); return score; }
    let idx = 0;
    const seen = new Set();
    for (const sec of sections) sec.bars.forEach((chords, barIndex) => {
      const pat = sec.pat;
      const stepUnits = sec.subdivision === '16' ? 1 : 2;
      const stepsPerBar = Math.floor(meter.units / stepUnits);
      const events = [];
      chords.forEach((chord, ci) => {
        const v = voicings[idx++];
        if (!seen.has(chord.label)) { seen.add(chord.label); score.voicings.push({ chord, frets: v.frets, shape: v.shape }); }
        const startStep = Math.round(ci * stepsPerBar / chords.length);
        const endStep = Math.round((ci + 1) * stepsPerBar / chords.length);
        for (let s = startStep; s < endStep; s++) {
          const tok = pat.steps[(s - startStep) % pat.steps.length];
          const label = s === startStep ? chord.label : null;
          if (sec.kind === 'strum') {
            const { notes, strum } = strumNotes(tok, v.frets);
            if (notes.length || label || strum) events.push({ start: s * stepUnits, dur: stepUnits, notes, chord: label, frets: label ? v.frets : null, strum });
            continue;
          }
          const strs = [...new Set(tok.map((t) => (sec.kind === 'degrees' ? stringForDegree(t, v.frets, chord, tuning) : 4 - +t)))];
          if (strs.length || label) {
            events.push({ start: s * stepUnits, dur: stepUnits, notes: strs.map((i) => ({ string: i, fret: v.frets[i] })), chord: label, frets: label ? v.frets : null });
          }
        }
      });
      score.bars.push(barIndex === 0 && sec.name ? { events, section: sec.name } : { events });
    });
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
  function parseLyrics(text) {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line || /^\[[^\]]*\]$/.test(line)) return;
      line.replace(/^\|+|\|+$/g, '').split('|').forEach((s) => { const w = s.trim().replace(/\s+/g, ' '); out.push(w === '_' ? '' : w); });
    });
    return out;
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
  const SHARE_CFG = ['chords', 'pattern', 'patternKind', 'meter', 'subdivision', 'tuning', 'transpose', 'mode', 'position', 'overrides', 'tempo', 'sections', 'lyrics', 'scoreDiagrams'];
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
        scoreDiagrams: c.scoreDiagrams === true, overrides: {}, sections: null,
      };
      if (c.overrides && typeof c.overrides === 'object') {
        Object.entries(c.overrides).slice(0, 100).forEach(([k, v]) => { if (k.length <= 20 && typeof v === 'string' && /^[0-9a-z]{4}$/.test(v)) cfg.overrides[k] = v; });
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
      const bars = o.imported.bars.slice(0, 2000).map((b) => {
        const events = (b && Array.isArray(b.events) ? b.events : []).slice(0, 64).filter((e) => e && typeof e === 'object').map((e) => {
          const start = clamp(e.start, 0, units - 1, 0);
          const ev = { start, dur: clamp(e.dur, 1, units - start, 1), notes: [] };
          (Array.isArray(e.notes) ? e.notes : []).slice(0, 4).forEach((n) => {
            const str = n && typeof n === 'object' ? clamp(n.string, 0, 3, -1) : -1;
            if (str < 0 || ev.notes.some((x) => x.string === str)) return;
            ev.notes.push(n.muted === true ? { string: str, fret: 0, muted: true } : { string: str, fret: clamp(n.fret, 0, 24, 0) });
          });
          if (typeof e.chord === 'string' && e.chord) ev.chord = e.chord.slice(0, 16);
          if (Array.isArray(e.frets) && e.frets.length === 4) ev.frets = e.frets.map((f) => clamp(f, 0, 24, 0));
          if (e.strum && typeof e.strum === 'object') {
            try { const st = parseStrumToken(strumToText(e.strum)); if (st && st.type !== 'rest') ev.strum = st; } catch (x) { /* geste inconnu : ignoré */ }
          }
          return ev;
        });
        return typeof b.section === 'string' && b.section ? { events, section: b.section.slice(0, 60) } : { events };
      });
      if (!bars.length) throw new Error('morceau vide');
      return { title, imported: { title, meter, tuning: own(TUNINGS, o.imported.tuning) ? o.imported.tuning : 'standard', bars, voicings: [], problems: [], source: 'imported', lyricsText: clip(o.lyrics, 20000) } };
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
  function strumSymbol(s) {
    if (!s || s.type === 'pick') return '';
    if (s.type === 'thumb') return 'p';
    if (s.type === 'tap') return 't';
    const arrow = s.dir === 'up' ? '↑' : '↓';
    if (s.type === 'chunk') return arrow + 'x';
    if (s.level === 'ghost') return '(' + arrow + ')';
    return arrow + (s.count < 4 ? s.count : '') + (s.level === 'strong' ? '>' : s.level === 'soft' ? '·' : '');
  }
  const STRUM_LEGEND = [
    [/[↓↑]/, '↓ bas, ↑ haut'], [/>/, '> fort'], [/·/, '· doux'], [/\(/, '(↓) à vide'], [/[↓↑][123]/, '↓2 sur 2 cordes'],
    [/[↓↑]x/, '↓x étouffé'], [/(^|\s)p(\s|$)/, 'p pouce'], [/(^|\s)t(\s|$)/, 't frappe sur le bois'],
  ];

  function scoreToText(score) {
    const t = TUNINGS[score.tuning] || TUNINGS.standard;
    const units = METERS[score.meter].units;
    const blocks = [];
    const lines = () => ({ chord: '   ', strum: '   ', lyric: '', s: [3, 2, 1, 0].map((i) => t.names[i].padEnd(2).slice(0, 2) + '|') });
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
        const cell = [3, 2, 1, 0].map((i) => {
          const n = e && e.notes.find((x) => x.string === i);
          return n ? (n.muted ? 'x' : String(n.fret)) : '';
        });
        const stroke = e ? strumSymbol(e.strum) : '';
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

  function parseTabText(text, meterKey, title) {
    const meter = METERS[meterKey] || METERS['4/4'];
    const blocks = findTabBlocks(text);
    if (!blocks.length) return null;
    if (blocks.every((b) => b.length !== 4)) return { unsupported: Math.max(...blocks.map((b) => b.length)) };
    const bars = [];
    for (const blk of blocks) {
      if (blk.length !== 4) continue;
      const bodies = blk.map(bodyOf);
      const len = Math.max(...bodies.map((b) => b.length));
      const notes = new Map();
      const barCols = new Set();
      bodies.forEach((b, row) => {
        const re = /\d{1,2}|[xX]/g; let m;
        while ((m = re.exec(b))) {
          const col = m.index;
          if (!notes.has(col)) notes.set(col, []);
          notes.get(col).push(/\d/.test(m[0]) ? { string: 3 - row, fret: +m[0] } : { string: 3 - row, fret: 0, muted: true });
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
    return { title: title || '', meter: meterKey in METERS ? meterKey : '4/4', tuning: 'standard', bars, voicings: [], problems: [], source: 'imported' };
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

  function detectContent(text, meter) {
    if (isMusicXml(text)) {
      const found = findChords(text);
      return found.count ? { type: 'chords', chordsText: found.chordsText, count: found.count, title: found.title } : { type: 'unknown' };
    }
    const tab = parseTabText(text, meter);
    if (tab && tab.unsupported) return { type: 'unsupported-tab', strings: tab.unsupported };
    if (tab) return { type: 'tab', score: tab, count: tab.bars.length };
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
    const tuning = TUNINGS[tuningKey] ? tuningKey : (score.tuning || 'standard');
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
    const tab = parseTabText(text, o.meter || '4/4');
    const hasTab = tab && tab.bars;
    if (sheet.count >= (hasTab ? 2 : 1)) return { source: 'written', chordsText: sheet.chordsText, count: sheet.count, title: sheet.title, uncertain: [] };
    if (!hasTab) return { source: 'none' };
    const d = detectChords(tab, o.tuning);
    return Object.assign({ source: 'tab', count: d.bars.flat().length }, d);
  }

  /* ---------- Hauteurs ---------- */
  function midiOf(note, tuningKey) { return (TUNINGS[tuningKey] || TUNINGS.standard).midi[note.string] + note.fret; }

  /* Son d'une corde nylon pincée au doigt, caisse de ukulélé comprise.
     Karplus-Strong étendu : accord exact (passe-tout fractionnaire), aigus amortis en secondes et non
     par période (sinon les notes graves sonnent métalliques), excitation douce pincée vers la rosace,
     puis résonances de caisse. Hasard déterministe : une même note sonne toujours pareil. */
  const WAVE_SECONDS = 2.6;
  function pluckWave(midi, sr) {
    let seed = (midi * 2654435761) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; };
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    const N = sr / f0; const w0 = 2 * Math.PI * f0 / sr;
    const high = Math.min(1, Math.max(0, (midi - 57) / 24));
    const t60 = 3 - 1.3 * high; // durée de résonance du fondamental
    const t60Bright = 0.22; // vers 2,5 kHz, le nylon s'éteint vite
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
    biquad(out, sr, 'highpass', 85, 0.7, 0);
    biquad(out, sr, 'peak', 290, 2.2, 6);
    biquad(out, sr, 'peak', 520, 2, 3);
    biquad(out, sr, 'peak', 1100, 1.5, -2);
    biquad(out, sr, 'highshelf', 4500, 0.7, -8);
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

  const api = { TUNINGS, METERS, QUALITY, COMMON, parseChord, parseChordText, voicingsFor, chooseVoicings, generateGrid, parseGridText, romanToChord, GRID_STYLES, parsePattern, parseStrumToken, strumToText, beatLabel, stringForDegree, buildScore, eventAt, parseLyrics, printBarsPerLine, fixedLines, shareSong, readSharedSong, packSong, unpackSong, songLinkData, scoreToText, parseTabText, extractChordSheet, detectContent, findChords, detectChords, parseMusicXml, midiOf, pluckWave, spell, splitDuration, directLink, transposeChord, findTabBlocks };
  global.UkuCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
