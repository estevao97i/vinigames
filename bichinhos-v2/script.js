'use strict';

// ── Animal factory ────────────────────────────────────────────────────────────
//
// Cada chamada cria uma trilha completamente isolada:
//   • Audio object próprio → tocam em paralelo sem interferência
//   • SVG injetado inline → pointer-events preciso (só área pintada)
//   • Pop animation própria → cada bichinho reage independente
//
// Para adicionar um novo bichinho, basta chamar createAnimal({...}) no init.

async function createAnimal({ containerId, svgPath, audioPath, label = '', volume = 1.0, badgeColor = '#ff7ec4' }) {

  // ── Áudio isolado ────────────────────────────────────────────────────────────
  //
  // Estratégia robusta com 2 caminhos:
  //   • Web Audio (AudioBuffer) → disparo INSTANTÂNEO, vozes paralelas. Usado
  //     quando o contexto já está liberado (após o 1º gesto do usuário).
  //   • HTMLAudio (fallback) → SEMPRE disponível. Garante som no celular já no
  //     primeiro toque, mesmo antes do Web Audio estar pronto.

  let audioBuffer = null;
  let decoding = false;

  // Baixa os bytes do MP3 em paralelo (não trava o carregamento do SVG)
  const arrayBufPromise = fetch(audioPath)
    .then(r => r.arrayBuffer())
    .catch(() => null);

  // Fallback sempre pronto
  const htmlFallback = new Audio(audioPath);
  htmlFallback.preload = 'auto';

  async function ensureDecoded() {
    if (audioBuffer || decoding) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    decoding = true;
    try {
      const ab = await arrayBufPromise;
      if (ab) audioBuffer = await ctx.decodeAudioData(ab.slice(0));
    } catch (_) {}
    decoding = false;
  }
  _animalDecoders.push(ensureDecoded); // será chamado no 1º gesto (unlock)

  function playAudio() {
    const ctx = _audioCtx;
    if (ctx && ctx.state === 'running' && audioBuffer) {
      // caminho instantâneo (Web Audio), vozes independentes/paralelas
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      const g = ctx.createGain();
      g.gain.value = volume;
      src.connect(g);
      g.connect(ctx.destination);
      src.start(0);
      src.onended = () => { src.disconnect(); g.disconnect(); };
    } else {
      // fallback confiável (funciona no mobile dentro do gesto de clique)
      try { htmlFallback.currentTime = 0; } catch (_) {}
      htmlFallback.play().catch(() => {});
      ensureDecoded(); // prepara o Web Audio p/ os próximos toques (instantâneo)
    }
  }

  // ── SVG inline ──────────────────────────────────────────────────────────────

  const container = document.getElementById(containerId);
  if (!container) throw new Error(`#${containerId} not found`);

  const res = await fetch(svgPath);
  if (!res.ok) throw new Error(`SVG fetch failed (${res.status}): ${svgPath}`);

  container.innerHTML = await res.text();

  const svgEl = container.querySelector('svg');
  if (!svgEl) throw new Error(`No <svg> found in ${svgPath}`);

  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  svgEl.style.width  = '100%';
  svgEl.style.height = '100%';

  // ── Pop animation ───────────────────────────────────────────────────────────

  function triggerPop() {
    container.classList.remove('pop');
    void container.offsetWidth; // força reflow para reiniciar a animação CSS
    container.classList.add('pop');
    container.addEventListener('animationend', () => {
      container.classList.remove('pop');
    }, { once: true });
  }

  // ── Badge com nome ──────────────────────────────────────────────────────────

  if (label) {
    const badge = document.createElement('span');
    badge.className   = 'animal-label';
    badge.textContent = label;
    badge.style.background = badgeColor;
    container.appendChild(badge);
  }

  // ── Evento de clique ────────────────────────────────────────────────────────

  svgEl.addEventListener('click', () => {
    triggerPop();
    playAudio();
  });
}

// ── Notas do título (teclado fofinho em Dó maior) ──────────────────────────────
//
// Sintetizado com Web Audio API: sem arquivos, sem carregamento → performático.
// Cada letra = uma nota da escala de Dó maior, ascendente. É MONOFÔNICO com corte
// rápido: ao tocar uma nova nota, a anterior é silenciada em ~25ms, então os sons
// nunca se sobrepõem.

let _audioCtx = null;
let _activeVoice = null;
const _animalDecoders = []; // funções que decodificam o som de cada animal

