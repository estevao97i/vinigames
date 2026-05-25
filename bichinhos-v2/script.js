/**
 * Bichinhos v2 — Bird Controller
 *
 * Strategy
 * ─────────
 * The source SVG has SMIL animations that autoplay and loop
 * (begin="0s" + repeatCount="indefinite"). Before injecting the SVG
 * inline we rewrite those attributes so that:
 *
 *   • begin="0s"              → begin="indefinite"  (no autostart)
 *   • repeatCount="indefinite"→ repeatCount="1"     (play once, not forever)
 *   • fill="freeze"           → fill="remove"       (snap back to initial
 *                                                    state when done)
 *
 * On click we call beginElement() on every SMIL animation simultaneously,
 * which starts them all from frame 0 in perfect sync. Repeat clicks
 * restart everything instantly — no debounce, no lock.
 */

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG = Object.freeze({
  svgPathBird: 'assets/bird-svgrepo-com.svg',
  svgPathHorse: 'assets/horse-svgrepo-com.svg',
  audioPathBird: 'sounds/bird.mp3',
  audioPathHorse: 'sounds/horse.mp3',
  containerId: 'bird-container',
  audioVolume: 1.0,
});

// ── Audio Controller ──────────────────────────────────────────────────────────

const AudioController = (() => {
  const el = new Audio(CONFIG.audioPathBird);
  el.preload = 'auto';
  el.volume = CONFIG.audioVolume;

  /**
   * Stop wherever it is, rewind, and play from the top.
   * Safe to call mid-playback — each click triggers a clean restart.
   */
  function restart() {
    el.pause();
    el.currentTime = 0;
    el.play().catch(() => {
      // Browser may block playback without a prior user gesture.
      // Since we're always inside a click handler this is fine.
    });
  }

  return { restart };
})();

// ── SVG Controller ────────────────────────────────────────────────────────────

const SvgController = (() => {
  /** @type {SVGSVGElement | null} */
  let svgEl = null;

  /** @type {Element[]} */
  let animEls = [];

  // /**
  //  * Rewrite animation attributes in the raw SVG text before DOM injection.
  //  * This is the safest way to prevent autoplay — no race conditions.
  //  *
  //  * @param {string} text - Raw SVG source
  //  * @returns {string}
  //  */
  // function preprocess(text) {
  //   return text
  //     .replace(/repeatCount="indefinite"/g, 'repeatCount="1"')  // no loop
  //     .replace(/begin="0s"/g,               'begin="indefinite"') // no autostart
  //     .replace(/fill="freeze"/g,            'fill="remove"');      // reset on end
  // }

  /**
   * Fetch the SVG, preprocess it, inject inline, and collect animation refs.
   *
   * @param {string} containerId
   * @param {string} path
   * @returns {Promise<SVGSVGElement>}
   */
  async function load(containerId, path) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found.`);

    const res = await fetch(path);
    if (!res.ok) throw new Error(`SVG fetch failed (${res.status}): ${path}`);

    container.innerHTML = `<img src="${CONFIG.svgPathBird}" alt="Bird">`;

    svgEl = container.querySelector('img');
    if (!svgEl) throw new Error('No <svg> element found in the fetched file.');

    // Let CSS control dimensions.
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';

    // Collect every SMIL animation element for batch-triggering on click.
    animEls = [
      ...svgEl.querySelectorAll('animate, animateTransform, animateMotion, set'),
    ];

    return svgEl;
  }

  /**
   * Trigger all animations from frame 0 simultaneously.
   * Calling this while already playing restarts from the top instantly.
   */
  function play() {
    animEls.forEach(anim => anim.beginElement());
  }

  /** @returns {SVGSVGElement | null} */
  function getElement() { return svgEl; }

  return { load, play, getElement };
})();

// ── App ───────────────────────────────────────────────────────────────────────

async function init() {
  console.log('[Bichinhos] Initializing...');
  try {
    await SvgController.load(CONFIG.containerId, CONFIG.svgPathBird);

    console.log('[Bichinhos] Initialization complete. Ready for clicks!');

    const svgEl = SvgController.getElement();

    // Every click: restart animation + audio from the top — no exceptions.
    svgEl.addEventListener('click', () => {
      SvgController.play();
      // restart css pop animation
      const container = document.getElementById(CONFIG.containerId);

      container.classList.remove('pop');

      // força reflow pra reiniciar animação CSS
      void container.offsetWidth;

      container.classList.add('pop');
      AudioController.restart();
    });

  } catch (err) {
    console.error('[Bichinhos] Init error:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
