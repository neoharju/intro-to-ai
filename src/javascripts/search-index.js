// The index and the matching of the material search (search.js).
//
// The index is built in the browser the first time the search opens: the pages of the navigation bar are
// fetched (from the browser cache when they were visited) and split into their sections and exercises,
// with the anchors of anchors.js. The results therefore always match the pages, and there is no index
// file to rebuild. Formulas, figures, buttons and the example solutions are left out of the text.
import { anchors } from './anchors';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'BUTTON', 'SELECT', 'TEXTAREA', 'CANVAS', 'IFRAME']);
const BLOCK = /^(?:P|LI|DIV|TD|TH|H[1-6]|PRE|FIGCAPTION|BLOCKQUOTE|DT|DD|SUMMARY|TR|BR|UL|OL|TABLE|FIGURE)$/;
export const MAX_RESULTS = 20;

// Lower case without accents, one character for one character, so that positions in the normalized
// text are positions in the original text too.
export function norm(text) {
  let out = '';

  for (const ch of text) {
    const base = ch.normalize('NFD')[0] || ch;

    out += base.toLowerCase()[0] || base;
  }

  return out;
}

function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// --- The index -------------------------------------------------------------------------------------------

// The pages of the navigation bar and the footer links marked data-search (the glossary), without the quiz
// (its questions are not in its HTML).
function sitePages() {
  const seen = new Set();

  return [...document.querySelectorAll('.navbar .navbar-nav .nav-link, .footer a[data-search]')]
    .map(link => {
      const url = new URL(link.getAttribute('href'), window.location.href);

      url.hash = '';

      return { name: clean(link.textContent), url: url.href };
    })
    .filter(page => !/\/quiz\/(?:index\.html)?$/.test(new URL(page.url).pathname) && !seen.has(page.url) && seen.add(page.url));
}

// The section numbers of the table of contents (table-of-contents.js): 1, 1.1, 1.2, 2, ...
function sectionNumbers(headings) {
  const stack = [{ level: 0, number: '', count: 0 }];

  return headings.map(node => {
    const level = Number(node.tagName.slice(1));

    while (stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];

    parent.count += 1;

    const number = parent.number ? `${parent.number}.${parent.count}` : `${parent.count}`;

    stack.push({ level, number, count: 0 });

    return number;
  });
}

function indexPage(page, doc) {
  const { sections, exercises } = anchors(doc);
  // A page without section numbers (the glossary: data-unnumbered) shows its titles as they are.
  const numbered = !doc.querySelector('#material[data-unnumbered]');
  const numbers = numbered ? sectionNumbers(sections.map(section => section.node)) : [];
  const intro = { kind: 'page', title: page.name, id: '', parts: [] };
  const sectionOf = new Map(sections.map((section, i) => [section.node, {
    kind: 'section', number: numbers[i], title: clean(section.node.textContent), id: section.id, parts: [],
  }]));
  const exerciseOf = new Map(exercises.map(exercise => {
    const heading = exercise.node.querySelector('.exercise__heading');

    return [exercise.node, { kind: 'exercise', title: clean(heading ? heading.textContent : 'Exercise'), id: exercise.id, parts: [] }];
  }));
  let current = intro;

  // Every piece of text goes to the section it follows, or to its exercise.
  function walk(node, exercise) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        (exercise || current).parts.push(child.nodeValue);
        continue;
      }

      // The model solutions are left out too: a result would show the answer in its excerpt, and lead to a
      // section where the answer is folded away.
      if (child.nodeType !== 1 || child.namespaceURI === SVG_NS || SKIP.has(child.tagName)
        || child.classList.contains('math') || child.classList.contains('solution')) {
        continue;
      }

      if (sectionOf.has(child)) {
        current = sectionOf.get(child);
        continue;
      }

      if (exerciseOf.has(child)) {
        walk(child, exerciseOf.get(child));
        continue;
      }

      if (child.classList.contains('exercise__heading')) {
        continue;
      }

      const block = BLOCK.test(child.tagName);

      if (block) {
        (exercise || current).parts.push(' ');
      }

      walk(child, exercise);

      if (block) {
        (exercise || current).parts.push(' ');
      }
    }
  }

  walk(doc.getElementById('material') || doc.body, null);

  return [intro, ...sectionOf.values(), ...exerciseOf.values()]
    .map(entry => {
      const text = clean(entry.parts.join(''));
      const title = entry.number ? `${entry.number}. ${entry.title}` : entry.title;

      return {
        kind: entry.kind,
        page: page.name,
        pageUrl: page.url,
        url: entry.id ? `${page.url}#${entry.id}` : page.url,
        id: entry.id,
        title,
        text,
        ntitle: norm(title),
        nbare: norm(entry.title),
        ntext: norm(text),
        npage: norm(page.name),
      };
    })
    .filter(entry => entry.kind !== 'page' || entry.text);
}

