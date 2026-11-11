// Changes page without leaving the document. The navigation bar, the page header with its animation, the
// footer and the table-of-contents drawer stay; only what belongs to the page changes:
//
//   1. at once, from pages.json (a small file that scripts/sync.mjs writes, fetched when the browser is idle):
//      the title and the line under it cross-fade in the header, while the network goes on drawing behind
//      them, and the top of the material (the lecture and deadline boxes, the list of exercises, the learning
//      objectives) replaces the old material;
//   2. as soon as the page itself has arrived (usually already in memory: prefetch.js fetches it when the
//      reader points at a link to it): the rest of the material is put in below, the scripts of the page
//      that are not loaded yet are loaded, and the page is set up. All of this is spread over many short
//      frames (appendInSlices, nextFrame), so that the animation in the header never stands still for long.
//
// The pages stay ordinary HTML documents: every address works on its own, and the first page of a visit is
// loaded as before. Anything unexpected (a page that is not one of the site's, a failed request, a page
// without a header) falls back to an ordinary page load.
//
// Scrolling: the router keeps the scroll position of every history entry in its state, so that back and
// forward return to the same place, also after a reload (history.scrollRestoration is "manual").
import { reveal } from './anchors';
import { nextPageView, remountPageScript, restoringScroll } from './page';
import { prefersReducedMotion } from './utils';
import { SCRIPTS } from './scripts-url';

// The root of the site: the scripts are in javascripts/ under it.
const ROOT = new URL('../', SCRIPTS);
const MANIFEST = new URL('pages.json', ROOT).href;

const pages = new Map();
let manifest = null;
let manifestRequest = null;

function relativeKey(url) {
  return url.pathname.slice(ROOT.pathname.length);
}

// The address of the page that `url` names ("/intro-to-ai/week2/"), or null if it is not a page of this site.
function pageOf(url) {
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname) || !/\/(?:index\.html)?$/.test(url.pathname)) {
    return null;
  }

  const page = url.pathname.replace(/index\.html$/, '');

  // Once pages.json is there, only the pages it lists.
  if (manifest && !(relativeKey(new URL(page, url)) in manifest.pages)) {
    return null;
  }

  return page;
}

// --- Fetching ----------------------------------------------------------------------------------------------

export function loadManifest() {
  if (!manifestRequest) {
    manifestRequest = fetch(MANIFEST, { credentials: 'same-origin' })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        manifest = data && data.pages ? data : null;
        return manifest;
      })
      .catch(() => null);
  }

  return manifestRequest;
}

// The HTML of a page, fetched once per visit and kept in memory (the pages are 6-330 kB).
function fetchPage(page) {
  if (!pages.has(page)) {
    const request = fetch(new URL(page, ROOT.origin).href, { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok || !/text\/html/.test(response.headers.get('content-type') || 'text/html')) {
          throw new Error(`${page}: ${response.status}`);
        }

        return response.text();
      });

    // A failed request is tried again next time.
    request.catch(() => pages.delete(page));
    pages.set(page, request);
  }

  return pages.get(page);
}

const loadedScripts = new Set();

function rememberLoadedScripts() {
  document.querySelectorAll('script[src]').forEach(script => loadedScripts.add(script.src));
}

// The scripts at the end of a page's body: [{ src (absolute), module }].
function scriptsOf(doc, base) {
  return [...doc.querySelectorAll('body script[src]')]
    .map(script => ({ src: new URL(script.getAttribute('src'), base).href, module: script.type === 'module' }));
}

// Fetches a page in advance (prefetch.js), and lets the browser fetch the scripts it needs that this
// document has not loaded yet.
export function preload(address) {
  const url = new URL(address, window.location.href);
  const page = pageOf(url);

  if (!page) {
    return;
  }

  loadManifest();
  fetchPage(page).then(html => {
    const base = new URL(page, ROOT.origin);

    // The scripts and stylesheets it names, without parsing the whole page.
    const files = [
      ...[...html.matchAll(/<script\s+(?:type="module"\s+)?src="([^"]+)"/g)].map(match => [new URL(match[1], base).href, 'script']),
      ...[...html.matchAll(/<link\s+href="([^"]+\.css)"\s+rel="stylesheet"/g)].map(match => [new URL(match[1], base).href, 'style']),
    ];

    files
      .filter(([src, as]) => !(as === 'script' ? loadedScripts.has(src) : hasStylesheet(src))
        && !document.querySelector(`link[rel="prefetch"][href="${CSS.escape(src)}"]`))
      .forEach(([src, as]) => {
        const hint = document.createElement('link');

        hint.rel = 'prefetch';
        hint.as = as;
        hint.href = src;
        document.head.append(hint);
      });
  }, () => {});
}

