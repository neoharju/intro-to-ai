// Simplified English: every week has a second version of its text, written in simple English (about
// 80% ASD-STE100 Issue 9) for readers whose first language is not English. The "Simplified English"
// switch in the navigation bar (src/partials/navbar.html, shown on the pages that have such a version) swaps
// it in, block by block, and back again; the choice is remembered in localStorage when the browser allows it.
//
// The simplified text of a week is weekN/simple.json, compiled from src/simple/weekN.txt by
// scripts/simple.mjs. A page that has one names it in <meta name="introai-simple" content="simple.json">.
// Each entry belongs to one run of text on the page (a paragraph, a list item, a table cell, a caption;
// or the part of a list item before or after its nested list) and is found by a fingerprint of the
// original text, so the pages need no extra markup, and a
// block whose original text changes keeps its original until its simplified text is updated.
import { pageSignal } from './page';
import { readingAnchor } from './utils';

const KEY = 'introai-simple';

// The simplified text of the weeks, fetched once a visit: its address -> the request, and the tables that have
// arrived ({ fingerprint: html }), for the router, which puts the text in before the page is shown.
const requests = new Map();
const tables = new Map();

// The swaps that the router made in the text of the current page view while it came in (simplifyBefore), for
// mountSimplify, which can then turn them back.
let early = null;

// Elements whose own text is a block of the material.
const BLOCKS = 'p, li, td, th, dd, dt, figcaption, blockquote, div, summary, details';

// Child elements that split the text of a block: in "text <ul>…</ul> more text", the two texts are
// separate runs.
const BLOCK_CHILDREN = new Set(['P', 'UL', 'OL', 'DL', 'DIV', 'TABLE', 'PRE', 'FIGURE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4',
  'H5', 'H6', 'SECTION', 'FORM', 'HR', 'DETAILS', 'SUMMARY', 'svg']);

// Parts of the page that are not prose: code, drawings, the generated parts of the interactive
// figures (their captions are prose), the generated list of exercises and exercise headings.
function excluded(node) {
  if (node.closest('pre, svg, button, .math, .katex, #exercise-list, .exercise__header, .page-nav, .hint__header, .exercise-list__header')) {
    return true;
  }

  const figure = node.closest('[data-viz]');

  return Boolean(figure && !node.closest('figcaption'));
}

// The runs of an element's own text: the stretches of child nodes between its block-level children.
function runsOf(element) {
  const runs = [];
  let run = [];

  for (const child of element.childNodes) {
    if (child.nodeType === 1 && BLOCK_CHILDREN.has(child.tagName)) {
      runs.push(run);
      run = [];
    } else {
      run.push(child);
    }
  }

  runs.push(run);

  return runs.filter(nodes => plainText(nodes).replace(/§/g, '').trim().length > 0);
}

// The text of some nodes with every formula replaced by "§" (a formula is TeX in the source and
// typeset HTML once KaTeX has run, so its text cannot be part of the fingerprint).
function plainText(nodes) {
  const box = document.createElement('div');

  nodes.forEach(node => box.append(node.cloneNode(true)));
  box.querySelectorAll('.math').forEach(math => math.replaceWith('§'));
  box.querySelectorAll('button').forEach(button => button.remove());

  return box.textContent.replace(/\s+/g, ' ').trim();
}

// FNV-1a, 32 bits, as eight hex digits.
export function fingerprint(text) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

// The runs of text in the material, each with the element that holds it: [{ element, nodes }].
export function blocks(root = document.getElementById('material')) {
  if (!root) {
    return [];
  }

  return [...root.querySelectorAll(BLOCKS)]
    .filter(element => !excluded(element))
    .flatMap(element => runsOf(element).map(nodes => ({ element, nodes })));
}

function html(nodes) {
  const box = document.createElement('div');

  nodes.forEach(node => box.append(node.cloneNode(true)));

  return box.innerHTML.replace(/\s+/g, ' ').trim();
}

// Replaces the own text of every block in `root` (the material, or a part of the next page that is not in
// the document yet) that has a simplified version; returns how to undo it.
function swapIn(root, table) {
  const done = [];

  blocks(root).forEach(({ element, nodes: original }) => {
    const simple = table[fingerprint(plainText(original))];

    if (simple === undefined) {
      return;
    }

    const template = document.createElement('template');
    const anchor = original[original.length - 1].nextSibling;

    template.innerHTML = simple;

    const replacement = [...template.content.childNodes];

    original.forEach(node => node.remove());
    replacement.forEach(node => element.insertBefore(node, anchor));
    done.push({ element, original, replacement });
  });

  return done;
}

// Puts the original text back, the last swap first.
function swapOut(done) {
  [...done].reverse().forEach(({ element, original, replacement }) => {
    const anchor = replacement.length ? replacement[replacement.length - 1].nextSibling : null;

    replacement.forEach(node => node.remove());
    original.forEach(node => element.insertBefore(node, anchor));
  });
}

