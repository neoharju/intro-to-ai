// Builds _site/: the site as GitHub Pages publishes it, with the formulas typeset in advance. It holds the
// files that Jekyll publishes from this branch (the tracked files, without those that _config.yml excludes
// and those whose names start with "." or "_"), and in each page of src/site.json and in each
// weekN/simple.json every element with the class "math" is typeset with KaTeX, with the settings of math.js
// (src/javascripts/math-options.js). The pages then show their formulas at once, instead of typesetting up
// to 300 of them in the browser (0.2-1.2 s on a slow phone); math.js still sets up their scrolling. KaTeX
// itself (javascripts/katex.js, about 260 kB) is then of no use to them: its <script> is removed from every
// page but the quiz, which typesets its questions in the browser (math.js loads katex.js on demand if a page
// needs it after all). The headers and the tops of the pages in pages.json (router.js) are typeset too. The code
// listings are highlighted in advance as well, and javascripts/highlight.js removed from the pages.
//
//   npm run prerender      (the Pages workflow, .github/workflows/pages.yml, publishes the result)
//
// A formula that KaTeX cannot typeset stops the build, with its page and its TeX.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';

import hljs, { languageOf, skipped } from '../src/javascripts/highlight-languages.js';
import { options } from '../src/javascripts/math-options.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const site = JSON.parse(await readFile(path.join(root, 'src', 'site.json'), 'utf8'));
const pages = new Set(Object.keys(site.pages));

// An element with the class "math" and its TeX: <span class="math">, <div class="math math--key">, ...
const MATH = /<(span|div|p)(\s[^>]*?\bclass="((?:[^"]*\s)?math(?:\s[^"]*)?)"[^>]*)>([\s\S]*?)<\/\1>/g;
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', larr: '\u2190', rarr: '\u2192' };

function decode(text, where) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === '#') {
      return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    }

    if (!(name.toLowerCase() in ENTITIES)) {
      throw new Error(`${where}: unknown entity ${match} (add it to ENTITIES)`);
    }

    return ENTITIES[name.toLowerCase()];
  });
}

function escapeAttribute(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

let formulas = 0;

// The HTML with every formula typeset, as math.js typesets it in the browser: the KaTeX output inside the
// element, the TeX in data-tex, and the class "is-typeset".
function typeset(html, where) {
  return html.replace(MATH, (match, tag, attributes, classes, inner) => {
    if (/(^|\s)is-typeset(\s|$)/.test(classes)) {
      return match;
    }

    // The text of the element, as textContent gives it: a formula holds no markup.
    if (/<[a-z!/]/i.test(inner)) {
      throw new Error(`${where}: a formula contains markup: ${match.slice(0, 120)}`);
    }

    const tex = decode(inner, where).trim();
    let body;

    try {
      body = katex.renderToString(tex, { ...options(tag !== 'span'), throwOnError: true });
    } catch (error) {
      throw new Error(`${where}: ${error.message}\n  TeX: ${tex}`);
    }

    formulas++;

    const typesetAttributes = attributes.replace(`class="${classes}"`, `class="${classes} is-typeset"`);

    return `<${tag}${typesetAttributes} data-tex="${escapeAttribute(tex)}">${body}</${tag}>`;
  });
}

// The code listings, highlighted as main.js and javascripts/highlight.js highlight them in the browser: the
// listing's text through highlight.js, the classes "language-…" and "hljs" and data-highlighted="yes".
// A listing with markup of its own keeps it and only gets the classes "nohighlight hljs".
const LISTING = /(<pre(\s[^>]*)?>\s*)<code(\s[^>]*)?>([\s\S]*?)<\/code>/g;
const classOf = attributes => ((attributes || '').match(/\sclass="([^"]*)"/) || [])[1] || '';
let listings = 0;

function highlight(html, where) {
  return html.replace(LISTING, (match, pre, preAttributes, codeAttributes, inner) => {
    const preClass = classOf(preAttributes);
    const codeClass = classOf(codeAttributes);

    if ((codeAttributes || '').replace(/\sclass="[^"]*"/, '').trim()) {
      throw new Error(`${where}: a <code> listing with attributes other than class: ${match.slice(0, 80)}`);
    }

    if (skipped(codeClass)) {
      return match;
    }

    if (/<[a-z]/i.test(inner)) {
      return `${pre}<code class="${codeClass ? `${codeClass} ` : ''}nohighlight hljs">${inner}</code>`;
    }

    const language = languageOf(preClass);
    const text = decode(inner, where);
    const result = language ? hljs.highlight(text, { language, ignoreIllegals: true }) : hljs.highlightAuto(text);
    const classes = [...new Set([...(codeClass ? codeClass.split(/\s+/) : []), ...(language ? [`language-${language}`] : []), 'hljs',
      ...(result.language ? [`language-${result.language}`] : [])])];

    listings++;

    return `${pre}<code class="${classes.join(' ')}" data-highlighted="yes">${result.value}</code>`;
  });
}

// What Jekyll publishes: the tracked files, without the build tooling that _config.yml excludes and the
// names that Jekyll always leaves out.
const excluded = new Set([...(await readFile(path.join(root, '_config.yml'), 'utf8')).matchAll(/^\s+-\s+(\S+)\s*$/gm)]
  .map(match => match[1]));
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(file => !file.split('/').some(part => excluded.has(part) || /^[._#~]/.test(part)));

await rm(out, { recursive: true, force: true });

for (const file of files) {
  const target = path.join(out, file);

  await mkdir(path.dirname(target), { recursive: true });

  if (pages.has(file)) {
    const html = highlight(typeset(await readFile(path.join(root, file), 'utf8'), file), file)
      // Of no use now: every listing is highlighted.
      .replace(/^[ \t]*<script src="[^"]*\/highlight\.js"><\/script>\n/m, '');

    await writeFile(target, site.pages[file].scripts.includes('quiz.js') ? html : html.replace(/^[ \t]*<script src="[^"]*\/katex\.js"><\/script>\n/m, ''));
  } else if (file === 'pages.json') {
    const data = JSON.parse(await readFile(path.join(root, file), 'utf8'));

    Object.entries(data.pages).forEach(([page, shell]) => {
      shell.hero.html = typeset(shell.hero.html, `${file} ${page}`);
      shell.intro = typeset(shell.intro, `${file} ${page}`);
    });
    await writeFile(target, `${JSON.stringify(data)}\n`);
  } else if (/^week\d+\/simple\.json$/.test(file)) {
    // The simplified English: its blocks are HTML too.
    const data = JSON.parse(await readFile(path.join(root, file), 'utf8'));

    Object.keys(data.blocks).forEach(fingerprint => {
      data.blocks[fingerprint] = typeset(data.blocks[fingerprint], `${file} ${fingerprint}`);
    });
    await writeFile(target, JSON.stringify(data));
  } else {
    await copyFile(path.join(root, file), target);
  }
}

console.log(`Wrote _site/: ${files.length} files, ${formulas} formulas typeset and ${listings} listings highlighted in advance.`);
