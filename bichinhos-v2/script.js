'use strict';

// ── Animal factory ────────────────────────────────────────────────────────────
//
// Cada chamada cria uma trilha completamente isolada:
//   • Audio object próprio → tocam em paralelo sem interferência
//   • SVG injetado inline → pointer-events preciso (só área pintada)
//   • Pop animation própria → cada bichinho reage independente
//
// Para adicionar um novo bichinho, basta chamar createAnimal({...}) no init.

async function createAnimal({ containerId, svgPath, audioPath, label = '', volume = 1.0 }) {

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
    container.appendChild(badge);
  }

  // ── Evento de clique ────────────────────────────────────────────────────────

  svgEl.addEventListener('click', () => {
    triggerPop();
    playAudio();
  });
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
      }),
      createAnimal({
        containerId: 'cat-container',
        svgPath:     'assets/cat-svgrepo-com.svg',
        audioPath:   'sounds/gato.mp3',
        label:       'José',
      }),
      createAnimal({
        containerId: 'horse-container',
        svgPath:     'assets/horse-svgrepo-com.svg',
        audioPath:   'sounds/cavalo.mp3',
        label:       'Israel',
      }),
      createAnimal({
        containerId: 'bird-container',
        svgPath:     'assets/bird-svgrepo-com.svg',
        audioPath:   'sounds/bird.mp3',
        label:       'Sofia',
      }),
    ]);
  } catch (err) {
    console.error('[Bichinhos] Init error:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
