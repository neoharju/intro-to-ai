// Boxes that scroll sideways (wide formulas, wide diagrams) fade out on the side where there is more to see:
// the classes fade-left and fade-right (scroll-fades in _diagrams.scss). The boxes are measured in batches,
// after the browser's own layout: one ResizeObserver reports them, all are read first and their classes
// written after, so a page with a hundred of them is laid out once instead of once per box. A box is measured
// again when it is scrolled, when its size changes, and when fonts have loaded (a formula changes width then,
// although its box does not). Nothing here reads document.fonts.ready: in Chrome that alone lays out the
// whole page at once (0.3-0.7 s on a long week at a 4x slower CPU).
import { onPageEnd } from './page';

const boxes = new Set();
let observer = null;
let queued = false;

function measure(list) {
  const states = list
    .filter(box => box.isConnected)
    .map(box => {
      const hidden = box.scrollWidth - box.clientWidth;

      return [box, hidden > 1 && box.scrollLeft > 1, hidden > 1 && box.scrollLeft < hidden - 1];
    });

  states.forEach(([box, left, right]) => {
    box.classList.toggle('fade-left', left);
    box.classList.toggle('fade-right', right);
  });
}

function measureAll() {
  queued = false;
  boxes.forEach(box => {
    if (!box.isConnected) {
      boxes.delete(box);
    }
  });
  measure([...boxes]);
}

function queue() {
  if (!queued) {
    queued = true;
    window.requestAnimationFrame(measureAll);
  }
}

export default function watchFades(box) {
  if (boxes.has(box)) {
    return;
  }

  boxes.add(box);
  box.addEventListener('scroll', () => measure([box]), { passive: true });

  if (!('ResizeObserver' in window)) {
    queue();
    return;
  }

  if (!observer) {
    observer = new ResizeObserver(entries => measure(entries.map(entry => entry.target)));

    if (document.fonts && 'onloadingdone' in document.fonts) {
      document.fonts.addEventListener('loadingdone', queue);
    }
  }

  // The first report comes after the next layout. The box goes with its page (page.js).
  observer.observe(box);
  onPageEnd(() => {
    observer.unobserve(box);
    boxes.delete(box);
  });
}
