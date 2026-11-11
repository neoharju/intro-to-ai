// The highlighting of the code listings (javascripts/highlight.js, about 30 kB), apart from main.js so that a
// page whose listings are highlighted in advance (scripts/prerender.mjs removes this script from such pages)
// does not download it. A page whose listings are highlighted in the browser loads it just before main.js.
import hljs, { languageOf } from './highlight-languages';

// Highlights `blocks` (<code> elements in a <pre>), as highlight.js does: the classes "hljs" and
// "language-…" and data-highlighted="yes".
function highlight(blocks) {
  blocks.forEach(block => {
    const language = languageOf(block.parentNode.className);

    if (language) {
      block.classList.add(`language-${language}`);
    }

    hljs.highlightElement(block);
  });
}

window.IntroAI = Object.assign(window.IntroAI || {}, { highlight });
