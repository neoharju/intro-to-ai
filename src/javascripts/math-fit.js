// A displayed formula is never wider than the text column, so it never scrolls sideways (on a phone either):
//
//   1. a long formula breaks after a relation or an operation (=, +, ×, …) onto further lines (_math.scss:
//      KaTeX writes the breakable pieces, its stylesheet only keeps them on one line);
//   2. a multi-line environment (\begin{aligned} …) wider than the column shows its rows instead, one by one
//      (math-options.js typesets them beside it), each of which can break as in 1;
//   3. what still does not fit, a single piece wider than the column (a long fraction on a phone), is made
//      just small enough.
//
// The formulas are measured again whenever their box changes size (another width of the window, another text
// size) and when fonts have loaded, all at once after the browser's own layout: first everything back to
// its natural state, then the measures, then the changes.
import { onPageEnd } from './page';
import { isRendered } from './utils';

// How many times a formula that is still too wide is made smaller again (fit).
const ROUNDS = 4;
const watched = new Set();
let observer = null;
let queued = false;

// The formula's own content, drawn or not: a div.math can itself be a block that the browser skips while it is off
// screen (_ui.scss), and then only its content is not drawn. The content is observed too: it has no size while it
// is skipped and gets its real one when it comes into view, so that the observer reports it then.
const contentOf = math => math.firstElementChild || math;
const drawn = math => isRendered(contentOf(math));

// The boxes of a formula that are shown: its environment, or its rows.
function boxesOf(math) {
  return math.classList.contains('is-narrow')
    ? [...math.querySelectorAll(':scope > .katex-rows > .katex-display')]
    : [...math.querySelectorAll(':scope > .katex-display')];
}

// How much of the formula fits: 1 if all of it.
function fitOf(math) {
  return boxesOf(math).reduce((fit, box) => (box.scrollWidth > box.clientWidth + 1 ? Math.min(fit, box.clientWidth / box.scrollWidth) : fit), 1);
}

// Fits the formulas of `list` that are drawn now: one in a block that the browser skips (off screen, _ui.scss) is
// reported again with its real size when it comes into view, and measuring it now would lay its block out.
function fit(list) {
  const maths = list.filter(math => math.isConnected && drawn(math));

  maths.forEach(math => {
    math.classList.remove('is-narrow');
    math.style.fontSize = '';
  });

  maths
    .filter(math => math.querySelector(':scope > .katex-rows') && fitOf(math) < 1)
    .forEach(math => math.classList.add('is-narrow'));

  // A formula does not always become exactly as much narrower as its font size: browsers round font sizes
  // and glyph widths, the more so in the small parts of a formula (a fraction, an index). So it is measured
  // again after each change, and made smaller again until it fits: a few rounds at most, each measuring all
  // the formulas before changing any.
  let wide = maths;

  for (let round = 0; round < ROUNDS && wide.length; round++) {
    const shares = wide.map(math => [math, fitOf(math)]).filter(([, share]) => share < 1);

    shares.forEach(([math, share]) => {
      const size = parseFloat(math.style.fontSize) || 100;

      // A little less than exact, against rounding.
      math.style.fontSize = `${Math.floor(size * share * 9.95) / 10}%`;
    });
    wide = shares.map(([math]) => math);
  }
}

// All the formulas again (fonts have loaded): those drawn now; those in blocks that the browser skips (off screen,
// _ui.scss) are observed afresh, so that they are fitted when they come into view, without laying them out now.
function fitAll() {
  const all = [...watched];

  queued = false;

  if (observer) {
    all.filter(math => !drawn(math)).forEach(math => {
      observer.unobserve(contentOf(math));
      observer.observe(contentOf(math));
    });
  }

  fit(all.filter(drawn));
}

function queue() {
  if (!queued) {
    queued = true;
    window.requestAnimationFrame(fitAll);
  }
}

// Keeps the displayed formula `math` (a div.math or p.math) inside its column from now on.
export default function watchFit(math) {
  if (watched.has(math)) {
    return;
  }

  watched.add(math);

  if (!('ResizeObserver' in window)) {
    queue();
    window.addEventListener('resize', queue);
    return;
  }

  if (!observer) {
    observer = new ResizeObserver(entries => fit([...new Set(entries.map(entry => entry.target.closest('.math')).filter(Boolean))]));

    if (document.fonts && 'onloadingdone' in document.fonts) {
      document.fonts.addEventListener('loadingdone', queue);
    }
  }

  // The first report comes after the next layout.
  observer.observe(math);
  observer.observe(contentOf(math));
  onPageEnd(() => {
    observer.unobserve(math);
    observer.unobserve(contentOf(math));
    watched.delete(math);
  });
}
