// The formulas of a page (javascripts/math.js, loaded by the pages that have formulas). A formula is written
// in TeX in an element with the class "math": inline in a <span>, displayed on a line of its own in a <div>
// or <p>. The TeX stays in the page, so the source of every formula is readable and searchable; KaTeX replaces
// it with typeset HTML and MathML (for screen readers).
//
// KaTeX itself is in javascripts/katex.js. In the site that the Pages workflow publishes, the formulas of the
// pages are typeset in advance (scripts/prerender.mjs, with the same settings) and have the class
// "is-typeset": such a page does not load katex.js at all, and only the scrolling of its formulas is set up
// here. A page whose formulas are typeset in the browser loads katex.js just before this script, so that its
// formulas are typeset before it is first drawn. A formula that appears later (the practice quiz, the
// simplified English) loads katex.js on demand if the page did not.
//
// Other scripts typeset through window.IntroAI.math: typeset(root) returns a Promise that resolves once the
// formulas under root are typeset.
import { loadScript } from './load-script';
import { SCRIPTS } from './scripts-url';
import { definePageScript } from './page';
import watchFades from './scroll-fades';

// The address of katex.js, next to this script.
const KATEX_URL = new URL('katex.js', SCRIPTS).href;

function loadKatex() {
  if (window.IntroAI && window.IntroAI.katex) {
    return Promise.resolve(window.IntroAI.katex);
  }

  return loadScript(KATEX_URL).then(() => {
    if (!window.IntroAI || !window.IntroAI.katex) {
      throw new Error('katex.js did not load');
    }

    return window.IntroAI.katex;
  });
}

// A displayed formula wider than the column scrolls sideways; a fade on the clipped side shows that there
// is more to see (scroll-fades.js measures all of them at once, after the layout).
function watchDisplays(root) {
  root.querySelectorAll('.math > .katex-display').forEach(watchFades);
}

export function typeset(root = document) {
  if (!root.querySelector('.math:not(.is-typeset)')) {
    watchDisplays(root);
    return Promise.resolve();
  }

  // Already loaded (katex.js came before this script): at once, before the page is drawn.
  if (window.IntroAI && window.IntroAI.katex) {
    window.IntroAI.katex.typeset(root);
    watchDisplays(root);
    return Promise.resolve();
  }

  return loadKatex().then(katex => {
    katex.typeset(root);
    watchDisplays(root);
  });
}

export function render(tex, node, displayMode = false) {
  return loadKatex().then(katex => katex.render(tex, node, displayMode));
}

window.IntroAI = Object.assign(window.IntroAI || {}, { math: { render, typeset } });

// Now, and again for every page with formulas that the router shows.
definePageScript('math', () => {
  typeset().catch(error => console.error(error));
});
