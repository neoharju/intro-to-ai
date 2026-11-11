// Fetches a page of the site in advance when the reader points at a link to it (for 65 ms), touches it or
// moves to it with the keyboard, so that the page is in memory when the click comes (router.js keeps it, and
// lets the browser fetch the scripts that page needs). Each page is fetched once, and nothing is fetched in
// advance when the reader has asked to save data.
import { preload } from './router';

const DELAY = 65;

export default function mountPrefetch() {
  const connection = navigator.connection;

  if (connection && connection.saveData) {
    return;
  }

  const done = new Set();
  let timer = 0;

  // The address of the link at `target`, if it may lead to another page of this site.
  function linkOf(target) {
    const link = target instanceof Element ? target.closest('a[href]') : null;

    if (!link || link.target === '_blank' || link.hasAttribute('download')) {
      return null;
    }

    const url = new URL(link.href, window.location.href);

    url.hash = '';

    if (url.origin !== window.location.origin || url.pathname === window.location.pathname || done.has(url.href)) {
      return null;
    }

    return url.href;
  }

  function prefetch(address) {
    done.add(address);
    preload(address);
  }

  document.addEventListener('pointerover', event => {
    const address = linkOf(event.target);

    window.clearTimeout(timer);

    if (address) {
      timer = window.setTimeout(() => prefetch(address), DELAY);
    }
  }, { passive: true });

  document.addEventListener('pointerout', () => window.clearTimeout(timer), { passive: true });

  ['touchstart', 'focusin'].forEach(type => {
    document.addEventListener(type, event => {
      const address = linkOf(event.target);

      if (address) {
        prefetch(address);
      }
    }, { passive: true });
  });
}
