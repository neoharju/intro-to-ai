// The KaTeX settings of the site, shared by math.js (in the browser) and scripts/prerender.mjs (the Pages
// build, which typesets the formulas in advance), so that both give the same result.
export const MACROS = {
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\softmax': '\\operatorname{softmax}',
};

export function options(displayMode) {
  // trust: false keeps \href, \url and friends off; throwOnError: false shows a broken formula in red
  // instead of stopping the rest of the page. Every formula gets its own copy of the macros, so that one
  // cannot change them for the others.
  return { displayMode, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore', trust: false, macros: { ...MACROS } };
}