// Cria o AudioContext sob demanda. NÃO resume aqui — o resume só vale dentro de
// um gesto do usuário (exigência dos navegadores).
function getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { _audioCtx = new AC(); } catch (_) { return null; }
  }
  return _audioCtx;
}

function resumeAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Destrava o áudio no PRIMEIRO gesto do usuário. Navegadores (Chrome/Safari, e
// principalmente no celular) só permitem iniciar som após uma interação — passar
// o mouse NÃO conta. Aqui pegamos o primeiro clique/toque/tecla em qualquer lugar
// e liberamos tudo de uma vez.
function installAudioUnlock() {
  const events = ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'];
  const unlock = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // iOS/Safari: tocar um buffer silencioso DENTRO do gesto libera o Web Audio.
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (_) {}
    if (ctx.state === 'suspended') ctx.resume();
    // assim que liberar, decodifica os sons dos animais (p/ disparo instantâneo)
    _animalDecoders.forEach(fn => fn());
    if (ctx.state === 'running') {
      events.forEach(ev => window.removeEventListener(ev, unlock, true));
    }
  };
  events.forEach(ev => window.addEventListener(ev, unlock, true));
}

// Frequências da escala de Dó maior (C, D, E, F, G, A, B...) subindo por oitavas.
function buildCMajorScale(count) {
  const C4 = 261.63;
  const degrees = [0, 2, 4, 5, 7, 9, 11]; // semitons de Dó maior
  const freqs = [];
  for (let i = 0; i < count; i++) {
    const semitones = degrees[i % 7] + 12 * Math.floor(i / 7);
    freqs.push(C4 * Math.pow(2, semitones / 12));
  }
  return freqs;
}

function playKeyNote(freq) {
  const ctx = resumeAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Silencia a nota anterior (monofônico → sem sobreposição)
  if (_activeVoice) {
    const v = _activeVoice;
    _activeVoice = null;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), now);
      v.gain.gain.linearRampToValueAtTime(0.0001, now + 0.025);
      v.oscs.forEach(o => { try { o.stop(now + 0.03); } catch (_) {} });
    } catch (_) {}
  }

  // Voz nova: triângulo (corpo) + senoide uma oitava acima (brilho) + lowpass suave
  const master = ctx.createGain();
  master.connect(ctx.destination);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  lp.Q.value = 0.7;
  lp.connect(master);

  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.3;
  o1.connect(lp);
  o2.connect(g2);
  g2.connect(lp);

  // Envelope tipo "pluck" (ataque rápido, decay curto e fofinho)
  const peak = 0.2, attack = 0.008, dur = 0.22;
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(peak, now + attack);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  o1.start(now);
  o2.start(now);
  o1.stop(now + dur + 0.02);
  o2.stop(now + dur + 0.02);

  const voice = { gain: master, oscs: [o1, o2] };
  _activeVoice = voice;
  o1.onended = () => {
    o1.disconnect(); o2.disconnect(); g2.disconnect(); lp.disconnect(); master.disconnect();
    if (_activeVoice === voice) _activeVoice = null;
  };
}

function setupTitleSounds() {
  const title = document.querySelector('.game-title');
  if (!title) return;

  const letters = [...title.querySelectorAll('.line > span')];
  if (!letters.length) return;

  const scale = buildCMajorScale(letters.length);
  letters.forEach((el, i) => {
    el.classList.add('key');
    el.dataset.freq = scale[i].toFixed(2);
  });

  let lastEl = null;
  const trigger = (el) => {
    if (!el || el === lastEl || !el.dataset || !el.dataset.freq) return;
    lastEl = el;
    playKeyNote(parseFloat(el.dataset.freq));
    // saltinho visual
    el.classList.remove('key-bounce');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('key-bounce');
  };

  // ── Mouse: pointerover dispara 1x ao entrar em cada letra (eficiente) ──
  title.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return; // toque tratado abaixo
    const el = e.target.closest && e.target.closest('.key');
    if (el && title.contains(el)) trigger(el);
  });
  title.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const to = e.relatedTarget;
    if (!to || !to.closest || !to.closest('.key')) lastEl = null;
  });

  // ── Toque arrastando: elementFromPoint com throttle via rAF ──
  let touchScheduled = false;
  let lastTouch = null;
  const processTouch = () => {
    touchScheduled = false;
    if (!lastTouch) return;
    const el = document.elementFromPoint(lastTouch.clientX, lastTouch.clientY);
    const letter = el && el.closest ? el.closest('.key') : null;
    if (letter && title.contains(letter)) trigger(letter);
    else lastEl = null;
  };
  const onTouch = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    lastTouch = { clientX: t.clientX, clientY: t.clientY };
    if (touchScheduled) return;
    touchScheduled = true;
    requestAnimationFrame(processTouch);
  };
  title.addEventListener('touchstart', onTouch, { passive: true });
  title.addEventListener('touchmove', onTouch, { passive: true });
  title.addEventListener('touchend', () => { lastEl = null; }, { passive: true });
}