let indexPromise = null;

export function loadIndex() {
  if (!indexPromise) {
    const parser = new DOMParser();

    indexPromise = Promise.all(sitePages().map(page => fetch(page.url, { credentials: 'same-origin' })
      .then(response => (response.ok ? response.text() : ''))
      .then(html => (html ? indexPage(page, parser.parseFromString(html, 'text/html')) : []))
      .catch(() => [])))
      .then(lists => lists.flat());
  }

  return indexPromise;
}

// --- Matching -------------------------------------------------------------------------------------------

export function terms(query) {
  return norm(query).split(/\s+/).filter(term => term.length > 1 || /\d/.test(term));
}

// Every term must occur in the title, the text or the page name. A term at the start of a word of the
// title counts most, then the title, then how often it occurs in the text; among titles that match, the
// one that the query covers best (an exact title, or a short one that begins with the query) comes first.
// When no entry has every term, the entries that miss only one of several terms are shown instead.
export function match(index, words) {
  const all = [];
  const most = [];
  const query = words.join(' ');

  for (const entry of index) {
    let score = 0;
    let first = -1;
    let missing = 0;

    for (const word of words) {
      const inTitle = entry.ntitle.indexOf(word);
      const inText = entry.ntext.indexOf(word);
      const inPage = entry.npage.indexOf(word);

      if (inTitle < 0 && inText < 0 && inPage < 0) {
        missing += 1;
        continue;
      }

      if (inTitle >= 0) {
        score += inTitle === 0 || /[^a-z0-9]/.test(entry.ntitle[inTitle - 1]) ? 30 : 15;
      }

      if (inText >= 0) {
        let count = 0;

        for (let i = inText; i >= 0 && count < 10; i = entry.ntext.indexOf(word, i + word.length)) {
          count += 1;
        }

        score += 2 + count;

        if (first < 0 || inText < first) {
          first = inText;
        }
      }

      if (inPage >= 0) {
        score += 2;
      }
    }

    if (missing > 1 || (missing === 1 && words.length < 2)) {
      continue;
    }

    const fit = entry.nbare === query ? 20 : (entry.nbare.startsWith(query) ? 6 : 0) + 12 * Math.min(1, query.length / Math.max(entry.nbare.length, 1));
    const result = { entry, score: score + (entry.ntitle.includes(query) ? fit : 0) + (entry.kind === 'section' ? 1 : 0), first };

    (missing ? most : all).push(result);
  }

  const results = all.length ? all : most;

  return { partial: !all.length && most.length > 0, results: results.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS) };
}

export function snippet(text, first) {
  if (first < 0) {
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  }

  let start = Math.max(0, first - 60);
  let end = Math.min(text.length, first + 120);

  // Start and end at whole words.
  if (start > 0) {
    const space = text.indexOf(' ', start);

    start = space >= 0 && space < first ? space + 1 : start;
  }

  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);

    end = space > first ? space : end;
  }

  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
