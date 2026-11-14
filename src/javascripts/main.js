
import Exercises from './exercises';
import Solutions from './solutions';
import TableOfContents from './table-of-contents';
import Navigation from './navigation';
import mountUi, { mountUiOnce } from './ui';
import mountThemeMenu from './theme-menu';
import mountFontSizeMenu from './font-size-menu';
import mountZen from './zen';
import mountSimplify, { extract as extractSimple } from './simplify';
import mountSearch from './search';
import mountProgress, { prefillProgress } from './progress';
import { playIntro } from './hero-text';
import mountPrefetch from './prefetch';
import mountRouter from './router';
import { loadScript } from './load-script';
import { SCRIPTS } from './scripts-url';
import mountCollapseLinks, { mountCollapses } from './collapse';
import mountDropdowns from './dropdown';
import { applyAnchors, revealHash } from './anchors';

// The listings of the material (again for every page that the router shows). In the site that the Pages
// workflow publishes they are highlighted in advance (scripts/prerender.mjs: they have the class "hljs");
// otherwise javascripts/highlight.js, loaded before this script, highlights them (or, if a page did not load
// it, it is loaded now).
const HIGHLIGHT_URL = new URL('highlight.js', SCRIPTS).href;

// Listings marked as not to be highlighted (highlight.js's own classes).
function skipped(className) {
  return /(^|\s)(nohighlight|no-highlight)(\s|$)/.test(className);
}

function highlightCode() {
  const pending = [];

  document.querySelectorAll('#material pre code').forEach(block => {
    if (block.classList.contains('hljs') || skipped(block.className)) {
      return;
    }

    // highlight.js 11 no longer merges markup inside code blocks (e.g. <sub> in pseudocode),
    // so such blocks keep their authored HTML and only get the code-block styling.
    if (block.children.length > 0) {
      block.classList.add('nohighlight', 'hljs');
      return;
    }

    pending.push(block);
  });

  if (!pending.length) {
    return;
  }

  if (window.IntroAI && window.IntroAI.highlight) {
    window.IntroAI.highlight(pending);
  } else if (HIGHLIGHT_URL) {
    loadScript(HIGHLIGHT_URL)
      .then(() => window.IntroAI.highlight(pending.filter(block => block.isConnected)))
      .catch(error => console.error(error));
  }
}

// The parts that stay from page to page: the navigation bar and its menus, the table of contents drawer, the
// search, the reading progress (router.js).
const navigation = new Navigation();
const tableOfContents = new TableOfContents();

// The parts of the page that belong to its material, in steps: set up for the first page, and again by the
// router for every page it shows (with a frame between two steps, so that the header animation goes on).
const pageSteps = [
  () => {
    // First, while the page has only the ids of its HTML (anchors.js).
    applyAnchors();
    (new Exercises()).mount();
    (new Solutions()).mount();
    // After the ids of the exercises and solutions.
    mountCollapses();
    // Before the "#" links of the headings (ui.js): the list takes the text of the headings.
    tableOfContents.build();
  },
  highlightCode,
  mountUi,
  () => {
    mountSimplify();
    mountProgress();
  },
];

// The service worker (sw.js at the root of the site, src/sw.js): the files of the site stay in the browser
// between visits, and the pages the reader has opened can be read offline. Registered once the page has loaded,
// so that it never competes with the page. When a newer version of the site takes over the page (it had a
// service worker already), the router changes page with ordinary page loads from then on.
function mountServiceWorker(router) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && router) {
      router.outdate();
    }
  });

  let checked = Date.now();
  const register = () => navigator.serviceWorker.register(new URL('../sw.js', SCRIPTS).href, { scope: new URL('../', SCRIPTS).pathname })
    .then(registration => {
      // The first visit: this page and its files were loaded before the service worker existed. It stores them
      // (from the browser's cache) so that they too are there next time.
      if (!hadController) {
        navigator.serviceWorker.ready.then(ready => {
          ready.active.postMessage({
            type: 'store',
            urls: [window.location.href, ...performance.getEntriesByType('resource').map(entry => entry.name)],
          });
        });
      }

      // The router changes page without a page load, when the browser would look for a new version: so it
      // looks when the reader changes page, at most every 30 minutes.
      document.addEventListener('introai:pagechange', () => {
        if (Date.now() - checked > 30 * 60 * 1000) {
          checked = Date.now();
          registration.update().catch(() => {});
        }
      });
    })
    .catch(() => {});

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

function mountSite() {
  mountCollapseLinks();
  mountDropdowns();
  tableOfContents.mount();
  navigation.mount();
  pageSteps.forEach(step => step());
  // The first page of a visit: its header comes in (hero.js started the network).
  playIntro();
  mountThemeMenu();
  mountFontSizeMenu();
  mountZen();
  mountSearch();
  const router = mountRouter({
    pageSteps,
    onNavigate: address => {
      navigation.setActive(address);
      document.dispatchEvent(new CustomEvent('introai:pagechange', { detail: { address } }));
    },
    onPageShown: mountUiOnce(),
    // The header of the next page says how many of its exercises are done, before it rolls in.
    prepareHero: prefillProgress,
  });

  mountServiceWorker(router);
  mountPrefetch();
  revealHash();
  // For scripts/simple.mjs --extract.
  window.IntroAI = Object.assign(window.IntroAI || {}, { simple: { extract: extractSimple } });
}

// When the page has been parsed and all its scripts have run: this one is a module, run after the parsing but
// before DOMContentLoaded, and the scripts of a week, after this one, set up its figures first (the jump to a
// section, revealHash, builds the figures above it).
if (document.readyState === 'complete') {
  mountSite();
} else {
  document.addEventListener('DOMContentLoaded', mountSite, { once: true });
}