// A script of the next page: a module is imported (with the chunks it shares with the scripts already
// loaded, which run only once), a plain script (katex.js, highlight.js) is added to the page.
function loadScript(src, module = false) {
  if (module) {
    return import(src).then(() => {
      loadedScripts.add(src);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src = src;
    // In the order given: a page's scripts depend on the ones before them.
    script.async = false;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`${src}: not loaded`));
    document.body.append(script);
  });
}

// --- The parts of the page ---------------------------------------------------------------------------------

// The text of some nodes, to tell whether the top of a page is still the one in pages.json.
function textOf(nodes) {
  return nodes.map(node => node.textContent).join('').replace(/\s+/g, ' ').trim();
}

// The nodes of the material before its first section heading: the part that pages.json has too.
function introOf(material) {
  const nodes = [];

  for (const node of material.childNodes) {
    if (node.nodeType === 1 && node.matches('.material-heading')) {
      break;
    }

    nodes.push(node);
  }

  return nodes;
}

// The header: the old title, line and switches fade out while the new ones fade in over them (the two are
// in the same cell of the header's grid, _hero.scss). The canvas behind them is not touched.
function swapHero(className, html) {
  const hero = document.querySelector('.page-hero');

  if (!hero) {
    return;
  }

  const old = [...hero.querySelectorAll(':scope > .container:not(.is-leaving)')];
  const next = document.createElement('div');

  next.className = 'container';
  next.innerHTML = html;
  hero.className = className;
  // Before the old text: the scripts that add to the header (simplify.js, progress.js) take the first
  // .page-hero__meta of the document. The old text, later in the grid's cell, is drawn over the new while it
  // fades out.
  hero.insertBefore(next, old[0] || null);

  if (prefersReducedMotion() || typeof next.animate !== 'function') {
    old.forEach(node => node.remove());
    return;
  }

  old.forEach(node => {
    node.classList.add('is-leaving');
    node.setAttribute('aria-hidden', 'true');
    node.inert = true;
    node.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }],
      { duration: 160, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' })
      .finished.then(() => node.remove(), () => node.remove());
  });

  next.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
    { duration: 280, delay: 60, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' });
}

// Resolves once the browser has drawn the next frame (at once in a hidden tab, which draws none).
function nextFrame() {
  return new Promise(resolve => {
    if (document.hidden) {
      window.setTimeout(resolve, 0);
    } else {
      window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
    }
  });
}

// Appends `nodes` to `parent` a slice at a time (each passed to `prepare` first, while it is not in the page),
// so that the browser styles and lays out a long page (up to
// 20 000 boxes) in many short frames instead of one of 0.1-1 s, during which the network in the header would
// stand still. The slices grow while the frames stay short and shrink when one is long, so a fast computer
// gets the page in a few frames and a slow phone in more, but smoothly. Resolves to false if the reader has
// gone on to another page meanwhile.
async function appendInSlices(parent, nodes, { prepare, stale }) {
  let size = 150;
  let i = 0;

  while (i < nodes.length) {
    const slice = [];
    let weight = 0;

    // The weight of a slice: its elements.
    while (i < nodes.length && (weight < size || !slice.length)) {
      const node = nodes[i++];

      weight += node.nodeType === 1 ? 1 + node.getElementsByTagName('*').length : 0;
      slice.push(node);
    }

    const fragment = document.createDocumentFragment();

    fragment.append(...slice);
    prepare(fragment);
    parent.append(fragment);

    if (i < nodes.length) {
      const start = performance.now();

      await nextFrame();

      if (stale()) {
        return false;
      }

      // The time until the frame with the slice was drawn (at least the wait for the display, up to 17 ms).
      const took = performance.now() - start;

      if (took < 24) {
        size = Math.min(4000, size * 1.5);
      } else if (took > 40) {
        size = Math.max(40, size / 2);
      }
    }
  }

  return true;
}

