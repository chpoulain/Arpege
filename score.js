/* Gravure avec VexFlow : portée de sol + tablature (4 lignes au ukulélé, 6 à la guitare), retours à la ligne selon la largeur. */
(function (global) {
  'use strict';
  const C = global.UkuCore;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const diagramW = (n) => (n > 4 ? 64 : 52);
  const stringsOf = (score) => C.stringCount(score.tuning);
  let cursor = null; let marks = []; let cursorLine = -1; let cursorFrame = 0; // surlignage de la lecture

  /* Un geste de rythmique, dessiné de haut en bas dans une bande de hauteur h. Sert à la partition et à l'éditeur. */
  function drawStroke(parent, cx, top, h, st, strings) {
    const all = strings || 4;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (n, a) => { const e = document.createElementNS(NS, n); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); parent.appendChild(e); return e; };
    const letter = (t, color, size) => { el('text', { x: cx, y: top + h / 2 + size * 0.35, 'text-anchor': 'middle', 'font-family': 'Arial, sans-serif', 'font-size': size, 'font-weight': 700, fill: color, stroke: 'none' }).textContent = t; };
    if (st.type === 'thumb') return letter('p', '#23211c', 18);
    if (st.type === 'tap') return letter('t', '#23211c', 18);
    if (st.type === 'pick') return letter(st.strings.join('+'), '#8d877a', st.strings.length > 1 ? 11 : 15);
    if (st.type === 'rest') return letter('–', '#b5ae9f', 15);
    const style = { strong: ['#000', 2.8, 6], normal: ['#23211c', 1.5, 4.5], soft: ['#9b9587', 1.3, 4.2], ghost: ['#d8d3c7', 1.2, 4] }[st.type === 'chunk' ? 'strong' : st.level];
    const count = Math.min(st.count || all, all);
    const frac = all === 4 ? { 4: 1, 3: 0.78, 2: 0.56, 1: 0.36 }[count] : count >= all ? 1 : 0.3 + 0.6 * (count - 1) / (all - 1);
    if (st.level === 'strong') el('rect', { x: cx - 8, y: top - 2, width: 16, height: h + 4, rx: 2, fill: '#f6d55c' });
    const down = st.dir !== 'up';
    const from = down ? top : top + h; const to = down ? top + h * frac : top + h * (1 - frac);
    const head = down ? -1 : 1;
    el('line', { x1: cx, x2: cx, y1: from, y2: to + head * style[2], stroke: style[0], 'stroke-width': style[1] });
    el('path', { d: `M${cx} ${to} L${cx - style[2] * 0.75} ${to + head * style[2] * 1.5} L${cx + style[2] * 0.75} ${to + head * style[2] * 1.5} Z`, fill: style[0] });
    if (st.type === 'chunk') {
      const y = top + h / 2 + (down ? -3 : 3);
      [[-5, -5, 5, 5], [-5, 5, 5, -5]].forEach(([a, b, c, d]) => el('line', { x1: cx + a, y1: y + b, x2: cx + c, y2: y + d, stroke: '#a32222', 'stroke-width': 2 }));
    }
    return undefined;
  }

  function buildNotes(bar, score, VF) {
    const units = C.METERS[score.meter].units;
    const flats = !!score.preferFlats;
    const N = stringsOf(score);
    const staffShift = C.TUNINGS[score.tuning] ? C.TUNINGS[score.tuning].staff : 0; // guitare : écrite une octave plus haut
    const staffNotes = []; const tabNotes = []; const labels = []; const strokes = []; const marks = [];
    const barAcc = new Map(); // altérations déjà écrites dans la mesure, par note + octave
    const pushRest = (seg) => {
      const n = new VF.StaveNote({ keys: ['b/4'], duration: seg.value + 'r', dots: seg.dots, auto_stem: true });
      if (seg.dots) VF.Dot.buildAndAttach([n], { all: true });
      staffNotes.push(n);
      const g = new VF.GhostNote({ duration: seg.value, dots: seg.dots });
      tabNotes.push(g);
    };
    const pushGap = (len) => C.splitDuration(len).forEach(pushRest);
    let t = 0;
    for (const ev of bar.events) {
      if (ev.start > t) pushGap(ev.start - t);
      marks.push(staffNotes.length);
      if (ev.strum) strokes.push({ index: staffNotes.length, strum: ev.strum, start: ev.start });
      if (!ev.notes.length) {
        const segs = C.splitDuration(ev.dur);
        if (ev.chord) labels.push({ index: staffNotes.length, text: ev.chord, frets: ev.frets });
        segs.forEach(pushRest);
        t = ev.start + ev.dur;
        continue;
      }
      const segs = C.splitDuration(ev.dur);
      const seg = segs[0];
      const muted = ev.notes.every((n) => n.muted);
      // Deux cordes peuvent donner la même note : une seule tête sur la portée.
      const heights = muted ? [] : [...new Set(ev.notes.filter((n) => !n.muted).map((n) => C.midiOf(n, score.tuning) + staffShift))].sort((a, b) => a - b);
      const spelled = heights.map((m) => C.spell(m, flats));
      const sn = new VF.StaveNote({
        keys: muted ? ['b/4/x'] : spelled.map((s) => s.letter + (s.accidental === '#' ? '#' : s.accidental === 'b' ? 'b' : '') + '/' + s.octave),
        duration: seg.value, dots: seg.dots, auto_stem: true,
      });
      spelled.forEach((s, i) => {
        const slot = s.letter + s.octave;
        const prev = barAcc.get(slot) || '';
        if (s.accidental !== prev) {
          sn.addModifier(new VF.Accidental(s.accidental || 'n'), i);
          barAcc.set(slot, s.accidental);
        }
      });
      if (seg.dots) VF.Dot.buildAndAttach([sn], { all: true });
      if (ev.chord) labels.push({ index: staffNotes.length, text: ev.chord, frets: ev.frets });
      staffNotes.push(sn);
      const positions = ev.notes.map((n) => ({ str: N - n.string, fret: n.muted ? 'X' : n.fret })).sort((a, b) => a.str - b.str);
      const tn = new VF.TabNote({ positions, duration: seg.value, dots: seg.dots }, false);
      tabNotes.push(tn);
      segs.slice(1).forEach(pushRest);
      t = ev.start + ev.dur;
    }
    if (t < units) pushGap(units - t);
    return { staffNotes, tabNotes, labels, strokes, marks };
  }

  function layoutBars(score, width, withDiagrams) {
    const DIAGRAM_W = diagramW(stringsOf(score));
    // Largeur minimale proportionnelle au nombre de notes écrites.
    const units = C.METERS[score.meter].units;
    const needs = score.bars.map((b) => Math.max(
      (b.events.some((e) => e.strum && e.dur === 1) ? 22 * units + 26 : 0) || Math.max(120, 28 * Math.max(b.events.filter((e) => e.notes.length || e.strum).length, 2) + 26),
      withDiagrams ? (DIAGRAM_W + 6) * b.events.filter((e) => e.frets).length + 26 : 0,
    ));
    const lines = []; let cur = []; let used = 76;
    needs.forEach((need, i) => {
      if (cur.length && (score.bars[i].section || used + need > width - 16)) { lines.push(cur); cur = []; used = 76; }
      cur.push(i); used += need;
    });
    if (cur.length) lines.push(cur);
    return { lines, needs };
  }

  /* Hauteurs communes à toutes les lignes, et largeur minimale pour des lignes imposées (PDF, vidéo). */
  function geometry(score, view, opts) {
    opts = opts || {};
    const showStaff = view !== 'tab'; const showTab = view !== 'notation';
    const withDiagrams = !!opts.diagrams && score.bars.some((b) => b.events.some((e) => e.frets));
    const lyrics = opts.lyrics || [];
    const withLyrics = score.bars.some((b, i) => lyrics[i]);
    const diagramExtra = withDiagrams ? 70 : 0; // bande des diagrammes, au-dessus de la portée
    // Accordages graves : notes sous la portée, donc plus d'espace avant la tablature.
    const N = stringsOf(score);
    const lowExtra = N > 4 ? 40 : score.tuning === 'lowg' || score.tuning === 'baritone' ? 28 : 0;
    const tabExtra = (N - 4) * 13; // lignes de tablature en plus
    const hasStrum = score.bars.some((b) => b.events.some((e) => e.strum));
    const strumExtra = hasStrum ? 56 : 0; // bande des flèches et du compteur
    const tabOffset = (showStaff ? 66 + lowExtra : -12) + strumExtra; // décalage du haut de la tablature par rapport à la portée
    const bottom = showTab ? tabOffset + 52 + 39 + tabExtra : 112 + lowExtra + strumExtra;
    const sectionExtra = score.bars.some((b) => b.section) ? 16 : 0; // place du nom de la partie
    const lyricsExtra = withLyrics ? 22 : 0;
    const lineH = 12 + bottom + 26 + sectionExtra + diagramExtra + lyricsExtra;
    const { needs } = layoutBars(score, 1e6, withDiagrams);
    const minWidth = opts.lines ? Math.max(...opts.lines.map((l) => 92 + l.reduce((s, i) => s + needs[i], 0))) : 0;
    return { showStaff, showTab, withDiagrams, lyrics, diagramExtra, lowExtra, hasStrum, tabOffset, sectionExtra, lineH, minWidth, strings: N };
  }

  /* Écran : la partition se cale sur la largeur disponible et garde le surlignage de la lecture. */
  function render(container, score, view, opts) {
    const out = draw(container, score, view, opts);
    cursor = out ? out.cursor : null;
    marks = out ? out.marks : [];
  }

  /* Dessine la partition. opts.lines et opts.perLine imposent la mise en page, opts.width la largeur du dessin. */
  function draw(container, score, view, opts) {
    const VF = global.Vex.Flow;
    opts = opts || {};
    container.innerHTML = '';
    if (!score.bars.length) return null;
    const g = geometry(score, view, opts);
    const { showStaff, showTab, withDiagrams, lyrics, diagramExtra, lowExtra, hasStrum, tabOffset, sectionExtra, lineH } = g;
    const N = g.strings; const DIAGRAM_W = diagramW(N);
    // En dessous de 520 px on dessine plus large puis on réduit, pour garder des mesures lisibles.
    const width = opts.width ? Math.max(opts.width, g.minWidth) : Math.max(container.clientWidth, 320, 460);
    const { lines: autoLines, needs } = layoutBars(score, width, withDiagrams);
    const lines = opts.lines || autoLines;
    const marks = []; const lineTops = []; const lineOfBar = [];
    const height = lineH * lines.length + 8;
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    const svg = container.querySelector('svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.style.width = '100%'; svg.style.height = 'auto';
    const meter = C.METERS[score.meter];
    // Surlignage de la note jouée : premier élément du dessin, donc derrière les notes.
    const cursorEl = document.createElementNS(SVG_NS, 'rect');
    [['class', 'no-print'], ['display', 'none'], ['rx', 3], ['fill', '#5f5b52'], ['fill-opacity', 0.2]].forEach(([k, v]) => cursorEl.setAttribute(k, v));
    svg.insertBefore(cursorEl, svg.firstChild);

    lines.forEach((line, li) => {
      lineTops.push(li * lineH);
      line.forEach((b) => { lineOfBar[b] = li; });
      const yTop = 6 + li * lineH + sectionExtra + diagramExtra;
      let diagramRight = 0; // bord droit du dernier diagramme de la ligne : ils ne se chevauchent jamais
      const sectionName = score.bars[line[0]].section;
      if (sectionName) {
        ctx.save();
        ctx.setFont('Arial', 12, 'bold');
        ctx.setFillStyle('#6d675b');
        ctx.fillText(sectionName, 10, yTop - diagramExtra - 3);
        ctx.restore();
      }
      const yStaff = yTop - 12; const yTab = yStaff + tabOffset;
      const startX = 8; const usable = width - startX - 8;
      const totalNeed = line.reduce((s, i) => s + needs[i], 0);
      // Fin de morceau ou de partie, ligne incomplète : pas d'étirement excessif.
      const closes = li === lines.length - 1 || !!score.bars[lines[li + 1][0]].section;
      const head = 70;
      let fill = closes && lines.length > 1 && (line.length === 1 || sectionExtra) ? Math.min(usable, totalNeed * 1.7 + 70) : usable;
      // Mise en page imposée : une ligne courte garde la largeur de mesure des lignes pleines.
      if (opts.perLine) fill = line.length >= opts.perLine ? usable : head + (usable - head) * line.length / opts.perLine;
      let x = startX;
      line.forEach((barIdx, k) => {
        const w = k === 0 ? head + (fill - head) * needs[barIdx] / totalNeed : (fill - head) * needs[barIdx] / totalNeed;
        const staff = showStaff ? new VF.Stave(x, yStaff, w) : null;
        const tab = showTab ? new VF.TabStave(x, yTab, w, { num_lines: N }) : null;
        if (k === 0) {
          if (staff) { staff.addClef('treble'); if (barIdx === 0) staff.addTimeSignature(score.meter); }
        }
        if (barIdx === score.bars.length - 1) {
          if (staff) staff.setEndBarType(VF.Barline.type.END);
          if (tab) tab.setEndBarType(VF.Barline.type.END);
        }
        // Sans clé de tablature (son dessin déborde sur 4 lignes) : on réserve la place de « TAB », écrit à la main plus bas.
        const noteStart = Math.max(staff ? staff.getNoteStartX() : 0, tab ? tab.getNoteStartX() + (k === 0 ? (!staff && barIdx === 0 ? 40 : 22) : 0) : 0);
        if (staff) staff.setNoteStartX(noteStart);
        if (tab) tab.setNoteStartX(noteStart);
        if (staff) staff.setContext(ctx).draw();
        if (tab) tab.setContext(ctx).draw();
        if (staff && tab && k === 0) {
          new VF.StaveConnector(staff, tab).setType(VF.StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
        }
        if (tab && k === 0) {
          ctx.save();
          ctx.setFont('Arial', 12, 'bold');
          ctx.setFillStyle('#23211c');
          const tabTop = tab.getYForLine(0) + (N - 4) * 6.5; // « TAB » centré sur la hauteur de la tablature
          ['T', 'A', 'B'].forEach((ch, i) => ctx.fillText(ch, x + 7, tabTop + 7 + i * 13));
          // Sans portée, la mesure s'écrit à côté de « TAB » : dessinée par VexFlow, elle le recouvrirait.
          if (!staff && barIdx === 0) {
            ctx.setFont('Georgia', 17, 'bold');
            score.meter.split('/').forEach((d, i) => ctx.fillText(d, x + 24, tabTop + 14 + i * 19));
          }
          ctx.restore();
        }
        const { staffNotes, tabNotes, labels, strokes, marks: barMarks } = buildNotes(score.bars[barIdx], score, VF);
        const mk = (notes) => new VF.Voice({ num_beats: meter.beats, beat_value: meter.value }).setMode(VF.Voice.Mode.SOFT).addTickables(notes);
        const vStaff = showStaff ? mk(staffNotes) : null;
        const vTab = showTab ? mk(tabNotes) : null;
        let beams = [];
        if (showStaff) {
          beams = VF.Beam.generateBeams(staffNotes, { groups: VF.Beam.getDefaultBeamGroups(score.meter) });
        }
        const voices = [vStaff, vTab].filter(Boolean);
        const fmt = new VF.Formatter();
        voices.forEach((v) => fmt.joinVoices([v]));
        const area = (x + w) - noteStart - 14;
        fmt.format(voices, Math.max(area, 40));
        if (vStaff) vStaff.draw(ctx, staff);
        if (vTab) vTab.draw(ctx, tab);
        beams.forEach((b) => b.setContext(ctx).draw());
        const refNotes = showStaff ? staffNotes : tabNotes;
        if (withDiagrams) {
          labels.forEach((l) => {
            const left = Math.min(Math.max(refNotes[l.index].getAbsoluteX() + 5 - DIAGRAM_W / 2, diagramRight), width - DIAGRAM_W);
            drawChordBox(svg, left, yTop - diagramExtra + 8, l.text, l.frets);
            diagramRight = left + DIAGRAM_W + 2;
          });
        } else {
          ctx.save();
          ctx.setFont('Arial', 13, 'bold');
          ctx.setFillStyle('#0f6b63');
          labels.forEach((l) => {
            const n = refNotes[l.index];
            ctx.fillText(l.text, n.getAbsoluteX() - 4, yTop + 12);
          });
          ctx.restore();
        }
        const bandTop = tab ? tab.getYForLine(0) - 58 : staff.getYForLine(4) + 36 + lowExtra;
        const markTop = staff ? staff.getYForLine(0) - 6 : (hasStrum ? bandTop - 4 : tab.getYForLine(0) - 6);
        const markBottom = tab ? tab.getYForLine(N - 1) + 6 : (hasStrum ? bandTop + 46 : staff.getYForLine(4) + 6 + lowExtra);
        marks[barIdx] = barMarks.map((i) => ({ x: refNotes[i].getAbsoluteX() + 5, line: li, top: markTop, bottom: markBottom }));
        if (lyrics[barIdx]) drawLyric(svg, lyrics[barIdx], noteStart, markBottom + 17, (x + w) - noteStart - 8);
        strokes.forEach((st) => {
          const cx = refNotes[st.index].getAbsoluteX() + 5;
          drawStroke(svg, cx, bandTop, 30, st.strum, N);
          const beat = C.beatLabel(st.start, score.meter);
          if (!beat) return;
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          [['x', cx], ['y', bandTop + 42], ['text-anchor', 'middle'], ['font-family', 'Arial, sans-serif'], ['font-size', 10], ['font-weight', beat === '&' ? 400 : 700], ['fill', '#6d675b'], ['stroke', 'none']].forEach(([k, v]) => t.setAttribute(k, v));
          t.textContent = beat;
          svg.appendChild(t);
        });
        x += w;
      });
    });
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', 'Partition de ' + score.bars.length + ' mesures');
    return { svg, cursor: cursorEl, marks, lineTops, lineOfBar, lineH, width, height };
  }

  /* Paroles d'une mesure, réduites puis resserrées si elles dépassent la mesure. */
  function drawLyric(svg, text, x, y, avail) {
    const t = document.createElementNS(SVG_NS, 'text');
    [['x', x], ['y', y], ['font-family', 'Georgia, "Noto Serif", serif'], ['font-size', 14], ['fill', '#23211c'], ['stroke', 'none']].forEach(([k, v]) => t.setAttribute(k, v));
    t.textContent = text;
    svg.appendChild(t);
    const len = t.getComputedTextLength ? t.getComputedTextLength() : 0;
    if (!len || len <= avail) return;
    const size = Math.max(10, 14 * avail / len);
    t.setAttribute('font-size', size.toFixed(1));
    if (len * size / 14 > avail) { t.setAttribute('textLength', Math.max(avail, 10).toFixed(1)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  }

  /* Petit diagramme d'accord (SVG construit en DOM : le libellé peut venir d'un fichier en ligne). */
  function diagram(frets) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const H = 68;
    const W = diagramW(frets.length);
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('data-strings', frets.length);
    drawFrets(svg, frets);
    return svg;
  }
  /* Le même diagramme, posé dans la partition avec le nom de l'accord au-dessus. */
  function drawChordBox(parent, left, baseline, name, frets) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', 'translate(' + left + ' ' + baseline + ')');
    const t = document.createElementNS(SVG_NS, 'text');
    [['x', diagramW(frets.length) / 2 + 0.5], ['y', 0], ['text-anchor', 'middle'], ['font-family', 'Arial, sans-serif'], ['font-size', 13], ['font-weight', 700], ['fill', '#0f6b63'], ['stroke', 'none']].forEach(([k, v]) => t.setAttribute(k, v));
    t.textContent = name;
    g.appendChild(t);
    const box = document.createElementNS(SVG_NS, 'g');
    box.setAttribute('transform', 'translate(0 1)');
    box.setAttribute('stroke-width', 1); // sinon hérité du dessin de VexFlow : traits trop fins
    drawFrets(box, frets);
    g.appendChild(box);
    parent.appendChild(g);
  }
  function drawFrets(svg, frets) {
    const el = (n, a, parent) => { const e = document.createElementNS(SVG_NS, n); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); parent.appendChild(e); return e; };
    const fretted = frets.filter((f) => f > 0);
    const max = fretted.length ? Math.max(...fretted) : 0;
    const base = max <= 4 ? 1 : Math.min(...fretted);
    const n = frets.length; const step = n > 4 ? 8 : 11; const dot = n > 4 ? 3.4 : 4.2;
    const x = (i) => 10 + i * step; const y = (f) => 14 + f * 12;
    for (let i = 0; i <= 4; i++) el('line', { x1: x(0), x2: x(n - 1), y1: y(i), y2: y(i), stroke: i === 0 && base === 1 ? '#23211c' : '#9a927f', 'stroke-width': i === 0 && base === 1 ? 2.5 : 1 }, svg);
    for (let i = 0; i < n; i++) el('line', { x1: x(i), x2: x(i), y1: y(0), y2: y(4), stroke: '#9a927f' }, svg);
    frets.forEach((f, i) => {
      if (f < 0) { // corde non jouée
        [[-2.6, -2.6, 2.6, 2.6], [-2.6, 2.6, 2.6, -2.6]].forEach(([a, b, c, d]) => el('line', { x1: x(i) + a, y1: 7 + b, x2: x(i) + c, y2: 7 + d, stroke: '#23211c', 'stroke-width': 1.2 }, svg));
      } else if (f === 0) el('circle', { cx: x(i), cy: 7, r: n > 4 ? 2.6 : 3, fill: 'none', stroke: '#23211c' }, svg);
      else el('circle', { cx: x(i), cy: y(f - base + 0.5), r: dot, fill: '#23211c' }, svg);
    });
    if (base > 1) { const t = el('text', { x: x(n - 1) + (n > 4 ? 4 : 0), y: y(0.8), 'font-size': 10, fill: '#6d675b', stroke: 'none' }, svg); t.textContent = base; }
  }

  /* Son : corde nylon synthétisée (C.pluckWave), mise en cache par hauteur, puis petite pièce et limiteur.
     master → (direct + réverbération) → limiteur → out → haut-parleurs (et vidéo). */
  let audioCtx = null; let master = null; let out = null; const bufs = new Map(); let sources = []; let stopTimer = null;
  function room(ctx) {
    const sr = ctx.sampleRate; const len = Math.floor(sr * 1.3); const pre = Math.floor(sr * 0.012);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr;
        lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.35 * Math.min(1, t / 0.8)); // la queue s'assombrit
        d[i] = lp * Math.exp(-6.9 * t / 0.9);
      }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    return conv;
  }
  function ensureAudio() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      audioCtx = new AC();
      master = audioCtx.createGain();
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 8;
      limiter.attack.value = 0.003; limiter.release.value = 0.15;
      out = audioCtx.createGain();
      const wet = audioCtx.createGain(); wet.gain.value = 0.22;
      master.connect(limiter);
      try { master.connect(room(audioCtx)).connect(wet).connect(limiter); } catch (e) { /* sans réverbération */ }
      limiter.connect(out); out.connect(audioCtx.destination);
    }
    audioCtx.resume();
    return audioCtx;
  }
  /* Copie du son joué, pour l'enregistrement vidéo. */
  function captureAudio() {
    if (!ensureAudio()) return null;
    const dest = audioCtx.createMediaStreamDestination();
    out.connect(dest);
    return dest;
  }
  function releaseAudio(dest) { try { out.disconnect(dest); } catch (e) { /* déjà détaché */ } }
  function pluck(midi, instrument) {
    const key = instrument + midi;
    if (bufs.has(key)) return bufs.get(key);
    const sr = audioCtx.sampleRate; const wave = C.pluckWave(midi, sr, instrument);
    const buf = audioCtx.createBuffer(1, wave.length, sr);
    buf.getChannelData(0).set(wave);
    bufs.set(key, buf);
    return buf;
  }
  /* Frappe sur le bois : bruit court, filtré dans le grave. */
  function tap(at) {
    const sr = audioCtx.sampleRate; const buf = audioCtx.createBuffer(1, Math.floor(sr * 0.05), sr); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = audioCtx.createGain(); g.gain.value = 0.9;
    src.connect(f).connect(g).connect(master);
    src.start(at); sources.push(src);
  }
  /* Déplace le surlignage ; à chaque nouvelle ligne, la ramène à l'écran si elle en est sortie. */
  function showCursor(pos) {
    if (!cursor) return;
    const m = pos && marks[pos.bar] && marks[pos.bar][pos.index];
    if (!m) { cursor.setAttribute('display', 'none'); return; }
    [['x', m.x - 11], ['y', m.top], ['width', 22], ['height', m.bottom - m.top]].forEach(([k, v]) => cursor.setAttribute(k, v));
    cursor.removeAttribute('display');
    if (m.line === cursorLine) return;
    cursorLine = m.line;
    const r = cursor.getBoundingClientRect();
    if (!r.height) return; // page Partition quittée pendant la lecture
    if (r.top < 70 || r.bottom > global.innerHeight - 140) {
      const calm = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      global.scrollBy({ top: r.top - 90, behavior: calm ? 'auto' : 'smooth' });
    }
  }
  function follow(score, start, unitSec) {
    const total = score.bars.length * C.METERS[score.meter].units;
    const latency = audioCtx.outputLatency || audioCtx.baseLatency || 0;
    cursorLine = -1;
    const tick = () => {
      const unit = (audioCtx.currentTime - latency - start) / unitSec;
      if (unit >= total) { showCursor(null); return; }
      showCursor(unit >= 0 ? C.eventAt(score, unit) : null);
      cursorFrame = global.requestAnimationFrame(tick);
    };
    cursorFrame = global.requestAnimationFrame(tick);
  }
  function stop() {
    global.cancelAnimationFrame(cursorFrame);
    showCursor(null);
    sources.forEach((s) => { try { s.stop(); } catch (e) { /* déjà fini */ } });
    sources = []; clearTimeout(stopTimer);
  }
  /* o.lead : délai avant la première note (s) ; o.follow : surlignage de la partition à l'écran. */
  function play(score, bpm, onEnd, o) {
    o = o || {};
    if (!ensureAudio()) return null;
    stop();
    const meter = C.METERS[score.meter];
    const unitSec = 60 / bpm / 4; // bpm à la noire ; 1 unité = double-croche
    const start = audioCtx.currentTime + (o.lead || 0.08);
    const instrument = C.TUNINGS[score.tuning] ? C.TUNINGS[score.tuning].instrument : 'ukulele';
    const ringing = new Map(); // corde → son en cours : un nouveau coup sur la corde arrête le précédent
    score.bars.forEach((bar, bi) => bar.events.forEach((ev) => {
      const at = start + (bi * meter.units + ev.start) * unitSec;
      const st = ev.strum;
      if (st && st.type === 'tap') { tap(at); return; }
      const level = st && st.type === 'stroke' ? st.level : null;
      const gap = ev.notes.length > 1 && st ? { strong: 0.007, soft: 0.016 }[level] || 0.011 : 0;
      const vol = st ? { strong: 0.6, normal: 0.4, soft: 0.2 }[level] || 0.5 : 0.55;
      ev.notes.forEach((n, i) => {
        const when = at + i * gap;
        const src = audioCtx.createBufferSource();
        src.buffer = pluck(C.midiOf(n, score.tuning), instrument);
        const g = audioCtx.createGain(); g.gain.value = vol;
        src.connect(g).connect(master);
        src.start(when);
        if (n.muted) { g.gain.setValueAtTime(0.35, when); g.gain.linearRampToValueAtTime(0, when + 0.05); src.stop(when + 0.06); }
        if (st) {
          const prev = ringing.get(n.string);
          if (prev) { prev.gain.setValueAtTime(prev.gain.value, when); prev.gain.linearRampToValueAtTime(0, when + 0.025); }
          ringing.set(n.string, g);
        }
        sources.push(src);
      });
    }));
    if (o.follow !== false) follow(score, start, unitSec);
    const end = start + score.bars.length * meter.units * unitSec;
    if (onEnd) stopTimer = setTimeout(onEnd, (end - audioCtx.currentTime + 1.2) * 1000);
    return { ctx: audioCtx, start, unitSec, end };
  }

  global.UkuScore = { render, draw, geometry, diagram, play, stop, drawStroke, captureAudio, releaseAudio };
})(window);
