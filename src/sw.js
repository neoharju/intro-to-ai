// The service worker of the site (sw.js at its root, written from this file by scripts/sync.mjs, which fills
// in VERSION and SHELL). GitHub Pages lets every file be cached for 10 minutes only; this keeps the files of
// the site in the browser instead, so that a reader who comes back loads nothing that has not changed, and can
// read the pages they have opened without a connection.
//
//   - VERSION is a hash of the content of the site: any change to a page or a file of it makes a new service
//     worker, which empties the caches of the old one. A page never mixes old and new files: after a new
//     version has taken over, the router changes page with an ordinary page load (main.js).
//   - SHELL, the files that every page needs (the styles, the scripts, the text font, pages.json), is stored
//     when the service worker is installed.
//   - Pages, the simplified English, the scripts of the weeks and the pictures are stored when they are first
//     loaded, and then come from the store. Nothing in the store can be out of date: a change would have made
//     a new version. The browser looks for a new sw.js on every page load (the router, which changes page
//     without one, asks too: main.js).
//   - What the service worker stores comes from the server, not from the browser's HTTP cache, which may
//     still hold the files of the previous version for up to 10 minutes after a new one is published.
//   - Not stored: anything but GET, other sites, the downloads (files/), requests for part of a file, and what
//     the page asks for with cache: 'no-cache' (it comes from the network, and from the store only offline).
//
// To take the service worker away, publish a sw.js that empties the caches and unregisters itself.
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const CACHE = `introai-${VERSION}`;
const SCOPE = new URL('./', self.location.href);

// On the first visit, the browser has just loaded the shell: it is taken from its HTTP cache. A new version
// takes it from the server (the HTTP cache may still hold the files of the old one).
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const update = (await caches.keys()).some(key => key.startsWith('introai-'));
    const cache = await caches.open(CACHE);

    await cache.addAll(SHELL.map(path => new Request(new URL(path, SCOPE).href, { cache: update ? 'reload' : 'default' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('introai-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

// Pages, and the files of the site worth keeping.
function storable(url) {
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname)
    && !url.pathname.startsWith(`${SCOPE.pathname}files/`)
    && (/\/$|\.(?:html|js|css|json|woff2?|svg|png|jpe?g|webp|avif|gif)$/.test(url.pathname));
}

// A reader offline, on a page they have not opened before.
function offline() {
  return new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
    + '<title>Offline</title><p style="font:1.1rem/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">'
    + 'You are offline, and this page has not been opened on this device before. The pages you have opened can be '
    + 'read offline.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function fromNetwork(request, cache) {
  // A conditional request: the server answers "not modified" (and nothing more) if the file is unchanged.
  const response = await fetch(request, { cache: 'no-cache' });

  // Only whole, successful answers of this site (not a redirect, not an error page).
  if (response.ok && response.status === 200 && response.type === 'basic' && !response.redirected) {
    await cache.put(request, response.clone());
  }

  return response;
}

// The address under which a file is stored: a page without its #…, and with or without index.html.
function keyOf(address) {
  const key = new URL(address);

  key.hash = '';
  key.pathname = key.pathname.replace(/index\.html$/, '');

  return new Request(key.href, { credentials: 'same-origin' });
}

async function respond(request) {
  const cache = await caches.open(CACHE);
  const keyed = keyOf(request.url);

  if (request.cache === 'no-cache' || request.cache === 'reload') {
    try {
      return await fromNetwork(keyed, cache);
    } catch (error) {
      return (await cache.match(keyed)) || Response.error();
    }
  }

  const stored = await cache.match(keyed);

  if (stored) {
    return stored;
  }

  try {
    const response = await fromNetwork(keyed, cache);

    // A page may not be answered with a redirected response: the browser follows the redirect itself.
    return response.redirected && request.mode === 'navigate' ? Response.redirect(response.url, 302) : response;
  } catch (error) {
    return request.mode === 'navigate' ? offline() : Response.error();
  }
}

// The first page of the first visit was loaded before the service worker existed: it sends the addresses of
// the page and of the files it loaded (main.js), which are stored from the browser's HTTP cache, without
// loading them again.
self.addEventListener('message', event => {
  const { data } = event;

  if (!data || data.type !== 'store' || !Array.isArray(data.urls)) {
    return;
  }

  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(data.urls
    .filter(address => typeof address === 'string')
    .map(address => new URL(address, SCOPE))
    .filter(storable)
    .map(async url => {
      const keyed = keyOf(url.href);

      if (await cache.match(keyed)) {
        return;
      }

      const response = await fetch(keyed);

      if (response.ok && response.status === 200 && response.type === 'basic' && !response.redirected) {
        await cache.put(keyed, response);
      }
    }))).catch(() => {}));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || request.headers.has('range') || !storable(url)) {
    return;
  }

  event.respondWith(respond(request));
});
