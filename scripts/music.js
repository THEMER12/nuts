(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const KEY_SONG = 'currentSong';
  const KEY_VOLUME = 'player:volume';
  const KEY_MUTED = 'player:muted';

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ } }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initIndex();
    initPlayer();
  });

  /* ------------------------------------------------------------------
   * Índice: al pulsar una portada se guarda la canción y se abre el player
   * ------------------------------------------------------------------ */
  function initIndex() {
    document.querySelectorAll('.song-card').forEach((card) => {
      card.addEventListener('click', () => {
        const img = card.querySelector('img');
        store.set(KEY_SONG, JSON.stringify({
          audio: card.dataset.song,
          lyrics: card.dataset.lyrics,
          cover: img ? img.src : '' // URL absoluta: funciona desde cualquier carpeta
        }));
        window.location.href = 'page/player.html';
      });
    });
  }

  /* ------------------------------------------------------------------
   * Player
   * ------------------------------------------------------------------ */
  function initPlayer() {
    const audio = $('audio-player');
    if (!audio) return;

    const lyricsEl = $('lyrics-container');
    const cover = $('img-music');
    const titleEl = $('title-music');
    const playBtn = $('play-pause-btn');
    const playIcon = $('play-icon');
    const pauseIcon = $('pause-icon');
    const seek = $('seek-slider');
    const curEl = $('current-time');
    const durEl = $('duration-time');
    const volSlider = $('volume-slider');
    const muteBtn = $('mute-btn');

    let song = null;
    try { song = JSON.parse(store.get(KEY_SONG)); } catch { /* datos corruptos */ }

    if (!song || !song.audio) {
      lyricsEl.textContent = 'Elige una canción';
      lyricsEl.classList.add('text-neutral-500');
      return;
    }

    /* ---------- utilidades ---------- */
    const fmt = (s) => {
      if (!isFinite(s)) return '0:00';
      return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    };
    // "m:ss.xx" (o "h:mm:ss") -> segundos
    const parseTime = (str) => String(str).split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
    const paint = (el) => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');

    /* ---------- título y portada ---------- */
    const title = decodeURIComponent(song.audio.split('/').pop())
      .replace(/\.(flac|mp3|wav|m4a|ogg)$/i, '')
      .replace(/^\d+\s*[-.]?\s+/, ''); // quita el número de pista inicial
    titleEl.textContent = title;
    document.title = title;

    let targetColor = { r: 255, g: 255, b: 255 };
    const color = { ...targetColor };

    cover.crossOrigin = 'anonymous';
    cover.addEventListener('load', () => { targetColor = dominantColor(cover); });
    if (song.cover) cover.src = song.cover;

    /* ---------- volumen ---------- */
    let volume = parseFloat(store.get(KEY_VOLUME));
    volume = isFinite(volume) ? clamp(volume, 0, 1) : 0.8;
    let muted = store.get(KEY_MUTED) === '1';

    function applyVolume() {
      audio.volume = volume;
      audio.muted = muted;
      volSlider.value = muted ? 0 : Math.round(volume * 100);
      paint(volSlider);

      const state = muted || volume === 0 ? 'mute' : volume < 0.5 ? 'low' : 'high';
      muteBtn.querySelectorAll('[data-icon]').forEach((svg) => {
        svg.classList.toggle('hidden', svg.dataset.icon !== state);
      });
      muteBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
      store.set(KEY_VOLUME, String(volume));
      store.set(KEY_MUTED, muted ? '1' : '0');
    }

    function setVolume(v) {
      volume = clamp(v, 0, 1);
      muted = volume === 0;
      applyVolume();
    }

    function toggleMute() {
      muted = !muted;
      if (!muted && volume === 0) volume = 0.5;
      applyVolume();
    }

    volSlider.addEventListener('input', () => setVolume(volSlider.value / 100));
    muteBtn.addEventListener('click', toggleMute);
    applyVolume();

    /* ---------- reproducción ---------- */
    const togglePlay = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());

    function syncPlayState() {
      const playing = !audio.paused && !audio.ended;
      playIcon.classList.toggle('hidden', playing);
      pauseIcon.classList.toggle('hidden', !playing);
      playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    }

    playBtn.addEventListener('click', togglePlay);
    ['play', 'pause', 'ended'].forEach((ev) => audio.addEventListener(ev, syncPlayState));
    audio.addEventListener('play', ensureGraph);
    audio.addEventListener('durationchange', () => { durEl.textContent = fmt(audio.duration); });

    let seeking = false;
    seek.addEventListener('input', () => {
      seeking = true;
      paint(seek);
      if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
    });
    seek.addEventListener('change', () => { seeking = false; });

    audio.src = song.audio;
    audio.play().catch(() => { /* autoplay bloqueado: el usuario pulsa play */ });

    /* ---------- atajos de teclado ---------- */
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onRange = e.target instanceof HTMLInputElement;

      switch (e.key) {
        case ' ':
          if (e.target.closest('button, a')) return; // esos ya reaccionan solos
          e.preventDefault(); togglePlay(); break;
        case 'm': case 'M':
          toggleMute(); break;
        case 'ArrowUp':
          if (onRange) return;
          e.preventDefault(); setVolume(volume + 0.05); break;
        case 'ArrowDown':
          if (onRange) return;
          e.preventDefault(); setVolume(volume - 0.05); break;
        case 'ArrowRight':
          if (onRange) return;
          audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); break;
        case 'ArrowLeft':
          if (onRange) return;
          audio.currentTime = Math.max(0, audio.currentTime - 5); break;
      }
    });

    /* ---------- controles del sistema (pantalla de bloqueo, teclas multimedia) ---------- */
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artwork: song.cover ? [{ src: song.cover }] : []
        });
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('seekto', (d) => { audio.currentTime = d.seekTime; });
      } catch { /* no soportado */ }
    }

    /* ---------- letras ---------- */
    let lines = [];
    let lineIdx = -2;
    let hasLyrics = false;
    let fadeTimer;

    async function loadLyrics(url) {
      try {
        if (!url || url.endsWith('/')) throw new Error('Sin archivo de letra');
        const res = await fetch(url);
        if (!res.ok) throw new Error('Error al cargar el JSON');
        const data = await res.json();
        lines = (data.lyrics_and_bass_analysis || [])
          .map((item) => ({ t: parseTime(item.timestamp), text: String(item.lyrics ?? '') }))
          .filter((l) => isFinite(l.t))
          .sort((a, b) => a.t - b.t);
        hasLyrics = lines.length > 0;
      } catch (err) {
        console.warn('Letra no disponible:', err.message);
      }
      if (!hasLyrics) {
        lyricsEl.textContent = 'Letra no disponible';
        lyricsEl.classList.add('text-neutral-600', 'text-2xl', 'md:text-3xl');
      }
    }

    // Última línea cuyo tiempo ya pasó (búsqueda binaria)
    function findLine(t) {
      let lo = 0, hi = lines.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].t <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      return ans;
    }

    function showLine(text) {
      clearTimeout(fadeTimer);
      lyricsEl.style.opacity = '0';
      fadeTimer = setTimeout(() => {
        lyricsEl.textContent = text.replace(/<br\s*\/?>/gi, '\n');
        lyricsEl.style.opacity = '1';
      }, 120);
    }

    loadLyrics(song.lyrics);

    /* ---------- color dominante de la portada ---------- */
    function dominantColor(img) {
      const fallback = { r: 255, g: 255, b: 255 };
      const size = 40;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const cx = c.getContext('2d', { willReadFrequently: true });

      try {
        cx.drawImage(img, 0, 0, size, size);
        const { data } = cx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, total = 0;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue;
          // Los píxeles más saturados pesan más: evita colores apagados
          const sat = (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])) / 255;
          const w = 0.1 + sat;
          r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; total += w;
        }
        if (!total) return fallback;

        let [h, s, l] = rgbToHsl(r / total, g / total, b / total);
        s = Math.min(1, s * 1.5);
        l = clamp(l, 0.4, 0.7);
        return hslToRgb(h, s, l);
      } catch (err) {
        console.warn('No se pudo leer la portada (¿CORS?):', err.message);
        return fallback;
      }
    }

    /* ---------- audio: analizador de frecuencias ---------- */
    let ctx = null, analyser = null, freq = null, graphReady = false;

    // Un AudioContext suspendido deja sin sonido al <audio> si se conecta a él,
    // así que solo se conecta cuando el navegador permite ejecutarlo.
    function ensureGraph() {
      if (graphReady) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().then(buildGraph).catch(() => {});
      } catch (err) {
        console.warn('Analizador no disponible:', err.message);
      }
    }

    function buildGraph() {
      if (graphReady || !ctx || ctx.state !== 'running') return;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      ctx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ctx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      graphReady = true;
    }

    // Si el autoplay estaba bloqueado, el primer gesto activa el analizador
    ['pointerdown', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, () => { if (!graphReady && !audio.paused) ensureGraph(); }, { passive: true })
    );

    /* ---------- visualizador (fuego) ---------- */
    const canvas = $('fire');
    const g = canvas ? canvas.getContext('2d') : null;

    const STEP = 4;      // ancho de cada barra en px
    const MIN_H = 8;
    let W = 0, H = 0, maxH = 0, bars = [];

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      maxH = Math.min(600, H * 0.6);

      bars = Array.from({ length: Math.ceil(W / STEP) + 1 }, () => ({
        h: MIN_H,
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.04,
        rand: 0.75 + Math.random() * 0.5
      }));
    }
    window.addEventListener('resize', resize);
    resize();

    function drawFire(t) {
      g.clearRect(0, 0, W, H);

      const live = graphReady && !audio.paused;
      if (live) analyser.getByteFrequencyData(freq);

      const n = bars.length;
      const usable = live ? freq.length * 0.65 : 0;
      const span = live ? Math.max(1, Math.floor(freq.length * 0.025)) : 0;
      const ys = new Array(n);

      for (let i = 0; i < n; i++) {
        const b = bars[i];
        const pos = i / n;
        let level = 0;

        if (live) {
          const start = Math.floor(pos * usable);
          const end = Math.min(freq.length - 1, start + span);
          let sum = 0;
          for (let k = start; k <= end; k++) sum += freq[k];
          level = (sum / (end - start + 1) / 255) * (1.5 - pos * 0.55); // más peso a los graves
        }

        const target = clamp(MIN_H + level * maxH * b.rand, MIN_H, maxH);
        b.h += (target - b.h) * (target > b.h ? 0.25 : 0.08);
        ys[i] = H - Math.max(MIN_H, b.h + Math.sin(t * b.speed + b.phase) * 7);
      }

      // Una sola silueta suavizada y un único degradado (mucho más ligero)
      const { r, g: gr, b: bl } = color;
      const grad = g.createLinearGradient(0, H - maxH, 0, H);
      grad.addColorStop(0, `rgba(${r | 0},${gr | 0},${bl | 0},0.02)`);
      grad.addColorStop(0.2, `rgba(${r | 0},${gr | 0},${bl | 0},0.10)`);
      grad.addColorStop(0.45, `rgba(${r | 0},${gr | 0},${bl | 0},0.30)`);
      grad.addColorStop(0.7, `rgba(${r | 0},${gr | 0},${bl | 0},0.60)`);
      grad.addColorStop(1, `rgba(${r | 0},${gr | 0},${bl | 0},0.95)`);
      g.fillStyle = grad;

      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, ys[0]);
      for (let i = 0; i < n - 1; i++) {
        const x = i * STEP;
        g.quadraticCurveTo(x, ys[i], x + STEP / 2, (ys[i] + ys[i + 1]) / 2);
      }
      g.lineTo(W, ys[n - 1]);
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }

    /* ---------- bucle principal: interfaz, letras y fuego ---------- */
    let lastCur = '';

    function frame(t) {
      requestAnimationFrame(frame);

      // el color de la llama cambia suavemente hacia el de la portada
      color.r += (targetColor.r - color.r) * 0.06;
      color.g += (targetColor.g - color.g) * 0.06;
      color.b += (targetColor.b - color.b) * 0.06;

      const cur = audio.currentTime;
      const dur = audio.duration;

      const label = fmt(cur);
      if (label !== lastCur) { curEl.textContent = label; lastCur = label; }

      if (!seeking && isFinite(dur) && dur > 0) {
        seek.value = (cur / dur) * 1000;
        paint(seek);
      }

      if (hasLyrics) {
        const idx = findLine(cur);
        if (idx !== lineIdx) {
          lineIdx = idx;
          showLine(idx >= 0 ? lines[idx].text : '');
        }
      }

      if (g) drawFire(t);
    }

    syncPlayState();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
   * Conversión de color
   * ------------------------------------------------------------------ */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3);
      g = hue(p, q, h);
      b = hue(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
})();