function setMaterial(material, from) {
  material.className = from.className;
  [...material.attributes].filter(({ name }) => name.startsWith('data-') && name !== 'data-loading')
    .forEach(({ name }) => material.removeAttribute(name));
  Object.entries(from.data || {}).forEach(([name, value]) => material.setAttribute(name, value));
}

function dataOf(node) {
  return Object.fromEntries([...node.attributes].filter(({ name }) => name.startsWith('data-')).map(({ name, value }) => [name, value]));
}

function fadeIn(node) {
  if (!prefersReducedMotion() && typeof node.animate === 'function') {
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }
}

// The stylesheets of the document, as absolute addresses taken when the router starts: the href of a <link>
// with a relative address follows the address of the document, which the router changes.
const stylesheets = new Set();

function rememberStylesheets() {
  document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => stylesheets.add(link.href));
}

function hasStylesheet(href) {
  return stylesheets.has(href);
}

// The stylesheets of the next page that this document does not have yet (math.css, for the formulas): added
// before its material goes in, so that it is never drawn without them. They stay for the rest of the visit.
function addStylesheets(doc, base) {
  const missing = [...doc.querySelectorAll('head link[rel="stylesheet"][href]')]
    .map(link => new URL(link.getAttribute('href'), base).href)
    .filter(href => !hasStylesheet(href));

  return Promise.all(missing.map(href => new Promise(resolve => {
    const link = document.createElement('link');

    stylesheets.add(href);
    link.rel = 'stylesheet';
    link.href = href;
    // An error is no reason to stop: the page is shown without it.
    link.onload = resolve;
    link.onerror = resolve;
    document.head.append(link);
  })));
}

// The simplified English of a week is named in the <head>.
function syncHead(doc) {
  const name = 'introai-simple';
  const mine = document.querySelector(`meta[name="${name}"]`);
  const theirs = doc.querySelector(`meta[name="${name}"]`);

  if (mine) {
    mine.remove();
  }

  if (theirs) {
    const meta = document.createElement('meta');

    meta.name = name;
    meta.content = theirs.getAttribute('content');
    document.head.append(meta);
  }
}

function focusTitle() {
  const title = document.querySelector('.page-hero > .container:not(.is-leaving) .page-hero__title');

  if (title) {
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  }
}

// --- Scroll positions --------------------------------------------------------------------------------------

function saveScroll() {
  try {
    window.history.replaceState({ ...(window.history.state || {}), y: Math.round(window.scrollY) }, '');
  } catch (error) {
    // Too many calls (Safari limits them): the position is not remembered.
  }
}

function savedScroll(state) {
  return state && typeof state.y === 'number' ? state.y : null;
}

// --- Changing page -----------------------------------------------------------------------------------------

