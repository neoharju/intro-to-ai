// A slowly drifting network of nodes behind the page title (javascripts/hero.js, loaded in the <head>).
//
// It is drawn before the page is first shown: the script waits in the <head> for the header to be parsed
// and puts its canvas in at once, so a page reached through a view transition (see _hero.scss) already has
// its network in the first frame. It goes on from page to page: when the reader leaves a page, the nodes are
// kept for this tab (sessionStorage), and the next page carries on from them, moved on by the time that the
// change of page took. The network lives in a field of the same size on every page (the canvas is at least
// 384 px high, more than any header: _hero.scss), of which a shorter header simply shows less, so the nodes
// keep their places. It is drawn only while the header is on screen, and stays still when the reader
// prefers reduced motion.
const LINK_DISTANCE = 130;
const KEY = 'introai-hero-v1';
// The nodes move a step every 1/60 s, whatever the refresh rate of the screen (a 120 Hz screen would
// otherwise run them twice as fast), and the network is drawn 30 times a second: a node moves at most 0.2 px
// between two drawings, too little to see the difference, and the work (drawing, and handing the canvas
// to the screen, about 3 ms a frame without a GPU) is halved, or more on faster screens.
const FRAME = 1000 / 60;
const DRAW_EVERY = 1000 / 30;

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
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  canvas.className = 'page-hero__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);

  const still = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let width = 0;
  let height = 0;
  let nodes = [];
  let visible = true;
  let frame = 0;
  // The time of the last drawing, and the steps not yet taken.
  let drawn = 0;
  let owed = 0;
  // The still picture is always the same one; a moving network carries on from the previous page.
  let previous = still ? null : saved();

  // A fixed seed, so the still picture is the same on every visit.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  function createNode(index) {
    return {
      x: random() * width,
      y: random() * height,
      vx: (random() - 0.5) * 0.18,
      vy: (random() - 0.5) * 0.18,
      radius: 1.2 + random() * 1.6,
      accent: index % 9 === 0,
    };
  }

  function step() {
    nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0 || node.x > width) {
        node.vx = -node.vx;
        node.x = Math.min(width, Math.max(0, node.x));
      }

      if (node.y < 0 || node.y > height) {
        node.vy = -node.vy;
        node.y = Math.min(height, Math.max(0, node.y));
      }
    });
  }

  // Fits the nodes to a new size of the field: they keep their places (those of the previous page, the first
  // time; scaled only if the field itself changed, as when the window is resized), and nodes are added or
  // dropped so that the density stays the same.
  function fitNodes(oldWidth, oldHeight) {
    const count = Math.round(Math.min(96, Math.max(18, width * height / 9000)));
    let fromWidth = oldWidth;
    let fromHeight = oldHeight;
    let steps = 0;

    if (previous) {
      nodes = previous.nodes.map(([x, y, vx, vy, radius], index) => ({ x, y, vx, vy, radius, accent: index % 9 === 0 }));
      fromWidth = previous.width;
      fromHeight = previous.height;
      steps = Math.min(600, Math.max(0, Math.round((Date.now() - previous.time) / FRAME)));
      previous = null;
    }

    if (fromWidth && fromHeight && (Math.abs(fromWidth - width) > 1 || Math.abs(fromHeight - height) > 1)) {
      nodes.forEach(node => {
        node.x *= width / fromWidth;
        node.y *= height / fromHeight;
      });
    }

    nodes = nodes.slice(0, count);

    while (nodes.length < count) {
      nodes.push(createNode(nodes.length));
    }

    // The time that the change of page took.
    for (let i = 0; i < steps; i++) {
      step();
    }
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distance = Math.hypot(dx, dy);

        if (distance < LINK_DISTANCE) {
          context.strokeStyle = `rgba(82, 138, 252, ${0.32 * (1 - distance / LINK_DISTANCE)})`;
          context.beginPath();
          context.moveTo(nodes[i].x, nodes[i].y);
          context.lineTo(nodes[j].x, nodes[j].y);
          context.stroke();
        }
      }
    }

    nodes.forEach(node => {
      context.fillStyle = node.accent ? 'rgba(255, 171, 14, .9)' : 'rgba(37, 99, 235, .55)';
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fill();
    });
  }

  function tick(time) {
    frame = 0;

    if (!visible || document.hidden) {
      drawn = 0;
      return;
    }

    frame = window.requestAnimationFrame(tick);

    // The first frame after a pause draws at once; a little early is better than a skipped frame (2 ms).
    if (drawn && time - drawn < DRAW_EVERY - 2) {
      return;
    }

    // At most a second of steps after a long pause (the browser was busy).
    owed = Math.min(60, owed + (drawn ? (time - drawn) / FRAME : 1));
    drawn = time;

    for (; owed >= 1; owed -= 1) {
      step();
    }

    draw();
  }

  function start() {
    if (!still && !frame && width) {
      frame = window.requestAnimationFrame(tick);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);

    if (Math.abs(rect.width - width) <= 1 && Math.abs(rect.height - height) <= 1) {
      return;
    }

    const oldWidth = width;
    const oldHeight = height;

    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    fitNodes(oldWidth, oldHeight);
    draw();
    start();
  }

  // The first size comes from the observer, after the browser's first layout and before the first paint.
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;

      if (visible) {
        start();
      }
    }).observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      start();
    }
  });

  // Leaving the page (a link, the history, a reload): the next page carries on from here. When the header
  // is off screen, the header of the next page does not morph from it (_hero.scss).
  window.addEventListener('pageswap', event => {
    if (event.viewTransition && !visible) {
      document.documentElement.classList.add('no-hero-morph');
    }
  });

  window.addEventListener('pagehide', () => {
    if (still || !nodes.length) {
      return;
    }

    try {
      window.sessionStorage.setItem(KEY, JSON.stringify({
        time: Date.now(),
        width,
        height,
        nodes: nodes.map(node => [node.x, node.y, node.vx, node.vy, node.radius].map(value => Math.round(value * 1000) / 1000)),
      }));
    } catch (error) {
      // No storage: the next page starts afresh.
    }
  });

  // Back to this page from the browser's memory (the back button): carry on from the page that was left.
  window.addEventListener('pageshow', event => {
    if (event.persisted && !still) {
      previous = saved();

      if (previous && width && height) {
        fitNodes(width, height);
        draw();
      }
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
