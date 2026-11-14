// Boxes that scroll sideways (wide formulas, wide diagrams) fade out on the side where there is more to see:
// the classes fade-left and fade-right (scroll-fades in _diagrams.scss). The boxes are measured in batches,
// after the browser's own layout: one ResizeObserver reports them, all are read first and their classes
// written after, so a page with a hundred of them is laid out once instead of once per box. A box is measured
// again when it is scrolled, when its size changes, and when fonts have loaded (a formula changes width then,
// although its box does not). Nothing here reads document.fonts.ready: in Chrome that alone lays out the
// whole page at once (0.3-0.7 s on a long week at a 4x slower CPU).
import { onPageEnd } from './page';
import { isRendered } from './utils';

const boxes = new Set();
// The observed elements: a box, and its content (below).
const boxOf = new WeakMap();
let observer = null;
let queued = false;

// A box's content, drawn or not: the box can itself be a block that the browser skips while it is off screen
// (_ui.scss), and then only its content is not drawn. The content is observed too: it has no size while it is
// skipped and gets its real one when it comes into view, so that the observer reports the box then.
const contentOf = box => box.firstElementChild || box;
const drawn = box => isRendered(contentOf(box));

// Measures the boxes of `list` that are drawn now (one in a block that the browser skips, off screen, is reported
// again when it comes into view: _ui.scss).
function measure(list) {
  const states = list
    .filter(box => box.isConnected && drawn(box))
    .map(box => {
      const hidden = box.scrollWidth - box.clientWidth;

      return [box, hidden > 1 && box.scrollLeft > 1, hidden > 1 && box.scrollLeft < hidden - 1];
    });

  states.forEach(([box, left, right]) => {
    box.classList.toggle('fade-left', left);
    box.classList.toggle('fade-right', right);
  });
}

// All the boxes again (fonts have loaded): those drawn now; those in blocks that the browser skips (off screen,
// _ui.scss) are observed afresh, so that they are measured when they come into view, without laying them out now.
function measureAll() {
  queued = false;
  boxes.forEach(box => {
    if (!box.isConnected) {
      boxes.delete(box);
    }
  });

  const all = [...boxes];

  if (observer) {
    all.filter(box => !drawn(box)).forEach(box => {
      observer.unobserve(contentOf(box));
      observer.observe(contentOf(box));
    });
  }

  measure(all.filter(drawn));
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
    observer = new ResizeObserver(entries => measure([...new Set(entries.map(entry => boxOf.get(entry.target)).filter(Boolean))]));

    if (document.fonts && 'onloadingdone' in document.fonts) {
      document.fonts.addEventListener('loadingdone', queue);
    }
  }

  // The first report comes after the next layout. The box goes with its page (page.js).
  boxOf.set(box, box);
  boxOf.set(contentOf(box), box);
  observer.observe(box);
  observer.observe(contentOf(box));
  onPageEnd(() => {
    observer.unobserve(box);
    observer.unobserve(contentOf(box));
    boxes.delete(box);
  });
}
