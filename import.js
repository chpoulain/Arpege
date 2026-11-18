/* Récupération de fichiers en ligne ou locaux, et lecture du texte des images (OCR embarqué). */
(function (global) {
  'use strict';
  const MAX_BYTES = 15 * 1024 * 1024;
  const pending = new Map();
  let seq = 0;

  global.__fetchDone = function (id, json) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    const r = typeof json === 'string' ? JSON.parse(json) : json;
    if (!r.ok) { p.reject(new Error(r.error || 'Échec du téléchargement')); return; }
    const bin = atob(r.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    p.resolve({ bytes, contentType: r.contentType || '', finalUrl: r.finalUrl || p.url });
  };

  /* Sur Android, la requête passe par le natif : pas de restriction CORS sur les fichiers tiers. */
  function fetchRemote(url) {
    if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error("L'adresse doit commencer par http:// ou https://"));
    if (global.Desktop) {
      return global.Desktop.fetchUrl(url).catch((e) => { throw new Error(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); });
    }
    if (global.Android && global.Android.fetchUrl) {
      return new Promise((resolve, reject) => {
        const id = 'f' + (++seq);
        pending.set(id, { resolve, reject, url });
        global.Android.fetchUrl(id, url);
      });
    }
    return fetch(url).then(async (res) => {
      if (!res.ok) throw new Error('Le serveur a répondu ' + res.status);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error('Fichier trop volumineux (15 Mo maximum)');
      return { bytes, contentType: res.headers.get('content-type') || '', finalUrl: res.url || url };
    });
  }

  function sniff(bytes, contentType, name) {
    const ct = (contentType || '').toLowerCase();
    const b = bytes;
    if (b[0] === 0x89 && b[1] === 0x50) return 'image';
    if (b[0] === 0xff && b[1] === 0xd8) return 'image';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image';
    if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image';
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
    if (ct.startsWith('image/')) return 'image';
    const head = decodeText(b.subarray(0, 1024));
    if (ct.includes('html') || /^\s*(<!doctype html|<html)/i.test(head)) return 'html';
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name || '')) return 'image';
    return 'text';
  }

  function decodeText(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }

  const FILE_RE = /\.(txt|text|cho|crd|tab|pro|chopro|musicxml|xml|png|jpe?g|webp|gif)(\?|#|$)/i;

  /* Page ou dossier web : le HTML n'est jamais exécuté, seulement analysé pour en extraire liens et texte. */
  function parseHtml(bytes, baseUrl) {
    const doc = new DOMParser().parseFromString(decodeText(bytes), 'text/html');
    const links = [];
    const seen = new Set();
    doc.querySelectorAll('a[href]').forEach((a) => {
      let href;
      try { href = new URL(a.getAttribute('href'), baseUrl).href; } catch (e) { return; }
      if (!/^https?:/i.test(href) || !FILE_RE.test(href) || seen.has(href)) return;
      seen.add(href);
      links.push({ href, label: (a.textContent || '').trim() || decodeURIComponent(href.split('/').pop()) });
    });
    doc.querySelectorAll('script,style,noscript').forEach((e) => e.remove());
    const pre = doc.querySelector('pre');
    const text = (pre ? pre.textContent : (doc.body ? doc.body.textContent : '')).replace(/\n{3,}/g, '\n\n').trim();
    return { links, text };
  }

  /* Prétraitement : mise à l'échelle et binarisation (seuil d'Otsu) pour fiabiliser l'OCR. */
  async function prepareImage(blob) {
    const bmp = await createImageBitmap(blob);
    const target = Math.min(2600, Math.max(1600, bmp.width));
    const scale = Math.min(target / bmp.width, 3);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close && bmp.close();
    const img = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data; const hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
      d[i] = v; hist[v]++;
    }
    const total = d.length / 4;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0; let wB = 0; let best = 0; let thr = 127;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const diff = sumB / wB - (sum - sumB) / wF;
      const between = wB * wF * diff * diff;
      if (between > best) { best = between; thr = i; }
    }
    const gray = new Uint8Array(total);
    for (let i = 0; i < d.length; i += 4) {
      gray[i / 4] = d[i];
      const v = d[i] > thr ? 255 : 0; d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    return { canvas, gray, w: canvas.width, h: canvas.height, thr };
  }

  /* ---------- Lecture d'une tablature en image ----------
     1. repère les groupes de lignes horizontales régulières (4 = ukulélé, 5 = portée ignorée, 6 = guitare) ;
     2. repère les barres de mesure, efface les lignes, isole chaque chiffre ;
     3. lit chaque chiffre séparément, puis reconstruit une tablature texte vérifiable. */
  function findStaffLines(dark, w, h) {
    // Largeur du contenu réel : une tablature peut n'occuper qu'une partie de l'image.
    let minX = w; let maxX = 0;
    for (let i = 0; i < dark.length; i++) {
      if (dark[i]) { const x = i % w; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
    const need = Math.max(maxX - minX + 1, 1) * 0.25;
    const lines = [];
    let start = -1;
    for (let y = 0; y <= h; y++) {
      let n = 0;
      if (y < h) for (let x = 0; x < w; x++) n += dark[y * w + x];
      const isLine = y < h && n > need;
      if (isLine && start < 0) start = y;
      if (!isLine && start >= 0) { lines.push({ top: start, bot: y - 1, c: (start + y - 1) / 2 }); start = -1; }
    }
    return lines;
  }

  function groupSystems(lines) {
    const groups = [];
    let i = 0;
    while (i < lines.length - 1) {
      const g = lines[i + 1].c - lines[i].c;
      let j = i + 1;
      while (j + 1 < lines.length && Math.abs(lines[j + 1].c - lines[j].c - g) < g * 0.18) j++;
      const run = lines.slice(i, j + 1);
      const thin = run.every((l) => l.bot - l.top + 1 <= Math.max(8, g * 0.3));
      if (g >= 10 && thin && run.length >= 4) groups.push({ lines: run, gap: g });
      i = run.length >= 4 ? j + 1 : i + 1;
    }
    return groups;
  }

  function findBarColumns(dark, w, sys) {
    const top = sys.lines[0].top; const bot = sys.lines[sys.lines.length - 1].bot; const span = bot - top + 1;
    const thick = sys.lines[0].bot - sys.lines[0].top + 1;
    const raw = [];
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let y = top; y <= bot; y++) n += dark[y * w + x];
      if (n >= span * 0.7) raw.push(x);
    }
    const bars = [];
    raw.forEach((x) => {
      const last = bars[bars.length - 1];
      if (last && x - last.x1 <= 1) last.x1 = x; else bars.push({ x0: x, x1: x });
    });
    return bars.filter((b) => b.x1 - b.x0 + 1 <= Math.max(thick * 3, sys.gap * 0.4));
  }

  function findDigitBoxes(dark, w, h, sys, bars) {
    const y0 = Math.max(0, Math.floor(sys.lines[0].c - sys.gap * 0.75));
    const y1 = Math.min(h - 1, Math.ceil(sys.lines[sys.lines.length - 1].c + sys.gap * 0.75));
    const bw = w; const bh = y1 - y0 + 1;
    const mask = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) mask[y * bw + x] = dark[(y + y0) * w + x];
    const at = (x, y) => (y >= 0 && y < bh ? mask[y * bw + x] : 0);
    // Efface les lignes là où rien ne les traverse verticalement.
    sys.lines.forEach((l) => {
      const t = l.top - y0; const b = l.bot - y0;
      for (let x = 0; x < bw; x++) {
        if (!at(x, t - 2) && !at(x, b + 2)) for (let y = t - 1; y <= b + 1; y++) if (y >= 0 && y < bh) mask[y * bw + x] = 0;
      }
    });
    bars.forEach((b) => {
      for (let x = Math.max(0, b.x0 - 1); x <= Math.min(bw - 1, b.x1 + 1); x++) for (let y = 0; y < bh; y++) mask[y * bw + x] = 0;
    });
    const seen = new Uint8Array(bw * bh);
    const boxes = [];
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || seen[i]) continue;
      const stack = [i]; seen[i] = 1;
      let minX = bw; let maxX = 0; let minY = bh; let maxY = 0; let area = 0;
      while (stack.length) {
        const p = stack.pop(); const py = Math.floor(p / bw); const px = p - py * bw;
        area++;
        if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx; const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
          const q = ny * bw + nx;
          if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
        }
      }
      const bwd = maxX - minX + 1; const bht = maxY - minY + 1;
      if (bht < sys.gap * 0.3 || bht > sys.gap * 1.3 || bwd > sys.gap * 1.3 || area < 6) continue;
      const cy = (minY + maxY) / 2 + y0;
      let string = -1; let bestD = sys.gap * 0.55;
      sys.lines.forEach((l, k) => { const d = Math.abs(l.c - cy); if (d < bestD) { bestD = d; string = k; } });
      if (string >= 0) boxes.push({ minX, maxX, minY, maxY, row: string });
    }
    // Deux chiffres collés forment un seul nombre (10, 12…).
    const merged = [];
    boxes.sort((a, b) => a.row - b.row || a.minX - b.minX).forEach((b) => {
      const last = merged[merged.length - 1];
      if (last && last.row === b.row && b.minX - last.maxX < (b.maxY - b.minY + 1) * 0.35) {
        last.maxX = b.maxX; last.minY = Math.min(last.minY, b.minY); last.maxY = Math.max(last.maxY, b.maxY);
      } else merged.push(Object.assign({}, b));
    });
    return { boxes: merged, mask, bw };
  }

  function cropDigit(box, mask, bw) {
    const bwd = box.maxX - box.minX + 1; const bht = box.maxY - box.minY + 1;
    const scale = Math.max(1, 44 / bht); const pad = Math.round(bht * 0.6);
    const raw = document.createElement('canvas'); raw.width = bwd + pad * 2; raw.height = bht + pad * 2;
    const g = raw.getContext('2d');
    const img = g.createImageData(raw.width, raw.height);
    img.data.fill(255);
    for (let y = 0; y < bht; y++) for (let x = 0; x < bwd; x++) {
      if (mask[(y + box.minY) * bw + x + box.minX]) {
        const o = ((y + pad) * raw.width + x + pad) * 4;
        img.data[o] = 0; img.data[o + 1] = 0; img.data[o + 2] = 0;
      }
    }
    g.putImageData(img, 0, 0);
    const out = document.createElement('canvas'); out.width = Math.round(raw.width * scale); out.height = Math.round(raw.height * scale);
    const og = out.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(raw, 0, 0, out.width, out.height);
    return out;
  }

  /* Remet les chiffres d'une ligne de tablature sur une grille de colonnes texte. */
  function systemToText(items, bars, sys, names) {
    const barXs = bars.map((b) => (b.x0 + b.x1) / 2);
    const xs = items.map((d) => d.x);
    const left = barXs.length && barXs[0] <= Math.min(...xs) ? barXs[0] : Math.min(...xs) - sys.gap;
    const right = barXs.length && barXs[barXs.length - 1] >= Math.max(...xs) ? barXs[barXs.length - 1] : Math.max(...xs) + sys.gap;
    const edges = [left].concat(barXs.filter((x) => x > left + sys.gap * 0.3 && x < right - sys.gap * 0.3), [right]);
    const rows = names.map((n) => n + '|');
    for (let e = 0; e < edges.length - 1; e++) {
      const inBar = items.filter((d) => d.x >= edges[e] && d.x < edges[e + 1]).sort((a, b) => a.x - b.x);
      if (!inBar.length) continue;
      const clusters = [];
      inBar.forEach((d) => {
        const last = clusters[clusters.length - 1];
        if (last && d.x - last.x < sys.gap * 0.45) last.notes.push(d); else clusters.push({ x: d.x, notes: [d] });
      });
      const gaps = clusters.slice(1).map((c, i) => c.x - clusters[i].x);
      const unit = gaps.length ? Math.min(...gaps) : Math.max(edges[e + 1] - clusters[0].x, 1);
      let col = 1; const cols = [];
      clusters.forEach((c, i) => { if (i) col += 2 * Math.max(1, Math.round(gaps[i - 1] / unit)); cols.push(col); });
      const tail = Math.max(1, Math.round((edges[e + 1] - clusters[clusters.length - 1].x) / unit));
      const len = col + 2 * tail - 1;
      const cells = names.map(() => new Array(len).fill('-'));
      clusters.forEach((c, i) => c.notes.forEach((d) => {
        String(d.fret).split('').forEach((ch, k) => { cells[d.row][cols[i] + k] = ch; });
      }));
      cells.forEach((cell, r) => { rows[r] += cell.join('') + '|'; });
    }
    return rows.join('\n');
  }

  /* Noms d'accords imprimés au-dessus d'une portée. L'OCR confond quelques signes : on corrige ce qui est sans ambiguïté. */
  function cleanChordWord(raw) {
    const t = raw.replace(/rn/g, 'm').replace(/^8(?=[b#m7]|$)/, 'B').replace(/^6(?=[#bm7]|$)/, 'G').replace(/^0(?=[#bm7]|$)/, 'D').replace(/[.,;:'`]+$/, '');
    return global.UkuCore.parseChord(t) ? t : null;
  }
  function chordsInBand(text) {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const good = words.map(cleanChordWord).filter(Boolean);
    // Une bande où la plupart des mots ne sont pas des accords est du texte ou du bruit : on ne devine pas.
    return good.length / words.length >= 0.6 ? good.join(' ') : '';
  }
  async function readChordBand(prep, dark, worker, systems, index) {
    const { w } = prep;
    const sys = systems[index];
    const gap = sys.gap; const top = sys.lines[0].top;
    const floor = index ? systems[index - 1].lines[systems[index - 1].lines.length - 1].bot + gap * 0.5 : 0;
    const y0 = Math.max(0, Math.floor(Math.max(floor, top - gap * 5)));
    const y1 = Math.floor(top - gap * 0.25);
    if (y1 - y0 < gap * 1.2) return '';
    const bh = y1 - y0;
    const mask = new Uint8Array(w * bh);
    for (let i = 0; i < mask.length; i++) mask[i] = dark[(y0 * w) + i];
    // Clé, hampes et ligatures montent depuis la portée : tout ce qui touche le bas de la bande est effacé, les noms restent.
    const stack = [];
    for (let x = 0; x < w; x++) if (mask[(bh - 1) * w + x]) stack.push((bh - 1) * w + x);
    while (stack.length) {
      const i = stack.pop();
      if (!mask[i]) continue;
      mask[i] = 0;
      const x = i % w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i + w < mask.length) stack.push(i + w);
    }
    let ink = 0;
    for (let i = 0; i < mask.length; i++) ink += mask[i];
    if (ink < gap * gap * 0.3) return '';
    const crop = document.createElement('canvas');
    crop.width = w; crop.height = bh + 40;
    const g = crop.getContext('2d');
    const img = g.createImageData(w, bh + 40);
    img.data.fill(255);
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const o = (i + w * 20) * 4; img.data[o] = 0; img.data[o + 1] = 0; img.data[o + 2] = 0; }
    g.putImageData(img, 0, 0);
    await worker.setParameters({ tessedit_pageseg_mode: '7', preserve_interword_spaces: '0', tessedit_char_whitelist: 'ABCDEFGabdegijmorsu#0123456789/+-()°Ré ' });
    return chordsInBand((await worker.recognize(crop)).data.text);
  }

  async function readTabImage(prep, worker, onProgress) {
    const { gray, w, h, thr } = prep;
    // Les lignes de portée sont souvent grises : second essai avec un seuil plus clair.
    for (const t of [...new Set([thr, 215])]) {
      const dark = new Uint8Array(gray.length);
      for (let i = 0; i < gray.length; i++) dark[i] = gray[i] <= t ? 1 : 0;
      const groups = groupSystems(findStaffLines(dark, w, h));
      // 4 lignes = ukulélé ; à défaut, 6 lignes = guitare.
      const size = groups.some((g) => g.lines.length === 4) ? 4 : 6;
      const systems = groups.filter((g) => g.lines.length === size);
      if (!systems.length) {
        // Portées à 5 lignes seules : on ne sait pas lire les notes dessinées, seulement les accords imprimés au-dessus.
        if (!groups.some((g) => g.lines.length === 5)) continue;
        const names = [];
        for (let i = 0; i < groups.length; i++) {
          if (onProgress) onProgress(i / groups.length);
          const band = groups[i].lines.length === 5 ? await readChordBand(prep, dark, worker, groups, i) : '';
          if (band) names.push(band);
        }
        return { text: names.join('\n'), unread: 0, staffOnly: true };
      }
      const jobs = systems.map((sys) => {
        const bars = findBarColumns(dark, w, sys);
        return Object.assign({ sys, bars }, findDigitBoxes(dark, w, h, sys, bars));
      });
      const total = jobs.reduce((n, j) => n + j.boxes.length, 0);
      if (!total) continue;
      let done = 0; let unread = 0;
      const blocks = [];
      const read = async (canvas, psm, whitelist) => {
        await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: whitelist });
        return (await worker.recognize(canvas)).data.text.trim();
      };
      const isFret = (t) => /^\d{1,2}$/.test(t) && +t <= 24;
      // Un chiffre rebelle ressemble aux autres chiffres de la même image : on le compare à ceux déjà lus.
      const templates = [];
      const glyph = (box, job) => {
        const out = new Uint8Array(20 * 28);
        const bwd = box.maxX - box.minX + 1; const bht = box.maxY - box.minY + 1;
        for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) {
          out[y * 20 + x] = job.mask[(box.minY + Math.floor(y * bht / 28)) * job.bw + box.minX + Math.floor(x * bwd / 20)];
        }
        return out;
      };
      const pendingAll = [];
      for (const job of jobs) {
        const items = [];
        job.items = items;
        const xsAll = job.boxes.map((b) => b.minX);
        const xStart = Math.min(...xsAll);
        const headEnd = xStart + job.sys.gap * 1.2;
        // Tout ce qui précède la première barre (noms de cordes, « TAB ») n'est pas une note.
        const firstBar = job.bars.length ? (job.bars[0].x0 + job.bars[0].x1) / 2 : -1;
        const hasHeadBar = firstBar >= 0 && firstBar - xStart <= job.sys.gap * 2;
        for (const box of job.boxes) {
          const x = (box.minX + box.maxX) / 2;
          done++;
          if (onProgress) onProgress(done / total);
          if (hasHeadBar && x < firstBar) continue;
          const crop = cropDigit(box, job.mask, job.bw);
          // Les lettres restent permises au premier essai : T, A, B en tête de ligne ne doivent pas devenir des chiffres.
          let txt = await read(crop, '7', '0123456789TABECGDF');
          if (!isFret(txt)) {
            if (/^[TABECGDF]+$/.test(txt) && box.minX <= headEnd) continue;
            txt = await read(crop, '10', '0123456789');
          }
          if (isFret(txt)) {
            items.push({ x, row: box.row, fret: +txt });
            if (txt.length === 1) templates.push({ fret: +txt, g: glyph(box, job) });
          } else pendingAll.push({ box, job, x });
        }
      }
      for (const { box, job, x } of pendingAll) {
        const g = glyph(box, job);
        let best = null; let bestScore = 0.85;
        templates.forEach((t) => {
          let same = 0;
          for (let i = 0; i < g.length; i++) if (g[i] === t.g[i]) same++;
          const sc = same / g.length;
          if (sc > bestScore) { bestScore = sc; best = t; }
        });
        if (best) job.items.push({ x, row: box.row, fret: best.fret }); else unread++;
      }
      for (const job of jobs) {
        const items = job.items;
        if (!items.length) continue;
        // Sous une portée, les accords sont imprimés au-dessus de celle-ci plutôt qu'au-dessus de la tablature.
        const at = groups.indexOf(job.sys);
        const prev = groups[at - 1];
        const under = prev && prev.lines.length === 5 && job.sys.lines[0].top - prev.lines[4].bot < job.sys.gap * 8;
        const names = await readChordBand(prep, dark, worker, groups, under ? at - 1 : at);
        blocks.push((names ? names + '\n' : '') + systemToText(items, job.bars, job.sys, size === 6 ? ['e', 'B', 'G', 'D', 'A', 'E'] : ['A', 'E', 'C', 'G']));
      }
      if (blocks.length) return { text: blocks.join('\n\n'), unread };
    }
    return null;
  }

  let tessLoaded = null;
  function loadTesseract() {
    if (!tessLoaded) {
      tessLoaded = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/tesseract/tesseract.min.js';
        s.onload = resolve; s.onerror = () => reject(new Error('Module de lecture indisponible'));
        document.head.appendChild(s);
      });
    }
    return tessLoaded;
  }

  async function ocr(blob, onProgress) {
    await loadTesseract();
    const base = new URL('vendor/tesseract/', document.baseURI).href;
    const worker = await global.Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, cacheMethod: 'none', workerBlobURL: false,
      logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); },
    });
    try {
      const prep = await prepareImage(blob);
      const tab = await readTabImage(prep, worker, onProgress);
      if (tab) return tab;
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', tessedit_char_whitelist: '' });
      const res = await worker.recognize(prep.canvas);
      return { text: res.data.text, unread: 0 };
    } finally {
      await worker.terminate();
    }
  }

  global.UkuImport = { fetchRemote, sniff, decodeText, parseHtml, ocr, chordsInBand, MAX_BYTES };
})(window);
