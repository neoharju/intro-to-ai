import { prefersReducedMotion } from './utils';

// A slowly drifting network of nodes behind the page title. It is drawn only while the header is on
// screen, and stays still when the reader prefers reduced motion.
const LINK_DISTANCE = 130;

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

  // A fixed seed, so the still picture is the same on every visit.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  function createNodes() {
    const count = Math.round(Math.min(64, Math.max(18, width * height / 9000)));

    nodes = Array.from({ length: count }, (value, index) => ({
      x: random() * width,
      y: random() * height,
      vx: (random() - 0.5) * 0.18,
      vy: (random() - 0.5) * 0.18,
      radius: 1.2 + random() * 1.6,
      accent: index % 9 === 0,
    }));
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

    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    createNodes();
    draw();
  }

  resize();

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(hero);
  } else {
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

  start();
}
