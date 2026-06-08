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

  // ── Áudio isolado ───────────────────────────────────────────────────────────

  const audio = new Audio(audioPath);
  audio.preload = 'auto';
  audio.volume  = volume;

  function playAudio() {
    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => {});
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
