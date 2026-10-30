import $ from 'jquery';
import 'bootstrap/js/src/collapse.js';
import 'bootstrap/js/src/dropdown.js';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import pseudocode from './pseudocode';

import Exercises from './exercises';
import Solutions from './solutions';
import TableOfContents from './table-of-contents';
import Navigation from './navigation';
import mountUi from './ui';
import mountHero from './hero';
import mountThemeMenu from './theme-menu';

// The page modules use the jQuery globals, as they did when jQuery came from a CDN.
window.$ = window.jQuery = $;

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('python', python);
hljs.registerLanguage('pseudo', pseudocode);

function highlightCode() {
  document.querySelectorAll('pre code').forEach(block => {
    // highlight.js 11 no longer merges markup inside code blocks (e.g. <sub> in pseudocode),
    // so such blocks keep their authored HTML and only get the code-block styling.
    if (block.children.length > 0) {
      block.classList.add('nohighlight', 'hljs');
      return;
    }

    // Blocks are tagged with SHJS-style classes (sh_python, sh_bash, sh_pseudo, ...) on the <pre>.
    const hint = block.parentNode.className.match(/\bsh_(\w+)/);

    if (hint && hljs.getLanguage(hint[1])) {
      block.classList.add(`language-${hint[1]}`);
    }
  });

  hljs.highlightAll();
}

$(() => {
  (new Exercises()).mount();
  (new Solutions()).mount();
  (new TableOfContents()).mount();
  (new Navigation()).mount();

  highlightCode();
  mountUi();
  mountHero();
  mountThemeMenu();
});