export default function mountRouter({ pageSteps, onNavigate, onPageShown }) {
  const material = document.getElementById('material');

  if (!material || !document.querySelector('.page-hero') || !window.history.pushState || typeof DOMParser === 'undefined') {
    return null;
  }

  let current = pageOf(new URL(window.location.href)) || window.location.pathname;
  let outdated = false;
  let navigation = 0;
  // The text of the top of the material and of the header that showShell put in.
  let shellText = null;
  let shellHero = null;

  rememberLoadedScripts();
  rememberStylesheets();

  // The browser looks for the icon of the page again when the address changes: a relative address
  // ("img/favicon.svg" on the front page) would then name a file that is not there.
  document.querySelectorAll('head link[rel~="icon"][href]').forEach(link => link.setAttribute('href', link.href));

  // Shows the top of the page at once from pages.json; false if it is not there.
  function showShell(page) {
    const entry = manifest && manifest.pages[relativeKey(new URL(page, ROOT.origin))];

    if (!entry) {
      return false;
    }

    nextPageView(false);
    document.title = entry.title;
    swapHero(entry.hero.className, entry.hero.html);
    shellHero = textOf([document.querySelector('.page-hero > .container:not(.is-leaving)')]);
    setMaterial(material, entry.material);
    material.setAttribute('data-loading', '');

    const template = document.createElement('template');

    template.innerHTML = entry.intro;
    material.replaceChildren(template.content);
    shellText = textOf([...material.childNodes]);
    window.scrollTo(0, 0);
    fadeIn(material);
    focusTitle();

    return true;
  }

  // Puts the whole page in: the rest of the material below the top that showShell put in, or all of it.
  async function showPage(doc, base, { shell, restoreY, hash, stale }) {
    const hero = doc.querySelector('.page-hero');
    const theirs = doc.getElementById('material');

    if (!hero || !theirs || !hero.querySelector(':scope > .container')) {
      throw new Error('not a page of the course');
    }

    await addStylesheets(doc, base);

    if (stale()) {
      return;
    }

    const intro = introOf(theirs);
    const rest = [...theirs.childNodes].slice(intro.length);
    const sameIntro = shell && shellText === textOf(intro);

    if (!shell) {
      nextPageView(restoreY !== null);
      swapHero(hero.className, hero.querySelector(':scope > .container').innerHTML);
    } else if (textOf([hero.querySelector(':scope > .container')]) !== shellHero) {
      // pages.json and the page disagree (one of them is older): the page is right.
      swapHero(hero.className, hero.querySelector(':scope > .container').innerHTML);
    }

    shellHero = null;

    document.title = doc.title;
    syncHead(doc);
    setMaterial(material, { className: theirs.className, data: dataOf(theirs) });
    shellText = null;

    // To a remembered position or to a section, the whole page is needed at once (and the header is off
    // screen); to the top of the page, the rest comes in slices below what the reader sees.
    const sliced = restoreY === null && !hash;

    if (!sameIntro) {
      material.replaceChildren();

      if (!shell && restoreY === null) {
        window.scrollTo(0, 0);
      }

      fadeIn(material);
    }

    if (sliced) {
      // KaTeX, if the page has formulas to typeset in the browser (not in the site that the Pages workflow
      // publishes, scripts/prerender.mjs): then each slice is typeset before it goes in, and laid out once.
      const katex = scriptsOf(doc, base).map(({ src }) => src).find(src => /\/katex\.js$/.test(src));

      if (katex && !loadedScripts.has(katex)) {
        await loadScript(katex);

        if (stale()) {
          return;
        }
      }

      const typeset = fragment => window.IntroAI && window.IntroAI.katex && window.IntroAI.katex.typeset(fragment);

      if (!(await appendInSlices(material, sameIntro ? rest : [...theirs.childNodes], { prepare: typeset, stale }))) {
        return;
      }
    } else {
      material.append(...(sameIntro ? rest : [...theirs.childNodes]));
    }

    // The page's own scripts, in their order: loaded the first time (they set up the page when they run),
    // set up again with the page otherwise (page.js). Each in a frame of its own when the header is seen.
    for (const { src, module } of scriptsOf(doc, base)) {
      const name = src.replace(/^.*\//, '').replace(/\.js(?:\?.*)?$/, '');

      if (name === 'main') {
        continue;
      }

      if (!loadedScripts.has(src)) {
        await loadScript(src, module);
      } else if (name !== 'katex') {
        remountPageScript(name);
      }

      if (sliced) {
        await nextFrame();
      }

      if (stale()) {
        return;
      }
    }

    // The page is set up (main.js), a step a frame.
    for (const step of pageSteps) {
      step();

      if (sliced) {
        await nextFrame();

        if (stale()) {
          return;
        }
      }
    }

    material.removeAttribute('data-loading');

    if (restoreY !== null) {
      window.scrollTo(0, restoreY);
    } else if (hash) {
      reveal(hash, true);
    }

    if (!shell) {
      focusTitle();
    }

    onPageShown();
  }

  async function go(address, { push = true, restoreY = null } = {}) {
    const url = new URL(address, window.location.href);
    const page = pageOf(url);

    // A newer version of the site has taken over (main.js, the service worker): its pages need its scripts.
    if (outdated && page !== current) {
      window.location.assign(url.href);
      return;
    }
    let hash = '';

    try {
      hash = decodeURIComponent(url.hash.slice(1));
    } catch (error) {
      // An address with a broken #...: the top of the page.
    }

    if (!page) {
      window.location.assign(url.href);
      return;
    }

    // A link to the page that is shown: to its section, or to its top.
    if (page === current && push) {
      if (hash) {
        if (url.hash !== window.location.hash) {
          saveScroll();
          window.history.pushState({}, '', url.href);
        }

        reveal(hash);
      } else {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }

      return;
    }

    const id = ++navigation;
    const html = fetchPage(page);

    if (push) {
      saveScroll();
      window.history.pushState({}, '', url.href);
    }

    current = page;
    onNavigate(url.href);

    // Back and forward wait for the whole page (it is in memory: the reader has been there), so that the
    // remembered position can be restored at once.
    const shell = restoreY === null && showShell(page);

    try {
      const text = await html;

      // The reader has gone on to another page meanwhile.
      if (id !== navigation) {
        return;
      }

      const base = new URL(page, ROOT.origin).href;
      const doc = new DOMParser().parseFromString(text, 'text/html');

      await showPage(doc, base, { shell, restoreY, hash, stale: () => id !== navigation });
    } catch (error) {
      if (id === navigation) {
        console.error(error);
        // An ordinary page load of the address, which is already the current one.
        window.location.replace(url.href);
      }
    }
  }

  // Clicks on links to pages of the site (not with a modifier key, not to another window, not a download).
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;

    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || (link.target && link.target !== '_self') || link.hasAttribute('download')) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    const page = pageOf(url);

    // Links within the page (#...) work as before.
    if (!page || (page === current && url.hash)) {
      return;
    }

    event.preventDefault();
    go(url.href);
  });

  // Back and forward.
  window.addEventListener('popstate', event => {
    const page = pageOf(new URL(window.location.href));

    if (!page) {
      window.location.reload();
      return;
    }

    if (page !== current) {
      go(window.location.href, { push: false, restoreY: savedScroll(event.state) ?? 0 });
    } else if (savedScroll(event.state) !== null) {
      window.scrollTo(0, savedScroll(event.state));
    } else if (window.location.hash) {
      reveal(decodeURIComponent(window.location.hash.slice(1)), true);
    }
  });

  // The position in the page, kept in the history entry when the reader stops scrolling.
  let timer = 0;

  window.addEventListener('scroll', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(saveScroll, 200);
  }, { passive: true });

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  // A reload, or back to this page from another site: the router restores the position now that the browser
  // does not (the page has just been set up, with every figure built: page.js).
  const y = savedScroll(window.history.state);

  if (y !== null && restoringScroll() && !window.location.hash) {
    window.scrollTo(0, y);

    // Fonts that arrive later change the layout above: once more when the page has loaded, as the browser
    // itself would, unless the reader has scrolled meanwhile.
    if (document.readyState !== 'complete') {
      const at = window.scrollY;

      window.addEventListener('load', () => {
        if (Math.abs(window.scrollY - at) < 2) {
          window.scrollTo(0, y);
        }
      }, { once: true });
    }
  }

  // The position of this entry, once the page has been drawn: reading it now (and history.replaceState, which
  // records it too) would lay out the whole page while it is still being set up (0.1 s for Week 3).
  window.requestAnimationFrame(() => window.setTimeout(saveScroll, 0));

  // The list of pages, when the browser has nothing else to do.
  const idle = window.requestIdleCallback || (callback => window.setTimeout(callback, 1500));

  if (document.readyState === 'complete') {
    idle(loadManifest);
  } else {
    window.addEventListener('load', () => idle(loadManifest), { once: true });
  }

  // From now on, a change of page is an ordinary page load.
  const outdate = () => {
    outdated = true;
  };
  const router = { go, preload, outdate };

  window.IntroAI = Object.assign(window.IntroAI || {}, { router });

  return router;
}
