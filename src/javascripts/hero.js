import { prefersReducedMotion } from './utils';

// A slowly drifting network of nodes behind the page title. It is drawn only while the header is on
// screen, and stays still when the reader prefers reduced motion. It goes on from page to page: when the
// reader leaves a page, the nodes are kept for this tab (sessionStorage), and the next page carries on
// from them, moved on by the time that the change of page took, instead of starting again.
const LINK_DISTANCE = 130;
const KEY = 'introai-hero-v1';
const FRAME = 1000 / 60;

// The nodes that the previous page left, or null.
function saved() {
  try {
    const data = JSON.parse(window.sessionStorage.getItem(KEY));

    return data && Array.isArray(data.nodes) && data.width > 0 && data.height > 0 ? data : null;
  } catch (error) {
    return null;
  }
}

export default function mountHero() {
  const hero = document.querySelector('.page-hero');

  if (!hero) {
    return;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  canvas.className = 'page-hero__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);

  const still = prefersReducedMotion();
  let width = 0;
  let height = 0;
  let nodes = [];
  let visible = true;
  let frame = 0;
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

  // Fits the nodes to a new size of the header: they keep their places relative to it (those of the
  // previous page, the first time), and nodes are added or dropped so that the density stays the same.
  function fitNodes(oldWidth, oldHeight) {
    const count = Math.round(Math.min(64, Math.max(18, width * height / 9000)));
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

    if (fromWidth && fromHeight) {
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

  function tick() {
    frame = 0;

    if (!visible || document.hidden) {
      return;
    }

    step();
    draw();
    frame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (!still && !frame) {
      frame = window.requestAnimationFrame(tick);
    }
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const resized = Math.abs(rect.width - width) > 1 || Math.abs(rect.height - height) > 1;

    if (!resized) {
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
  }

  // The first size comes from the observer, after the browser's layout and before the first paint:
  // measuring now would lay out the whole page while it is still being set up.
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(hero);
  } else {
    window.requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
  }

  // Leaving the page (a link, the history, a reload): the next page carries on from here.
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

  // The header morphs into the next page's header only when it is on screen (see the view transitions in
  // _hero.scss): leaving a page scrolled further down, the page crossfades as a whole. (Arriving at a
  // section further down is handled in theme.js.)
  window.addEventListener('pageswap', event => {
    if (event.viewTransition && !visible) {
      document.documentElement.classList.add('no-hero-morph');
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

  start();
}
