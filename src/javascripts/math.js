// Typesets the formulas of a page with KaTeX (javascripts/math.js, loaded by the pages that have
// formulas). A formula is written in TeX in an element with the class "math": inline in a <span>,
// displayed on a line of its own in a <div> or <p>. The TeX stays in the page, so the source of every
// formula is readable and searchable; KaTeX replaces it with typeset HTML and MathML (for screen
// readers). Other scripts can typeset text through window.IntroAI.math (the quiz does).
import katex from 'katex';

const MACROS = {
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\softmax': '\\operatorname{softmax}',
};

function options(displayMode) {
  // trust: false keeps \href, \url and friends off; throwOnError: false shows a broken formula in red
  // instead of stopping the rest of the page.
  return { displayMode, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore', trust: false, macros: MACROS };
}

export function render(tex, node, displayMode = false) {
  katex.render(tex, node, options(displayMode));
}

// A displayed formula wider than the column scrolls sideways; a fade on the clipped side shows that
// there is more to see. The formula's own size is watched too: it grows when the math fonts arrive.
function watchOverflow(scroller) {
  const update = () => {
    const hidden = scroller.scrollWidth - scroller.clientWidth;

    scroller.classList.toggle('fade-left', hidden > 1 && scroller.scrollLeft > 1);
    scroller.classList.toggle('fade-right', hidden > 1 && scroller.scrollLeft < hidden - 1);
  };

  scroller.addEventListener('scroll', update, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(update);

    observer.observe(scroller);
    observer.observe(scroller.firstElementChild || scroller);
  }

  update();
}

export function typeset(root = document) {
  root.querySelectorAll('.math:not(.is-typeset)').forEach(node => {
    const tex = node.textContent.trim();
    const displayMode = node.tagName !== 'SPAN';

    node.setAttribute('data-tex', tex);
    render(tex, node, displayMode);
    node.classList.add('is-typeset');

    if (displayMode && node.querySelector('.katex-display')) {
      watchOverflow(node.querySelector('.katex-display'));
    }
  });
}

window.IntroAI = Object.assign(window.IntroAI || {}, { math: { render, typeset } });

typeset();
