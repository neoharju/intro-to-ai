// Simplified English: every week has a second version of its text, written in simple English (about
// 80% ASD-STE100 Issue 9) for readers whose first language is not English. The "Simplified English"
// button in the page header swaps it in, block by block, and back again; the choice is remembered in
// localStorage when the browser allows it.
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

// Sets up the switch for the current page; the router calls it again for every page it shows.
export default function mountSimplify() {
  const meta = document.querySelector('meta[name="introai-simple"]');
  const heroMeta = document.querySelector('.page-hero__meta');
  const signal = pageSignal();

  // A page that the router replaced may have left its text simplified.
  document.documentElement.removeAttribute('data-simple');

  if (!meta || !heroMeta) {
    return;
  }

  // The address of the simplified text, fixed now: the router changes the page's address before it
  // changes the page.
  const source = new URL(meta.content, window.location.href).href;

  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'simple-toggle';
  button.setAttribute('aria-pressed', 'false');
  button.title = 'Show this week in simplified English (and back)';
  button.innerHTML = '<span class="simple-toggle__switch" aria-hidden="true"></span><span>Simplified English</span>';

  const item = document.createElement('li');

  item.className = 'page-hero__simple';
  item.append(button);
  heroMeta.append(item);

  let entries = null;
  let swapped = [];
  let on = false;

  async function load() {
    if (!entries) {
      const response = await fetch(source, { cache: 'no-cache' });

      if (!response.ok) {
        throw new Error(`${source}: ${response.status}`);
      }

      entries = (await response.json()).blocks;
    }

    return entries;
  }

  // Replaces the own text of every block that has a simplified version; returns how to undo it.
  function swapIn(table) {
    const done = [];

    blocks().forEach(({ element, nodes: original }) => {
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
      done.push({ element, original, replacement, anchor });
    });

    return done;
  }

  function swapOut(done) {
    done.forEach(({ element, original, replacement }) => {
      const anchor = replacement.length ? replacement[replacement.length - 1].nextSibling : null;

      replacement.forEach(node => node.remove());
      original.forEach(node => element.insertBefore(node, anchor));
    });
  }

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
      const table = next ? await load() : null;

      // The reader went on to another page meanwhile.
      if (signal.aborted) {
        return;
      }

      const anchor = readingAnchor();

      if (next) {
        swapped = swapIn(table);
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

  button.addEventListener('click', () => set(!on));

  let saved = null;

  try {
    saved = window.localStorage.getItem(KEY);
  } catch (error) {
    // No saved choice.
  }

  if (saved === 'on') {
    set(true, { remember: false });
  }
}
