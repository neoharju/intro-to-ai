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

// The environments that a displayed formula may be made of, one row per line.
const ROWED = /^\\begin\{(aligned|gathered|split|align\*?|gather\*?)\}([\s\S]*)\\end\{\1\}$/;

// A displayed formula that is one multi-line environment (\begin{aligned} … \end{aligned}): its rows, each a
// formula of its own, without the alignment points (&) of the environment. Null for any other formula.
export function rowsOf(tex) {
  const whole = tex.trim().match(ROWED);

  if (!whole) {
    return null;
  }

  const body = whole[2];
  const rows = [];
  let row = '';
  let depth = 0;

  for (let i = 0; i < body.length; i++) {
    const rest = body.slice(i);
    const nested = rest.match(/^\\(begin|end)\{[^}]*\}/);

    if (nested) {
      depth += nested[1] === 'begin' ? 1 : -1;
      row += nested[0];
      i += nested[0].length - 1;
    } else if (rest.startsWith('\\\\') && depth === 0) {
      // The end of a row, with its optional space (\\[4pt]).
      const space = rest.match(/^\\\\(\[[^\]]*\])?/);

      rows.push(row);
      row = '';
      i += space[0].length - 1;
    } else if (body[i] === '\\') {
      // A command: kept whole (\& and \{ are not alignment points or groups).
      row += body[i] + (body[i + 1] || '');
      i += 1;
    } else {
      depth += body[i] === '{' ? 1 : body[i] === '}' ? -1 : 0;
      row += body[i] === '&' && depth === 0 ? '' : body[i];
    }
  }

  rows.push(row);

  // Each row after an empty group, as in the environment: a row that starts with an operation or a relation
  // (× P(G=g), = …) keeps its spacing instead of becoming a sign.
  const kept = rows.map(text => text.trim()).filter(Boolean).map(text => `{}${text}`);

  return kept.length > 1 ? kept : null;
}

// A displayed formula as HTML, as KaTeX writes it, followed, for a multi-line environment, by its rows typeset
// one by one (<span class="katex-rows">): math.js shows the rows instead when the environment is wider than
// the column, so that each row can break over lines of its own. `extra` adds to the options (throwOnError).
export function displayHtml(katex, tex, extra = {}) {
  const html = katex.renderToString(tex, { ...options(true), ...extra });
  const rows = rowsOf(tex);

  if (!rows) {
    return html;
  }

  return `${html}<span class="katex-rows">${rows.map(row => katex.renderToString(row, { ...options(true), ...extra })).join('')}</span>`;
}
