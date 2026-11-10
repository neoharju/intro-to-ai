// Typesets the formulas of a page with KaTeX (javascripts/math.js, loaded by the pages that have
// formulas). A formula is written in TeX in an element with the class "math": inline in a <span>,
// displayed on a line of its own in a <div> or <p>. The TeX stays in the page, so the source of every
// formula is readable and searchable; KaTeX replaces it with typeset HTML and MathML (for screen
// readers). Other scripts can typeset text through window.IntroAI.math (the quiz does). In the site that
// the Pages workflow publishes, the formulas of the pages are typeset in advance (scripts/prerender.mjs,
// with the same settings): they have the class "is-typeset", and only their scrolling is set up here.
import katex from 'katex';

import { options } from './math-options';

export function render(tex, node, displayMode = false) {
  katex.render(tex, node, options(displayMode));
}

// A displayed formula wider than the column scrolls sideways; a fade on the clipped side shows that
// there is more to see. A formula changes width when the math fonts arrive, and no resize of a box
// reports that (the formula overflows its box), so every formula is measured again once fonts have
// loaded; a resize of the column (the window, the text size) is observed.
const updates = new Set();

if (document.fonts && 'onloadingdone' in document.fonts) {
  document.fonts.addEventListener('loadingdone', () => updates.forEach(update => update()));
}

function watchOverflow(scroller) {
  const update = () => {
    if (!scroller.isConnected) {
      updates.delete(update);
      return;
    }

    const hidden = scroller.scrollWidth - scroller.clientWidth;

    scroller.classList.toggle('fade-left', hidden > 1 && scroller.scrollLeft > 1);
    scroller.classList.toggle('fade-right', hidden > 1 && scroller.scrollLeft < hidden - 1);
  };

  scroller.addEventListener('scroll', update, { passive: true });

  if ('ResizeObserver' in window) {
    new ResizeObserver(update).observe(scroller);
  }

  updates.add(update);

  if (document.fonts) {
    document.fonts.ready.then(update);
  }

  update();
}

export function typeset(root = document) {
  root.querySelectorAll('.math:not(.is-typeset)').forEach(node => {
    const tex = node.textContent.trim();

    node.setAttribute('data-tex', tex);
    render(tex, node, node.tagName !== 'SPAN');
    node.classList.add('is-typeset');
  });

  // The displayed formulas, typeset just now or in advance.
  root.querySelectorAll('.math > .katex-display:not(.is-watched)').forEach(scroller => {
    scroller.classList.add('is-watched');
    watchOverflow(scroller);
  });
}

window.IntroAI = Object.assign(window.IntroAI || {}, { math: { render, typeset } });

typeset();
