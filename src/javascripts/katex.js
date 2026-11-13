// KaTeX itself (javascripts/katex.js, about 260 kB), apart from math.js so that a page whose formulas are all
// typeset in advance (scripts/prerender.mjs removes this script from such pages) does not download it. A page
// whose formulas are typeset in the browser loads it just before math.js; math.js also loads it on demand
// when a formula appears later (the practice quiz, the simplified English of a week).
import katex from 'katex';

import { displayHtml, options } from './math-options';

// A displayed formula also gets its rows, if it is a multi-line environment (math-options.js).
function render(tex, node, displayMode = false) {
  if (displayMode) {
    node.innerHTML = displayHtml(katex, tex);
  } else {
    katex.render(tex, node, options(false));
  }
}

// Typesets every formula under `root` that is not typeset yet. The TeX stays in data-tex.
function typeset(root = document) {
  root.querySelectorAll('.math:not(.is-typeset)').forEach(node => {
    const tex = node.textContent.trim();

    node.setAttribute('data-tex', tex);
    render(tex, node, node.tagName !== 'SPAN');
    node.classList.add('is-typeset');
  });
}

window.IntroAI = Object.assign(window.IntroAI || {}, { katex: { render, typeset } });
