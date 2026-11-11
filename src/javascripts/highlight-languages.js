// highlight.js with the languages of the course material, shared by the browser (highlight.js, the bundle) and
// scripts/prerender.mjs (which highlights the listings of the site that the Pages workflow publishes in
// advance), so that both give the same result.
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';

import pseudocode from './pseudocode.js';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('python', python);
hljs.registerLanguage('pseudo', pseudocode);

// The language of a listing from the SHJS-style class of its <pre> (sh_python, sh_bash, sh_pseudo, ...),
// or null.
export function languageOf(preClass) {
  const hint = (preClass || '').match(/\bsh_(\w+)/);

  return hint && hljs.getLanguage(hint[1]) ? hint[1] : null;
}

// Listings that are not highlighted: marked so, or with markup of their own (e.g. <sub> in pseudocode, which
// highlight.js 11 would drop).
export function skipped(codeClass) {
  return /(^|\s)(nohighlight|no-highlight)(\s|$)/.test(codeClass || '');
}

export default hljs;