// Whether the reader has the simplified English on (the choice is kept in localStorage).
export function simpleWanted() {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch (error) {
    return false;
  }
}

// The simplified text of a week (the address of its simple.json), fetched once a visit.
export function loadSimple(source) {
  if (!requests.has(source)) {
    const request = fetch(source, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`${source}: ${response.status}`);
        }

        return response.json();
      })
      .then(data => {
        tables.set(source, data.blocks);
        return data.blocks;
      });

    // A failed request is tried again next time.
    request.catch(() => requests.delete(source));
    requests.set(source, request);
  }

  return requests.get(source);
}

// The simplified text of a week if it has arrived, or null.
export function loadedSimple(source) {
  return tables.get(source) || null;
}

// For the router: puts the simplified text (`table`, from `source`) into a part of the next page before it is
// shown, so that the reader never sees the page in the original first. Called after the router has started the
// page view (page.js); mountSimplify takes the swaps over.
export function simplifyBefore(root, source, table) {
  const signal = pageSignal();

  if (!early || early.signal !== signal || early.source !== source) {
    early = { signal, source, done: [] };
  }

  early.done.push(...swapIn(root, table));
}

// For authoring (scripts/simple.mjs --extract): every block with its fingerprint and original HTML,
// and the text of the material that is in no block (which would stay unsimplified).
export function extract() {
  const found = blocks();
  const covered = new Set();

  found.forEach(({ nodes }) => nodes.forEach(node => covered.add(node)));

  const missed = [];
  const walker = document.createTreeWalker(document.getElementById('material'), NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent.trim() && !excluded(node.parentElement) && !node.parentElement.closest('.math, h1, h2, h3, h4, h5, h6')) {
      let inside = false;

      for (let up = node; up && !inside; up = up.parentNode) {
        inside = covered.has(up);
      }

      if (!inside) {
        missed.push(node.textContent.trim().slice(0, 80));
      }
    }
  }

  return {
    blocks: found.map(({ element, nodes }) => ({ fp: fingerprint(plainText(nodes)), tag: element.tagName.toLowerCase(), html: html(nodes) })),
    missed,
  };
}

// Sets up the switch for the current page; the router calls it again for every page it shows. The switch
// stays in the navigation bar from page to page: its listener ends with the page (page.js).
export default function mountSimplify() {
  const meta = document.querySelector('meta[name="introai-simple"]');
  const button = document.querySelector('.navbar .simple-toggle');
  const signal = pageSignal();

  // A page that the router replaced may have left its text simplified.
  document.documentElement.removeAttribute('data-simple');

  if (!button) {
    return;
  }

  // Only the pages with a simplified version have the switch.
  button.hidden = !meta;
  button.disabled = false;
  button.setAttribute('aria-pressed', 'false');

  if (!meta) {
    return;
  }

  // The address of the simplified text, fixed now: the router changes the page's address before it
  // changes the page.
  const source = new URL(meta.content, window.location.href).href;

  let swapped = [];
  let on = false;

  // The formulas of the swapped text (a Promise: KaTeX may have to be loaded first).
  function typeset() {
    return window.IntroAI && window.IntroAI.math
      ? window.IntroAI.math.typeset(document.getElementById('material'))
      : Promise.resolve();
  }

  async function set(next, { remember = true } = {}) {
    if (next === on) {
      return;
    }

    button.disabled = true;

    try {
      const table = next ? await loadSimple(source) : null;

      // The reader went on to another page meanwhile.
      if (signal.aborted) {
        return;
      }

      const anchor = readingAnchor();

      if (next) {
        swapped = swapIn(document.getElementById('material'), table);
      } else {
        swapOut(swapped);
        swapped = [];
      }

      await typeset();
      on = next;
      document.documentElement.toggleAttribute('data-simple', on);
      button.setAttribute('aria-pressed', String(on));

      if (anchor) {
        window.scrollBy({ top: anchor.node.getBoundingClientRect().top - anchor.top, behavior: 'auto' });
      }

      if (remember) {
        try {
          window.localStorage.setItem(KEY, on ? 'on' : 'off');
        } catch (error) {
          // The choice lasts until the page is left.
        }
      }
    } catch (error) {
      button.title = 'The simplified version could not be loaded.';
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener('click', () => set(!on), { signal });

  if (early && early.signal === signal && early.source === source) {
    // The router put the simplified text in as the page came in.
    swapped = early.done;
    on = true;
    document.documentElement.setAttribute('data-simple', '');
    button.setAttribute('aria-pressed', 'true');
  } else if (simpleWanted()) {
    // The first page of a visit: its text is swapped now.
    set(true, { remember: false });
  }

  early = null;
}
