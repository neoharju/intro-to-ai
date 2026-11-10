// Fetches a page of the site in advance when the reader points at a link to it (for 65 ms), touches it or
// moves to it with the keyboard, so that the page is in the browser's cache when the click comes. Only pages
// of this site are fetched, each once, and nothing when the reader has asked to save data.
const DELAY = 65;

export default function mountPrefetch() {
  const connection = navigator.connection;

  if (connection && connection.saveData) {
    return;
  }

  const here = new URL(window.location.href);
  const done = new Set([here.origin + here.pathname]);
  const hint = document.createElement('link');
  const linkHints = Boolean(hint.relList && hint.relList.supports && hint.relList.supports('prefetch'));
  let timer = 0;

  // The page that a link leads to, if it is a page of this site (not a file, not this page).
  function pageOf(target) {
    const link = target instanceof Element ? target.closest('a[href]') : null;

    if (!link || link.target === '_blank' || link.hasAttribute('download')) {
      return null;
    }

    const url = new URL(link.href, window.location.href);
    const page = url.origin + url.pathname;

    if (url.origin !== here.origin || done.has(page) || !/\/(?:index\.html)?$/.test(url.pathname)) {
      return null;
    }

    return page;
  }

  function prefetch(page) {
    done.add(page);

    if (linkHints) {
      const link = document.createElement('link');

      link.rel = 'prefetch';
      link.href = page;
      document.head.append(link);
    } else {
      // Safari has no prefetch hints: an ordinary request fills the cache too.
      window.fetch(page, { credentials: 'same-origin' }).catch(() => {});
    }
  }

  document.addEventListener('pointerover', event => {
    const page = pageOf(event.target);

    window.clearTimeout(timer);

    if (page) {
      timer = window.setTimeout(() => prefetch(page), DELAY);
    }
  }, { passive: true });

  document.addEventListener('pointerout', () => window.clearTimeout(timer), { passive: true });

  ['touchstart', 'focusin'].forEach(type => {
    document.addEventListener(type, event => {
      const page = pageOf(event.target);

      if (page) {
        prefetch(page);
      }
    }, { passive: true });
  });
}
