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

export function scrollToId(id) {
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  const top = target.getBoundingClientRect().top + window.scrollY - navOffset();

  $('html, body').stop().animate({ scrollTop: top }, prefersReducedMotion() ? 0 : 500);
}
