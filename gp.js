/* Fichiers Guitar Pro : export .gpx (Guitar Pro 6, lu aussi par Guitar Pro 7 et 8, MuseScore, alphaTab),
   import .gpx et .gp (Guitar Pro 7 et 8). Les deux contiennent la partition au format XML « GPIF ». */
(function (global) {
  'use strict';
  const C = global.UkuCore || (typeof require === 'function' ? require('./core.js') : null);

  /* ---------- XML : lecture minimale (éléments, attributs, texte, CDATA) ---------- */
  function parseXml(text) {
    const root = { name: '#root', attrs: {}, children: [], text: '' };
    const stack = [root];
    const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(text))) {
      const top = stack[stack.length - 1];
      if (m[1] !== undefined) top.text += m[1];
      else if (m[2]) { if (stack.length > 1) stack.pop(); }
      else if (m[3]) {
        const el = { name: m[3], attrs: {}, children: [], text: '' };
        const ar = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let a;
        while ((a = ar.exec(m[4] || ''))) el.attrs[a[1]] = unescape(a[2] !== undefined ? a[2] : a[3]);
        top.children.push(el);
        if (!m[5]) stack.push(el);
      } else if (m[6]) top.text += unescape(m[6]);
    }
    return root;
  }
  function unescape(s) {
    return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()]
      || String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1))));
  }
  const kid = (el, name) => (el ? el.children.find((c) => c.name === name) : undefined);
  const kids = (el, name) => (el ? el.children.filter((c) => c.name === name) : []);
  const txt = (el) => (el ? el.text.trim() : '');
  const path = (el, ...names) => names.reduce((e, n) => kid(e, n), el);
  const prop = (el, name) => kids(kid(el, 'Properties'), 'Property').find((p) => p.attrs.name === name);

  /* ---------- Conteneur .gpx ---------- */
  const SECTOR = 4096;
  const ascii = (b, o, n) => String.fromCharCode(...b.subarray(o, o + n));
  const int32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;

  /* Décompression « BCFZ » : suite de bits, copies brutes ou reprises d'octets déjà écrits. */
  function bcfzDecompress(src) {
    const expected = int32(src, 4);
    const out = new Uint8Array(expected); let n = 0;
    let pos = 8 * 8; // position en bits, après « BCFZ » et la longueur
    const bit = () => { const v = (src[pos >> 3] >> (7 - (pos & 7))) & 1; pos++; return v; };
    const bits = (k) => { let v = 0; for (let i = k - 1; i >= 0; i--) v |= bit() << i; return v; };
    const rbits = (k) => { let v = 0; for (let i = 0; i < k; i++) v |= bit() << i; return v; };
    while (n < expected && (pos >> 3) < src.length) {
      if (bit()) {
        const word = bits(4); const offset = rbits(word); const size = rbits(word);
        const from = n - offset; const count = Math.min(offset, size);
        for (let i = 0; i < count && n < expected; i++) out[n++] = out[from + i];
      } else {
        const size = rbits(2);
        for (let i = 0; i < size && n < expected; i++) out[n++] = bits(8);
      }
    }
    return out.subarray(0, n);
  }
  /* Système de fichiers « BCFS » : secteurs de 4 Ko, une fiche par fichier suivie de ses données. */
  function bcfsFiles(body) {
    const files = {};
    let offset = SECTOR;
    while (offset + 3 < body.length) {
      if (int32(body, offset) === 2) {
        let name = ''; for (let i = 0; i < 127 && body[offset + 4 + i]; i++) name += String.fromCharCode(body[offset + 4 + i]);
        const size = int32(body, offset + 140);
        const parts = []; let k = 0; let sector; const pointers = offset + 148;
        while ((sector = int32(body, pointers + 4 * k++)) !== 0) { parts.push(body.subarray(sector * SECTOR, sector * SECTOR + SECTOR)); offset = sector * SECTOR; }
        const data = new Uint8Array(size); let n = 0;
        for (const p of parts) { const take = Math.min(p.length, size - n); data.set(p.subarray(0, take), n); n += take; }
        files[name] = data;
      }
      offset += SECTOR;
    }
    return files;
  }

  /* ---------- Conteneur .gp (zip) ---------- */
  async function unzipEntry(bytes, wanted) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (int32(bytes, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('archive illisible');
    const count = bytes[eocd + 10] | bytes[eocd + 11] << 8;
    let p = int32(bytes, eocd + 16);
    for (let i = 0; i < count; i++) {
      const method = bytes[p + 10] | bytes[p + 11] << 8;
      const size = int32(bytes, p + 20); const nameLen = bytes[p + 28] | bytes[p + 29] << 8;
      const extra = bytes[p + 30] | bytes[p + 31] << 8; const comment = bytes[p + 32] | bytes[p + 33] << 8;
      const local = int32(bytes, p + 42);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      if (name === wanted) {
        const start = local + 30 + (bytes[local + 26] | bytes[local + 27] << 8) + (bytes[local + 28] | bytes[local + 29] << 8);
        const data = bytes.subarray(start, start + size);
        if (method === 0) return data;
        if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('compression non prise en charge');
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
      p += 46 + nameLen + extra + comment;
    }
    throw new Error('partition absente de l\'archive');
  }

  function kindOf(bytes) {
    const head = ascii(bytes, 0, 4);
    if (head === 'BCFZ' || head === 'BCFS') return 'gpx';
    if (head === 'PK\u0003\u0004' && new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096))).includes('Content/')) return 'gp';
    return null;
  }
  async function gpifOf(bytes) {
    const kind = kindOf(bytes);
    if (kind === 'gp') return new TextDecoder().decode(await unzipEntry(bytes, 'Content/score.gpif'));
    if (kind !== 'gpx') throw new Error('ce n\'est pas un fichier Guitar Pro 6, 7 ou 8');
    const body = ascii(bytes, 0, 4) === 'BCFZ' ? bcfzDecompress(bytes).subarray(4) : bytes.subarray(4);
    const files = bcfsFiles(body);
    if (!files['score.gpif']) throw new Error('partition absente du fichier');
    return new TextDecoder().decode(files['score.gpif']);
  }

  /* ---------- Lecture d'une partition GPIF ---------- */
  const VALUE_UNITS = { Whole: 16, Half: 8, Quarter: 4, Eighth: 2, '16th': 1, '32nd': 0.5, '64th': 0.25, '128th': 0.125 };

  function readGpif(xml) {
    const gpif = kid(parseXml(xml), 'GPIF');
    if (!gpif) throw new Error('partition Guitar Pro illisible');
    const byId = (list, name) => { const map = new Map(); kids(kid(gpif, list), name).forEach((e) => map.set(e.attrs.id, e)); return map; };
    const bars = byId('Bars', 'Bar'); const voices = byId('Voices', 'Voice'); const beats = byId('Beats', 'Beat');
    const notes = byId('Notes', 'Note'); const rhythms = byId('Rhythms', 'Rhythm');
    const tracks = kids(kid(gpif, 'Tracks'), 'Track');
    // Accordage : propriétés de la piste (Guitar Pro 6) ou de sa portée (Guitar Pro 7 et 8).
    const trackProps = (t) => [t, ...kids(kid(t, 'Staves'), 'Staff')];
    const pitchesOf = (t) => {
      for (const holder of trackProps(t)) { const p = prop(holder, 'Tuning'); if (p) return txt(kid(p, 'Pitches')).split(/\s+/).map(Number).filter((x) => !Number.isNaN(x)); }
      return [];
    };
    const index = tracks.findIndex((t) => pitchesOf(t).length === 4);
    if (index < 0) {
      const counts = [...new Set(tracks.map((t) => pitchesOf(t).length).filter(Boolean))];
      throw new Error('aucune piste de ukulélé (4 cordes) dans ce fichier' + (counts.length ? ' : pistes à ' + counts.join(', ') + ' cordes' : ''));
    }
    const track = tracks[index];
    const pitches = pitchesOf(track);
    const problems = [];
    let tuning = Object.keys(C.TUNINGS).find((k) => C.TUNINGS[k].midi.join() === pitches.join());
    if (!tuning) { tuning = 'standard'; problems.push('Accordage ' + pitches.join(' ') + ' inconnu : la tablature est gardée telle quelle, sur l\'accordage standard.'); }
    // Diagrammes d'accords de la piste.
    const chords = new Map();
    trackProps(track).forEach((holder) => ['DiagramCollection', 'ChordCollection'].forEach((n) => {
      const p = prop(holder, n);
      kids(kid(p, 'Items'), 'Item').forEach((item) => {
        const d = kid(item, 'Diagram'); let frets = null;
        if (d && +(d.attrs.stringCount || 0) === 4) {
          const base = +(d.attrs.baseFret || 0); frets = [0, 0, 0, 0];
          kids(d, 'Fret').forEach((f) => { const s = +f.attrs.string; if (s >= 0 && s < 4) frets[s] = base + +f.attrs.fret; });
        }
        chords.set(item.attrs.id, { name: item.attrs.name || '', frets });
      });
    }));
    const titleText = txt(path(gpif, 'Score', 'Title'));
    let tempo = null;
    kids(path(gpif, 'MasterTrack', 'Automations'), 'Automation').forEach((a) => { if (tempo === null && txt(kid(a, 'Type')) === 'Tempo') tempo = Math.round(parseFloat(txt(kid(a, 'Value')))); });
    const masterBars = kids(kid(gpif, 'MasterBars'), 'MasterBar');
    const meter = txt(kid(masterBars[0], 'Time')) || '4/4';
    if (!Object.prototype.hasOwnProperty.call(C.METERS, meter)) throw new Error('mesure ' + meter + ' non prise en charge (4/4, 3/4, 2/4 et 6/8 seulement)');
    if (masterBars.some((mb) => txt(kid(mb, 'Time')) !== meter)) problems.push('Changements de mesure ignorés : tout est écrit en ' + meter + '.');
    const units = C.METERS[meter].units;
    const out = []; const lyrics = []; let rounded = false;
    masterBars.forEach((mb) => {
      const barId = txt(kid(mb, 'Bars')).split(/\s+/)[index];
      const bar = bars.get(barId);
      const voiceId = bar ? txt(kid(bar, 'Voices')).split(/\s+/).find((v) => v !== '-1') : undefined;
      const voice = voices.get(voiceId);
      const events = []; const words = [];
      let pos = 0;
      txt(kid(voice, 'Beats')).split(/\s+/).filter(Boolean).forEach((bid) => {
        const beat = beats.get(bid); if (!beat) return;
        const rhythm = rhythms.get((kid(beat, 'Rhythm') || { attrs: {} }).attrs.ref);
        let len = VALUE_UNITS[txt(kid(rhythm, 'NoteValue'))] || 4;
        const dots = +((kid(rhythm, 'AugmentationDot') || { attrs: {} }).attrs.count || 0);
        len *= dots === 1 ? 1.5 : dots === 2 ? 1.75 : 1;
        const tup = kid(rhythm, 'PrimaryTuplet');
        if (tup) len *= +tup.attrs.den / +tup.attrs.num;
        const start = Math.round(pos); const end = Math.round(pos + len);
        if (start !== pos || end !== pos + len) rounded = true;
        pos += len;
        const line = kid(kid(beat, 'Lyrics'), 'Line');
        if (line && txt(line)) words.push(txt(line));
        if (start >= units || end <= start) return;
        const ns = txt(kid(beat, 'Notes')).split(/\s+/).filter(Boolean).map((id) => notes.get(id)).filter(Boolean)
          .filter((n) => { const tie = kid(n, 'Tie'); return !(tie && tie.attrs.destination === 'true'); })
          .map((n) => {
            const muted = !!prop(n, 'Muted') || !!prop(n, 'Dead');
            return { string: +txt(kid(prop(n, 'String'), 'String')), fret: muted ? 0 : +txt(kid(prop(n, 'Fret'), 'Fret')), ...(muted ? { muted: true } : {}) };
          })
          .filter((n) => n.string >= 0 && n.string < 4 && !Number.isNaN(n.fret));
        const ev = { start, dur: Math.min(end, units) - start, notes: ns };
        const chordEl = kid(beat, 'Chord');
        const chord = chordEl && chords.get(txt(chordEl));
        if (chord && chord.name) { ev.chord = chord.name; if (chord.frets) ev.frets = chord.frets; }
        const brush = prop(beat, 'Brush');
        if (brush && ns.length > 1) {
          const dyn = txt(kid(beat, 'Dynamic'));
          const level = /^F/.test(dyn) ? 'strong' : /^P/.test(dyn) ? 'soft' : 'normal';
          ev.strum = ns.every((n) => n.muted) ? { type: 'chunk', dir: txt(kid(brush, 'Direction')) === 'Up' ? 'up' : 'down' }
            : { type: 'stroke', dir: txt(kid(brush, 'Direction')) === 'Up' ? 'up' : 'down', level, count: ns.length };
        }
        if (ns.length || ev.chord) events.push(ev);
      });
      const section = txt(path(mb, 'Section', 'Text'));
      out.push(section ? { events, section } : { events });
      lyrics.push(words.join(' '));
    });
    if (rounded) problems.push('Triolets et valeurs très courtes arrondis à la double-croche.');
    // Fin de partition vide (mesures sans note) : retirée.
    while (out.length > 1 && !out[out.length - 1].events.length && !lyrics[out.length - 1]) { out.pop(); lyrics.pop(); }
    const score = { title: titleText, meter, tuning, bars: out, voicings: [], problems, source: 'imported' };
    return { score, lyrics, tempo, title: titleText };
  }

  async function importGp(bytes) { return readGpif(await gpifOf(bytes)); }

  /* ---------- Écriture d'un fichier Guitar Pro 7/8 (.gp) ----------
     Même structure que les fichiers ouverts sans erreur par Guitar Pro 8 (modèle : exportateur d'alphaTab). */
  const cdata = (s) => '<![CDATA[' + String(s || '').split(']]>').join(']]]]><![CDATA[>') + ']]>';
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const NOTE_VALUE = { 16: 'Whole', 8: 'Half', 4: 'Quarter', 2: 'Eighth', 1: '16th' };
  const SHARP_STEPS = [['C', ''], ['C', '#'], ['D', ''], ['D', '#'], ['E', ''], ['F', ''], ['F', '#'], ['G', ''], ['G', '#'], ['A', ''], ['A', '#'], ['B', '']];
  const FLAT_STEPS = [['C', 'Natural'], ['D', 'Flat'], ['D', 'Natural'], ['E', 'Flat'], ['E', 'Natural'], ['F', 'Natural'], ['G', 'Flat'], ['G', 'Natural'], ['A', 'Flat'], ['A', 'Natural'], ['B', 'Flat'], ['B', 'Natural']];
  const NAMED_STEPS = [['C', 'Natural'], ['C', 'Sharp'], ['D', 'Natural'], ['D', 'Sharp'], ['E', 'Natural'], ['F', 'Natural'], ['F', 'Sharp'], ['G', 'Natural'], ['G', 'Sharp'], ['A', 'Natural'], ['A', 'Sharp'], ['B', 'Natural']];
  const pitchXml = (midi) => { const [st, acc] = SHARP_STEPS[midi % 12]; return '<Pitch><Step>' + st + '</Step><Accidental>' + acc + '</Accidental><Octave>' + Math.floor(midi / 12) + '</Octave></Pitch>'; };
  /* Analyse de l'accord écrite comme Guitar Pro : fondamentale, basse, degrés. */
  function chordXml(name) {
    const c = C.parseChord(name); if (!c) return '';
    const step = (pc, flat) => (flat ? FLAT_STEPS : NAMED_STEPS)[((pc % 12) + 12) % 12];
    const [ks, ka] = step(c.root, c.flat); const [bs, ba] = step(c.bass === null || c.bass === undefined ? c.root : c.bass, c.flat);
    const q = c.quality || '';
    const deg = [];
    const add = (interval, alteration) => deg.push('<Degree interval="' + interval + '" alteration="' + alteration + '" omitted="false"/>');
    if (/sus2/.test(q)) add('Second', 'Major'); else if (/sus/.test(q)) add('Fourth', 'Perfect');
    else add('Third', /^(m(?!aj)|dim|ø)/.test(q) ? 'Minor' : 'Major');
    add('Fifth', /dim|ø|b5/.test(q) ? 'Diminished' : /aug|\+|#5/.test(q) ? 'Augmented' : 'Perfect');
    if (/6/.test(q)) add('Sixth', 'Major');
    if (/maj7|M7|Δ/.test(q)) add('Seventh', 'Major'); else if (/dim7/.test(q)) add('Seventh', 'Diminished'); else if (/7|9|11|13|ø/.test(q)) add('Seventh', 'Minor');
    if (/9/.test(q)) add('Ninth', 'Major');
    return '<Chord><KeyNote step="' + ks + '" accidental="' + ka + '"/><BassNote step="' + bs + '" accidental="' + ba + '"/>' + deg.join('') + '</Chord>';
  }

  function writeGpif(score, o) {
    o = o || {};
    const tuning = C.TUNINGS[score.tuning] || C.TUNINGS.standard;
    const units = C.METERS[score.meter].units;
    const lyrics = o.lyrics || [];
    const rhythms = []; const rhythmIds = new Map();
    const rhythm = (seg) => {
      const key = seg.units + ':' + seg.dots;
      if (!rhythmIds.has(key)) {
        const base = seg.dots ? seg.units / (seg.dots === 1 ? 1.5 : 1.75) : seg.units;
        rhythmIds.set(key, rhythms.length);
        rhythms.push('<Rhythm id="' + rhythms.length + '"><NoteValue>' + NOTE_VALUE[base] + '</NoteValue>' + (seg.dots ? '<AugmentationDot count="' + seg.dots + '"/>' : '') + '</Rhythm>');
      }
      return rhythmIds.get(key);
    };
    const chordIds = new Map(); const diagrams = [];
    const chordId = (name, frets) => {
      const key = name + '|' + (frets ? frets.join(',') : '');
      if (!chordIds.has(key)) {
        const id = 'c' + String(chordIds.size).padStart(2, '0');
        chordIds.set(key, id);
        const f = frets || [0, 0, 0, 0];
        const fretted = f.filter((x) => x > 0); const top = fretted.length ? Math.max(...fretted) : 0;
        const base = top > 5 && f.every((x) => x > 0) ? Math.min(...fretted) - 1 : 0;
        diagrams.push('<Item id="' + id + '" name="' + esc(name) + '"><Diagram stringCount="4" fretCount="' + Math.max(5, top - base) + '" baseFret="' + base + '" barStates="1 1 1 1">'
          + f.map((x, s) => '<Fret string="' + s + '" fret="' + (x - base) + '"/>').join('')
          + '<Fingering/><Property name="ShowName" type="bool" value="true"/><Property name="ShowDiagram" type="bool" value="' + (frets ? 'true' : 'false') + '"/><Property name="ShowFingering" type="bool" value="true"/>'
          + chordXml(name) + '</Diagram></Item>');
      }
      return chordIds.get(key);
    };
    const notesXml = []; const beatsXml = []; const voicesXml = []; const barsXml = []; const masterXml = [];
    const level = { strong: 'F', normal: 'MF', soft: 'P', ghost: 'PP' };
    let firstLyricBar = -1;
    score.bars.forEach((bar, bi) => {
      const beatIds = [];
      const pushBeat = (seg, ev, first, words) => {
        const ids = [];
        if (ev && first) ev.notes.forEach((n) => {
          const midi = tuning.midi[n.string] + (n.fret || 0);
          ids.push(notesXml.length);
          notesXml.push('<Note id="' + notesXml.length + '"><Properties>'
            + '<Property name="ConcertPitch">' + pitchXml(midi) + '</Property><Property name="TransposedPitch">' + pitchXml(midi) + '</Property>'
            + '<Property name="String"><String>' + n.string + '</String></Property><Property name="Fret"><Fret>' + (n.fret || 0) + '</Fret></Property>'
            + '<Property name="Midi"><Number>' + midi + '</Number></Property>'
            + (n.muted ? '<Property name="Muted"><Enable/></Property>' : '') + '</Properties><InstrumentArticulation>0</InstrumentArticulation></Note>');
        });
        const st = ev && first ? ev.strum : null;
        const dyn = st && st.level ? level[st.level] : 'MF';
        const brushed = st && (st.type === 'stroke' || st.type === 'chunk') && ids.length > 1;
        const chord = ev && first && ev.chord ? '<Chord>' + cdata(chordId(ev.chord, ev.frets)) + '</Chord>' : '';
        beatIds.push(beatsXml.length);
        beatsXml.push('<Beat id="' + beatsXml.length + '"><Dynamic>' + dyn + '</Dynamic>' + chord + '<Rhythm ref="' + rhythm(seg) + '"/>'
          + '<ConcertPitchStemOrientation>Undefined</ConcertPitchStemOrientation>'
          + (ids.length ? '<Notes>' + ids.join(' ') + '</Notes>' : '')
          + (brushed ? '<Properties><Property name="Brush"><Direction>' + (st.dir === 'up' ? 'Up' : 'Down') + '</Direction></Property></Properties><XProperties><XProperty id="687935489"><Int>30</Int></XProperty></XProperties>'
            : '<Properties/><XProperties/>')
          + (words ? '<Lyrics><Line>' + cdata(words) + '</Line></Lyrics>' : '') + '</Beat>');
      };
      let t = 0; let words = lyrics[bi] || '';
      if (words && firstLyricBar < 0) firstLyricBar = bi;
      const take = () => { const w = words; words = ''; return w; };
      const gap = (len) => C.splitDuration(len).forEach((seg) => pushBeat(seg, null, false, take()));
      bar.events.forEach((ev) => {
        if (ev.start < t) return;
        if (ev.start > t) gap(ev.start - t);
        C.splitDuration(Math.min(ev.dur, units - ev.start)).forEach((seg, k) => pushBeat(seg, ev, k === 0, take()));
        t = Math.min(ev.start + ev.dur, units);
      });
      if (t < units) gap(units - t);
      voicesXml.push('<Voice id="' + bi + '"><Beats>' + beatIds.join(' ') + '</Beats></Voice>');
      barsXml.push('<Bar id="' + bi + '"><Clef>G2</Clef><Voices>' + bi + ' -1 -1 -1</Voices></Bar>');
      masterXml.push('<MasterBar><Key><AccidentalCount>0</AccidentalCount><Mode>Major</Mode><Sharps>Sharps</Sharps></Key><Time>' + score.meter + '</Time>'
        + (bar.section ? '<Section><Letter>' + cdata('') + '</Letter><Text>' + cdata(bar.section) + '</Text></Section>' : '')
        + '<Bars>' + bi + '</Bars></MasterBar>');
    });
    const title = o.title || score.title || '';
    const sound = 'Midi/24;Ukulele;Factory';
    const allWords = lyrics.filter(Boolean).join(' ');
    const diagramSet = (n) => '<Property name="' + n + '"><Items>' + diagrams.join('') + '</Items></Property>';
    return '<?xml version="1.0" encoding="utf-8"?>\n<GPIF><GPVersion>8.1.3</GPVersion><GPRevision required="12024" recommended="13000">13007</GPRevision><Encoding><EncodingDescription>GP8</EncodingDescription></Encoding>'
      + '<Score><Title>' + cdata(title) + '</Title><SubTitle>' + cdata('') + '</SubTitle><Artist>' + cdata('') + '</Artist><Album>' + cdata('') + '</Album>'
      + '<Words>' + cdata('') + '</Words><Music>' + cdata('') + '</Music><WordsAndMusic>' + cdata('') + '</WordsAndMusic><Copyright>' + cdata('') + '</Copyright>'
      + '<Tabber>' + cdata('Arpège') + '</Tabber><Instructions>' + cdata('') + '</Instructions><Notices>' + cdata('') + '</Notices>'
      + '<FirstPageHeader>' + cdata('') + '</FirstPageHeader><FirstPageFooter>' + cdata('') + '</FirstPageFooter><PageHeader>' + cdata('') + '</PageHeader><PageFooter>' + cdata('') + '</PageFooter>'
      + '<ScoreSystemsDefaultLayout>' + cdata('4') + '</ScoreSystemsDefaultLayout><ScoreSystemsLayout>' + cdata('') + '</ScoreSystemsLayout><ScoreZoomPolicy>Value</ScoreZoomPolicy><ScoreZoom>1</ScoreZoom><MultiVoice>0</MultiVoice></Score>'
      + '<MasterTrack><Tracks>0</Tracks><Automations><Automation><Type>Tempo</Type><Linear>false</Linear><Bar>0</Bar><Position>0</Position><Visible>true</Visible><Value>' + (o.tempo || 80) + ' 2</Value></Automation></Automations></MasterTrack>'
      + '<AudioTracks/><Tracks><Track id="0"><Name>' + cdata('Ukulélé') + '</Name><ShortName>' + cdata('Uke') + '</ShortName><Color>15 107 99</Color>'
      + '<SystemsDefautLayout>3</SystemsDefautLayout><SystemsLayout></SystemsLayout><AutoBrush/><PalmMute>0</PalmMute><PlayingStyle>StringedPick</PlayingStyle><UseOneChannelPerString/><IconId>1</IconId>'
      + '<InstrumentSet><Name>Steel Guitar</Name><Type>steelGuitar</Type><LineCount>5</LineCount><Elements><Element><Name>Pitched</Name><Type>pitched</Type><SoundbankName></SoundbankName><Articulations><Articulation><Name></Name><StaffLine>0</StaffLine><Noteheads>noteheadBlack noteheadHalf noteheadWhole</Noteheads><TechniquePlacement>outside</TechniquePlacement><TechniqueSymbol></TechniqueSymbol><InputMidiNumbers></InputMidiNumbers><OutputRSESound></OutputRSESound><OutputMidiNumber>0</OutputMidiNumber></Articulation></Articulations></Element></Elements></InstrumentSet>'
      + '<Transpose><Chromatic>0</Chromatic><Octave>0</Octave></Transpose><RSE><ChannelStrip version="E56"><Parameters>0.5 0.5 0.5 0.5 0.5 0.5 0.5 0.5 0.5 1 0.5 0.5 0.9375 0.5 0.5 0.5</Parameters></ChannelStrip></RSE><ForcedSound>-1</ForcedSound>'
      + '<MidiConnection><Port>1</Port><PrimaryChannel>0</PrimaryChannel><SecondaryChannel>1</SecondaryChannel><ForeOneChannelPerString>false</ForeOneChannelPerString></MidiConnection>'
      + '<PlaybackState>Default</PlaybackState><AudioEngineState>MIDI</AudioEngineState>'
      + (allWords ? '<Lyrics dispatched="true"><Line><Text>' + cdata(allWords) + '</Text><Offset>' + firstLyricBar + '</Offset></Line></Lyrics>' : '')
      + '<Staves><Staff><Properties><Property name="CapoFret"><Fret>0</Fret></Property><Property name="FretCount"><Fret>18</Fret></Property>'
      + '<Property name="Tuning"><Pitches>' + tuning.midi.join(' ') + '</Pitches><Label>' + cdata(tuning.label) + '</Label><LabelVisible>true</LabelVisible><Instrument>Bass</Instrument></Property>'
      + '<Property name="PartialCapoFret"><Fret>0</Fret></Property><Property name="PartialCapoStringFlags"><Bitset>0000</Bitset></Property>'
      + (diagrams.length ? diagramSet('DiagramCollection') + diagramSet('DiagramWorkingSet') : '')
      + '</Properties></Staff></Staves>'
      + '<Sounds><Sound><Name>' + cdata('Ukulele') + '</Name><Label>' + cdata('Ukulele') + '</Label><Path>' + cdata('Midi/24') + '</Path><Role>' + cdata('Factory') + '</Role><MIDI><LSB>0</LSB><MSB>0</MSB><Program>24</Program></MIDI></Sound></Sounds>'
      + '<Automations><Automation><Type>Sound</Type><Linear>false</Linear><Bar>0</Bar><Position>0</Position><Visible>true</Visible><Value>' + cdata(sound) + '</Value></Automation></Automations>'
      + '</Track></Tracks>'
      + '<MasterBars>' + masterXml.join('') + '</MasterBars><Bars>' + barsXml.join('') + '</Bars><Voices>' + voicesXml.join('') + '</Voices>'
      + '<Beats>' + beatsXml.join('') + '</Beats><Notes>' + notesXml.join('') + '</Notes><Rhythms>' + rhythms.join('') + '</Rhythms></GPIF>';
  }

  /* Fichiers annexes d'un .gp à une piste (feuille de style, disposition des parties et de la page). */
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const STYLESHEET = 'AAAADh1TdGFuZGFyZE5vdGF0aW9uL2hpZGVEeW5hbWljcwAAGFN5c3RlbS9icmFja2V0RXh0ZW5kTW9kZQEAAAABHUdsb2JhbC91c2VTeXN0ZW1TaWduU2VwYXJhdG9yAAAUR2xvYmFsL0Rpc3BsYXlUdW5pbmcAARFHbG9iYWwvRHJhd0Nob3JkcwABF1N5c3RlbS9kcmF3Q2hvcmRJblNjb3JlAAAaU3lzdGVtL3RyYWNrTmFtZU1vZGVTaW5nbGUBAAAAABlTeXN0ZW0vdHJhY2tOYW1lTW9kZU11bHRpAQAAAAAiU3lzdGVtL3Nob3J0VHJhY2tOYW1lT25GaXJzdFN5c3RlbQABI1N5c3RlbS9zaG9ydFRyYWNrTmFtZU9uT3RoZXJTeXN0ZW1zAAEnU3lzdGVtL2hvcml6b250YWxUcmFja05hbWVPbkZpcnN0U3lzdGVtAAAoU3lzdGVtL2hvcml6b250YWxUcmFja05hbWVPbk90aGVyU3lzdGVtcwAAF1N5c3RlbS9FeHRlbmRlZEJhckxpbmVzAAAXU3lzdGVtL2JhckluZGV4RHJhd1R5cGUBAAAAAA==';
  const PART_CONFIG = [0, 0, 0, 2, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1, 2, 0, 0, 0, 1];
  const LAYOUT_CONFIG = [0, 0, 0, 4, 0, 0, 255, 255];

  /* ---------- Écriture d'un zip (méthode « deflate », comme Guitar Pro) ---------- */
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function deflateRaw(d) { return new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }
  async function zipBuild(entries) {
    const parts = []; const central = []; let offset = 0;
    for (const [name, data] of entries) {
      const nameB = new TextEncoder().encode(name);
      const dir = name.endsWith('/');
      const packed = dir ? new Uint8Array(0) : await deflateRaw(data);
      const crc = dir ? 0 : crc32(data);
      const head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, dir ? 0 : 8, true);
      head.setUint16(10, 0, true); head.setUint16(12, 0x21, true); head.setUint32(14, crc, true);
      head.setUint32(18, packed.length, true); head.setUint32(22, dir ? 0 : data.length, true); head.setUint16(26, nameB.length, true);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, dir ? 0 : 8, true);
      cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true); cen.setUint32(16, crc, true); cen.setUint32(20, packed.length, true); cen.setUint32(24, dir ? 0 : data.length, true);
      cen.setUint16(28, nameB.length, true); cen.setUint32(38, dir ? 16 : 0, true); cen.setUint32(42, offset, true);
      parts.push(new Uint8Array(head.buffer), nameB, packed);
      central.push(new Uint8Array(cen.buffer), nameB);
      offset += 30 + nameB.length + packed.length;
    }
    const cenSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let o = 0;
    all.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }

  /* o : { title, tempo, lyrics: [texte par mesure] }. Renvoie le fichier .gp (Guitar Pro 7 et 8). */
  async function exportGp(score, o) {
    const enc = new TextEncoder();
    return zipBuild([
      ['VERSION', enc.encode('7.0')],
      ['Content/', null],
      ['Content/BinaryStylesheet', b64(STYLESHEET)],
      ['Content/PartConfiguration', new Uint8Array(PART_CONFIG)],
      ['Content/LayoutConfiguration', new Uint8Array(LAYOUT_CONFIG)],
      ['Content/score.gpif', enc.encode(writeGpif(score, o))]]);
  }

  const api = { exportGp, importGp, kindOf, writeGpif, readGpif, parseXml, bcfzDecompress, bcfsFiles };
  global.UkuGp = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
