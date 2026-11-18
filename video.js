/* Vidéo de la lecture : la partition défile, la note jouée est surlignée, le son est celui de la lecture. */
(function (global) {
  'use strict';
  const C = global.UkuCore; const S = global.UkuScore;
  const W = 1280; const H = 720; const HEAD = 70; const PAD = 24;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TYPES = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1.42E01F,opus', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

  function pickType() {
    const R = global.MediaRecorder;
    if (!R || !R.isTypeSupported) return null;
    return TYPES.find((t) => R.isTypeSupported(t)) || null;
  }
  function supported() {
    return !!(pickType() && global.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream && (global.AudioContext || global.webkitAudioContext));
  }

  /* La partition entière en image, une seule fois : chaque image de la vidéo en recopie un morceau. */
  async function rasterize(svg, w, h) {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    clone.removeAttribute('style');
    const cursorEl = clone.querySelector('rect.no-print');
    if (cursorEl) cursorEl.remove();
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      return cv;
    } finally { URL.revokeObjectURL(url); }
  }

  /* o : { score, view, bpm, title, diagrams, lyrics, canvas, onProgress(0..1) }. Renvoie { promise, cancel }. */
  function record(o) {
    let cancelled = false; let finish = null;
    const promise = (async () => {
      const type = pickType();
      if (!type || !supported()) throw new Error('vidéo non disponible sur cet appareil');
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-30000px;top:0;width:' + (W - 2 * PAD) + 'px;background:#fff';
      document.body.appendChild(host);
      let dest = null; let rec = null;
      try {
        const perLine = C.printBarsPerLine(o.score.meter);
        const shot = S.draw(host, o.score, o.view, { lines: C.fixedLines(o.score, perLine), perLine, width: W - 2 * PAD, diagrams: o.diagrams, lyrics: o.lyrics, names: o.names, solfege: o.solfege });
        const raster = await rasterize(shot.svg, shot.width, shot.height);
        host.remove();
        if (cancelled) return null;
        const scale = (W - 2 * PAD) / shot.width;
        const viewH = H - HEAD - 12; // hauteur visible de la partition, en pixels de la vidéo
        const maxY = Math.max(0, shot.height - viewH / scale);

        const canvas = o.canvas; canvas.width = W; canvas.height = H;
        const g = canvas.getContext('2d');
        dest = S.captureAudio();
        const stream = canvas.captureStream(30);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        const chunks = [];
        rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2500000 });
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const stopped = new Promise((res) => { rec.onstop = res; });
        rec.start(1000);
        const timing = S.play(o.score, o.bpm, null, { lead: 1.2, follow: false });
        const endAt = timing.end + 1.5;
        let y = 0; let line = 0; let last = null;

        const title = (o.title || '').trim() || 'Arpège';
        const frame = () => {
          const now = timing.ctx.currentTime;
          const unit = (now - timing.start) / timing.unitSec;
          const pos = unit >= 0 ? C.eventAt(o.score, unit) : null;
          const m = pos && shot.marks[pos.bar] && shot.marks[pos.bar][pos.index];
          if (m) { line = m.line; last = m; } else if (pos === null && unit >= 0) last = null;
          const target = Math.min(maxY, Math.max(0, shot.lineTops[line] - 6));
          y += (target - y) * 0.12;
          if (Math.abs(target - y) < 0.5) y = target;
          g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
          g.fillStyle = '#0f6b63'; g.font = 'italic 700 34px Georgia, "Noto Serif", serif'; g.textBaseline = 'middle';
          g.fillText(title, PAD, HEAD / 2, W - 2 * PAD - 160);
          g.fillStyle = '#6d675b'; g.font = '20px Arial, sans-serif'; g.textAlign = 'right';
          g.fillText('♩ = ' + o.bpm, W - PAD, HEAD / 2); g.textAlign = 'left';
          g.fillStyle = '#d9d2c3'; g.fillRect(PAD, HEAD - 2, W - 2 * PAD, 1);
          const srcH = Math.min(shot.height - y, viewH / scale);
          g.drawImage(raster, 0, y, shot.width, srcH, PAD, HEAD + 8, W - 2 * PAD, srcH * scale);
          if (m) {
            g.fillStyle = 'rgba(95,91,82,0.2)';
            g.fillRect(PAD + (m.x - 11) * scale, HEAD + 8 + (m.top - y) * scale, 22 * scale, (m.bottom - m.top) * scale);
          }
          if (o.onProgress) o.onProgress(Math.min(1, Math.max(0, (now - timing.start + 1.2) / (endAt - timing.start + 1.2))));
          if (cancelled || now >= endAt) { if (rec.state !== 'inactive') rec.stop(); return; }
          // Fenêtre cachée : les images ralentissent, mais la vidéo suit toujours l'horloge du son.
          if (document.hidden) setTimeout(frame, 40); else global.requestAnimationFrame(frame);
        };
        frame();
        finish = () => { cancelled = true; };
        await stopped;
        S.stop();
        if (cancelled) return null;
        const mime = type.split(';')[0];
        return { blob: new Blob(chunks, { type: mime }), ext: mime === 'video/mp4' ? 'mp4' : 'webm', mime };
      } finally {
        host.remove();
        if (dest) S.releaseAudio(dest);
      }
    })();
    return { promise, cancel: () => { cancelled = true; if (finish) finish(); S.stop(); } };
  }

  global.UkuVideo = { supported, record };
})(window);
