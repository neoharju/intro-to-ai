export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Height of the sticky navigation bar plus a little air, so that a scrolled-to element is not
// hidden under the bar.
export function navOffset() {
  const bar = document.querySelector('.header-wrapper');

  return bar ? bar.getBoundingClientRect().height + 16 : 0;
}

// The element at the top of the reading area, and its distance from the top of the window, so that
// the reader stays at the same place when the layout changes (zen mode, a larger text size):
// afterwards, scroll by anchor.node.getBoundingClientRect().top - anchor.top.
export function readingAnchor() {
  const y = navOffset() + 8;
  const material = document.getElementById('material');
  let node = document.elementFromPoint(window.innerWidth / 2, y);

  while (node && node.parentElement && node.parentElement !== material && node !== document.body) {
    node = node.parentElement;
  }

  return node && material && material.contains(node) ? { node, top: node.getBoundingClientRect().top } : null;
}

// Before a jump to `target`: the interactive figures above it are built now (viz/lib.js builds a figure
// only when it comes near the screen), so that the target does not move while the page scrolls to it.
export function prepareJump(target) {
  document.dispatchEvent(new CustomEvent('introai:jump', { detail: { target } }));
}

export function scrollToId(id) {
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  prepareJump(target);

  // Measured again in every frame: figures built on the way (viz/lib.js) may move the target.
  animateScroll(() => target.getBoundingClientRect().top + window.scrollY - navOffset());
}

// Scrolls the window to `to` (a position, or a function that gives it, asked again in every frame) in 0.5 s,
// easing in and out (as the site did with jQuery): the browser's own smooth scrolling takes up to 1.5 s for a
// long way. The reader's own scrolling (wheel, touch, keys) stops it.
let scrolling = 0;

export function animateScroll(to, duration = 500) {
  window.cancelAnimationFrame(scrolling);

  const target = typeof to === 'function' ? to : () => to;
  const from = window.scrollY;

  if (prefersReducedMotion() || Math.abs(target() - from) < 2) {
    window.scrollTo(0, target());
    return;
  }

  const start = performance.now();
  const stop = () => {
    window.cancelAnimationFrame(scrolling);
    ['wheel', 'touchstart', 'keydown'].forEach(type => window.removeEventListener(type, stop));
  };

  ['wheel', 'touchstart', 'keydown'].forEach(type => window.addEventListener(type, stop, { passive: true }));

  const frame = now => {
    const progress = Math.min(1, (now - start) / duration);

    window.scrollTo(0, from + (target() - from) * (0.5 - Math.cos(progress * Math.PI) / 2));

    if (progress < 1) {
      scrolling = window.requestAnimationFrame(frame);
    } else {
      stop();
    }
  };

  scrolling = window.requestAnimationFrame(frame);
}
