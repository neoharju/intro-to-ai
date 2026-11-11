// The life of one page view. The site changes page without leaving the document (router.js): the navigation
// bar, the header and its animation stay, and only the material is replaced. Everything that a page sets up
// for its own material (listeners on window or document, observers, animation loops) must end with it, or
// every visit to a week would leave its figures running in the background. So each page view has an
// AbortSignal, shared by every bundle of the site through window.IntroAI.page (each bundle has its own copy
// of this module, but they all read the same object):
//
//   window.addEventListener('resize', onResize, { signal: pageSignal() });
//   onPageEnd(() => observer.disconnect());
//
// The router ends the view (aborts the signal) just before the next page's material goes in.
//
// The scripts that only some pages load (math.js, quiz.js, weekN.js) register how they set up a page with
// definePageScript: they do it once when they are loaded, and the router calls them again whenever the reader
// comes back to a page that uses them, without loading them a second time.

function api() {
  window.IntroAI = window.IntroAI || {};

  return window.IntroAI;
}

function view() {
  const site = api();

  if (!site.page) {
    site.page = { controller: new AbortController(), restore: null, scripts: {} };
  }

  return site.page;
}

// The signal of the current page view: aborted when the reader moves on to another page.
export function pageSignal() {
  return view().controller.signal;
}

// Runs `callback` once, when the current page view ends.
export function onPageEnd(callback) {
  pageSignal().addEventListener('abort', callback, { once: true });
}

// For the router: ends the current page view and starts the next one. `restore` is true when the next page is
// shown at a remembered scroll position (back or forward in the history), false when it starts at the top
// or at a section, and null for the first page of the visit (then the browser's navigation type tells).
export function nextPageView(restore) {
  const page = view();

  page.controller.abort();
  page.controller = new AbortController();
  page.restore = restore;
}

// Whether the page is being shown at a scroll position that the browser or the router restores, rather than
// from its top: then the parts of the page that change height must all be there at once.
export function restoringScroll() {
  const { restore } = view();

  if (restore !== null) {
    return restore;
  }

  const navigation = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;

  return !navigation || navigation.type !== 'navigate';
}

// A script that only some pages load: `mount` sets up the current page now, and again each time the router
// shows a page that lists this script.
export function definePageScript(name, mount) {
  view().scripts[name] = mount;
  mount();
}

// For the router: sets up the current page with an already loaded script; false if it is not loaded.
export function remountPageScript(name) {
  const mount = view().scripts[name];

  if (!mount) {
    return false;
  }

  mount();

  return true;
}
