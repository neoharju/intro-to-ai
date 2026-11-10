// Typesets the formulas of a page with KaTeX (javascripts/math.js, loaded by the pages that have
// formulas). A formula is written in TeX in an element with the class "math": inline in a <span>,
// displayed on a line of its own in a <div> or <p>. The TeX stays in the page, so the source of every
// formula is readable and searchable; KaTeX replaces it with typeset HTML and MathML (for screen
// readers). Other scripts can typeset text through window.IntroAI.math (the quiz does). In the site that
// the Pages workflow publishes, the formulas of the pages are typeset in advance (scripts/prerender.mjs,
// with the same settings): they have the class "is-typeset", and only their scrolling is set up here.
import katex from 'katex';

import { options } from './math-options';
import watchFades from './scroll-fades';

export function render(tex, node, displayMode = false) {
  katex.render(tex, node, options(displayMode));
}

// A displayed formula wider than the column scrolls sideways; a fade on the clipped side shows that there
// is more to see (scroll-fades.js measures all of them at once, after the layout).
export function typeset(root = document) {
  root.querySelectorAll('.math:not(.is-typeset)').forEach(node => {
    const tex = node.textContent.trim();

    node.setAttribute('data-tex', tex);
    render(tex, node, node.tagName !== 'SPAN');
    node.classList.add('is-typeset');
  });

  // The displayed formulas, typeset just now or in advance.
  root.querySelectorAll('.math > .katex-display').forEach(watchFades);
}

window.IntroAI = Object.assign(window.IntroAI || {}, { math: { render, typeset } });

typeset();
