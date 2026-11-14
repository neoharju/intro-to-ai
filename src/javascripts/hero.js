// A slowly drifting network of nodes behind the page title (javascripts/hero.js, loaded in the <head>).
//
// The script waits in the <head> for the header to be parsed and puts its canvas in at once. The network itself is
// drawn by javascripts/hero-render.js, in a worker that this script hands the canvas to (an OffscreenCanvas): so it
// is drawn 60 times a second or more whatever the page is busy with, and the page is not slowed down by it. In a
// browser whose workers cannot draw, hero-render.js runs on the page instead. This script tells it the size of the
// canvas, whether the header is on screen, the colour theme, the changes of page (the wave) and the end of the
// intro, and keeps the network for the next page: when the reader leaves a page, the nodes are kept for this tab
// (sessionStorage), and the next page carries on from them, moved on by the time that the change of page took.
// The network stays still when the reader prefers reduced motion.
//
// On the first page of a visit (no network to carry on from), from its top, the network opens with the intro: this
// script marks it on <html> (hero-intro), and the text of the header comes in with it (hero-text.js, _hero.scss).
const KEY = 'introai-hero-v1';
const SCRIPT = document.currentScript ? document.currentScript.src : '';

// The nodes that the previous page left, or null.
function saved() {
  try {
    const data = JSON.parse(window.sessionStorage.getItem(KEY));

    return data && Array.isArray(data.nodes) && data.width > 0 && data.height > 0 ? data : null;
  } catch (error) {
    return null;
  }
}