// ── Auto-ajuste do grid ────────────────────────────────────────────────────────
//
// Calcula o maior tamanho possível para os bichinhos de forma que TODOS caibam na
// área visível (largura × altura disponíveis abaixo do título), sem rolagem.
// Quanto mais animais, menores eles ficam — automaticamente.

const ANIMAL_MAX = 200; // teto de tamanho (px) — bichinho nunca fica gigante
const LABEL_ROOM = 26;  // espaço reservado p/ o sticker do nome (pendura abaixo)

function fitStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  const items = stage.querySelectorAll('.animal-container');
  const n = items.length;
  if (!n) return;

  const cs = getComputedStyle(stage);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop)  + parseFloat(cs.paddingBottom);
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap)    || 0;

  const W = stage.clientWidth  - padX;
  const H = stage.clientHeight - padY;
  if (W <= 0 || H <= 0) return;

  // Testa cada quantidade de colunas e escolhe a que permite o maior bichinho.
  let best = 0;
  let bestCols = 1;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const sizeByW = (W - (cols - 1) * colGap) / cols;
    const sizeByH = (H - (rows - 1) * rowGap - rows * LABEL_ROOM) / rows;
    const size = Math.min(sizeByW, sizeByH);
    if (size > best) {
      best = size;
      bestCols = cols;
    }
  }

  best = Math.max(0, Math.min(best, ANIMAL_MAX));
  stage.style.setProperty('--animal-size', best + 'px');
  stage.style.gridTemplateColumns = `repeat(${bestCols}, var(--animal-size))`;
}

// Recalcula em resize/rotação (com throttle via requestAnimationFrame)
let fitQueued = false;
function scheduleFit() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitStage(); });
}
window.addEventListener('resize', scheduleFit);
window.addEventListener('orientationchange', scheduleFit);
// Reavalia quando a fonte do título carrega (muda a altura do header)
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(scheduleFit);
}

// ── App ───────────────────────────────────────────────────────────────────────

async function init() {
  installAudioUnlock();  // prepara/destrava o áudio o quanto antes
  setupTitleSounds();    // ativa as notinhas do título (DOM já disponível)
  try {
    // Promise.all carrega os dois em paralelo — mais rápido e independentes
    await Promise.all([
      createAnimal({
        containerId: 'dog-container',
        svgPath:     'assets/dog-svgrepo-com.svg',
        audioPath:   'sounds/cachorro.mp3',
        label:       'Carmen',
        badgeColor:  'linear-gradient(135deg, #ff8fce 0%, #f0468f 100%)', // rosa (menina)
      }),
      createAnimal({
        containerId: 'cat-container',
        svgPath:     'assets/cat-svgrepo-com.svg',
        audioPath:   'sounds/gato.mp3',
        label:       'José',
        badgeColor:  'linear-gradient(135deg, #5fb0ff 0%, #2f6fe6 100%)', // azul (menino)
      }),
      createAnimal({
        containerId: 'horse-container',
        svgPath:     'assets/horse-svgrepo-com.svg',
        audioPath:   'sounds/cavalo.mp3',
        label:       'Israel',
        badgeColor:  'linear-gradient(135deg, #54d6a0 0%, #1f9d6b 100%)', // verde (menino)
      }),
      createAnimal({
        containerId: 'bird-container',
        svgPath:     'assets/bird-svgrepo-com.svg',
        audioPath:   'sounds/bird.mp3',
        label:       'Sofia',
        badgeColor:  'linear-gradient(135deg, #c98cf0 0%, #9a4bd6 100%)', // roxo/lilás (menina)
      }),
      createAnimal({
        containerId: 'wolf-container',
        svgPath:     'assets/wolf-svgrepo-com.svg',
        audioPath:   'sounds/lobo.mp3',
        label:       'Aurora',
        badgeColor:  'linear-gradient(135deg, #ffa66b 0%, #f0613c 100%)', // coral (menina)
      }),
    ]);
    fitStage(); // dimensiona os bichinhos para caberem sem rolagem
  } catch (err) {
    console.error('[Bichinhos] Init error:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
