export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Height of the sticky navigation bar plus a little air, so that a scrolled-to element is not
// hidden under the bar.
export function navOffset() {
  const bar = document.querySelector('.header-wrapper');

  return bar ? bar.getBoundingClientRect().height + 16 : 0;
}

export function scrollToId(id) {
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  const top = target.getBoundingClientRect().top + window.scrollY - navOffset();

  $('html, body').stop().animate({ scrollTop: top }, prefersReducedMotion() ? 0 : 500);
}