function mountHero(hero) {
  const root = document.documentElement;
  const still = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const previous = still ? null : saved();
  const navigation = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  const intro = !still && !previous && !window.location.hash && !document.hidden && !root.hasAttribute('data-zen')
    && !(navigation && navigation.type === 'back_forward');
  const dark = () => root.getAttribute('data-theme') === 'dark';
  let canvas = null;
  let visible = true;
  let size = { width: 0, height: 0 };
  // The latest nodes (from the renderer), kept for the next page.
  let state = null;
  // Messages for the renderer, until it is there.
  let queue = [];
  let send = message => queue.push(message);

  if (intro) {
    root.classList.add('hero-intro');
  }

  function receive(message) {
    if (message.type === 'state') {
      state = message;
    } else if (message.type === 'ready') {
      canvas.classList.add('is-ready');
    } else if (message.type === 'mask') {
      canvas.classList.toggle('is-masked', message.on);
    } else if (message.type === 'intro') {
      root.setAttribute('data-hero-intro', String(Math.round(message.at - performance.timeOrigin)));
      root.classList.add('hero-intro--go');
      // The text is not kept waiting: if the page is not ready to bring it in soon, it is shown now (the largest
      // text of the page, which the browser times as the moment the page is seen) while the burst goes on.
      window.setTimeout(() => {
        if (root.classList.contains('hero-intro') && !root.classList.contains('hero-intro--run')) {
          root.classList.add('hero-intro--late');
        }
      }, 650);
    }
  }

  function newCanvas() {
    const next = document.createElement('canvas');

    next.className = 'page-hero__canvas';
    next.setAttribute('aria-hidden', 'true');

    if (canvas) {
      canvas.replaceWith(next);
    } else {
      hero.prepend(next);
    }

    canvas = next;
  }

  const init = () => ({ type: 'init', still, dark: dark(), intro, previous });
  const pending = () => {
    const messages = queue;

    queue = null;
    return messages;
  };

  // On the page: hero-render.js as a plain script, with a canvas of its own.
  function onPage() {
    const script = document.createElement('script');
    const messages = queue || [];

    newCanvas();
    queue = [];
    send = message => queue.push(message);
    script.src = new URL('hero-render.js', SCRIPT).href;
    script.onload = () => {
      const render = window.IntroAIHeroRender(receive);

      send = render;
      render({ ...init(), canvas });
      [...messages.filter(message => message.type !== 'init'), ...pending()].forEach(render);
    };
    document.head.append(script);

    // The size of the new canvas, if it is known already (a worker that could not start).
    if (size.width) {
      send({ type: 'resize', ...size, ratio: Math.min(2, window.devicePixelRatio || 1) });
    }
  }

  newCanvas();

  if (SCRIPT && canvas.transferControlToOffscreen && typeof Worker === 'function') {
    try {
      const worker = new Worker(new URL('hero-render.js', SCRIPT).href);
      const offscreen = canvas.transferControlToOffscreen();

      worker.onmessage = event => receive(event.data);
      // A worker that cannot start (blocked, or the file missing): the page draws instead.
      worker.onerror = () => {
        worker.terminate();
        onPage();
      };
      worker.postMessage({ ...init(), canvas: offscreen }, [offscreen]);
      pending().forEach(message => worker.postMessage(message));
      send = message => worker.postMessage(message);
    } catch (error) {
      onPage();
    }
  } else if (SCRIPT) {
    onPage();
  }

  // The size of the canvas, after the browser's first layout and whenever it changes; not while the header is not
  // shown at all (zen mode), which would squeeze the network into nothing.
  const resize = () => {
    const rect = canvas.getBoundingClientRect();

    if (rect.width >= 1 && rect.height >= 1 && (Math.abs(rect.width - size.width) > 1 || Math.abs(rect.height - size.height) > 1)) {
      size = { width: rect.width, height: rect.height };
      send({ type: 'resize', ...size, ratio: Math.min(2, window.devicePixelRatio || 1) });
    }
  };

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(hero);
  } else {
    window.requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
  }

  // Drawn only while the header is on screen and the page is shown.
  const show = () => send({ type: 'visible', visible: visible && !document.hidden });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      show();
    }).observe(hero);
  }

  document.addEventListener('visibilitychange', show);
  document.addEventListener('introai:themechange', () => send({ type: 'theme', dark: dark() }));

  // The intro gives way to the reader at once: a click, a key, the wheel or a touch ends it.
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type => window.addEventListener(type, () => send({ type: 'skip' }),
    { once: true, passive: true, capture: true }));

  // A change of page by the router (main.js): the wave.
  document.addEventListener('introai:pagechange', () => {
    if (!still) {
      send({ type: 'pulse' });
    }
  });

  // Leaving the page (a link, the history, a reload): the next page carries on from here. When the header
  // is off screen, the header of the next page does not morph from it (_hero.scss).
  window.addEventListener('pageswap', event => {
    if (event.viewTransition && !visible) {
      root.classList.add('no-hero-morph');
    }
  });

  window.addEventListener('pagehide', () => {
    if (state) {
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify({ time: state.time, width: state.width, height: state.height, nodes: state.nodes }));
      } catch (error) {
        // No storage: the next page starts afresh.
      }
    }
  });

  // Back to this page from the browser's memory (the back button): carry on from the page that was left.
  window.addEventListener('pageshow', event => {
    if (event.persisted && !still) {
      send({ type: 'carry', previous: saved() });
    }
  });
}

// Arriving at a section further down (an address with #...) through a view transition: the header of the new
// page is off screen, so it does not morph from the header of the old one; the page crossfades as a whole.
window.addEventListener('pagereveal', event => {
  if (event.viewTransition && window.location.hash) {
    const root = document.documentElement;

    root.classList.add('no-hero-morph');
    event.viewTransition.finished.then(() => root.classList.remove('no-hero-morph'), () => {});
  }
});

// The header as soon as the parser has made it, before the page is first drawn.
const hero = document.querySelector('.page-hero');

if (hero) {
  mountHero(hero);
} else {
  const watcher = new MutationObserver(() => {
    const found = document.querySelector('.page-hero');

    if (found) {
      watcher.disconnect();
      mountHero(found);
    }
  });

  watcher.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => watcher.disconnect(), { once: true });
}
