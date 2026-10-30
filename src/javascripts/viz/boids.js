import {
  COLORS, button, createCanvas, createLoop, createRandom, el, fmt, frame, playButton,
  prefersReducedMotion, slider, stat,
} from './lib';

const MAX_SPEED = 2.2;
const MIN_SPEED = 0.9;
const MAX_FORCE = 0.06;
const SEPARATION_RADIUS = 18;

// Reynolds' boids: each boid steers by three local rules, using only the neighbours within its
// view radius: separation (move away from boids that are too close), alignment (match the average
// heading of the neighbours) and cohesion (move towards their average position).
export function steer(boids, i, weights, radius) {
  const me = boids[i];
  const separation = [0, 0];
  const heading = [0, 0];
  const centre = [0, 0];
  let neighbours = 0;

  boids.forEach((other, j) => {
    if (i === j) {
      return;
    }

    const dx = other.x - me.x;
    const dy = other.y - me.y;
    const d = Math.hypot(dx, dy);

    if (d < radius) {
      neighbours += 1;
      heading[0] += other.vx;
      heading[1] += other.vy;
      centre[0] += other.x;
      centre[1] += other.y;

      if (d < SEPARATION_RADIUS && d > 0) {
        separation[0] -= dx / (d * d);
        separation[1] -= dy / (d * d);
      }
    }
  });

  if (!neighbours) {
    return [0, 0];
  }

  const limit = ([x, y], max) => {
    const length = Math.hypot(x, y);

    return length > max ? [(x / length) * max, (y / length) * max] : [x, y];
  };

  // Each rule asks for a velocity; the steering force is the difference to the current one.
  const towards = ([x, y]) => {
    const length = Math.hypot(x, y) || 1;

    return limit([(x / length) * MAX_SPEED - me.vx, (y / length) * MAX_SPEED - me.vy], MAX_FORCE);
  };

  const sep = separation[0] || separation[1] ? towards(separation) : [0, 0];
  const ali = towards(heading);
  const coh = towards([centre[0] / neighbours - me.x, centre[1] / neighbours - me.y]);

  return [
    weights.separation * 1.5 * sep[0] + weights.alignment * ali[0] + weights.cohesion * coh[0],
    weights.separation * 1.5 * sep[1] + weights.alignment * ali[1] + weights.cohesion * coh[1],
  ];
}

// 1 when all boids move in the same direction, near 0 when their directions are random.
export function polarization(boids) {
  let sx = 0;
  let sy = 0;

  boids.forEach(b => {
    const speed = Math.hypot(b.vx, b.vy) || 1;

    sx += b.vx / speed;
    sy += b.vy / speed;
  });

  return Math.hypot(sx, sy) / boids.length;
}

export default function mountBoids(figure) {
  const { body } = frame(figure, 'Flocking from three local rules');
  const random = createRandom(4);
  const weights = { separation: 1, alignment: 1, cohesion: 1 };
  let radius = 50;
  let boids = [];

  const stage = el('div', { class: 'vz-stage' });
  const view = createCanvas(stage, {
    aspect: 0.5,
    minHeight: 220,
    maxHeight: 380,
    label: 'Animated flock of boids; each moves according to separation, alignment and cohesion with its neighbours.',
    onResize: () => draw(),
  });

  const order = stat('Polarization');
  const loop = createLoop(figure, () => {
    step();
    draw();
  });

  const control = (key, label) => slider({
    label,
    min: 0,
    max: 2,
    step: 0.1,
    value: weights[key],
    format: v => fmt(v, 1),
    onInput: v => { weights[key] = v; },
    width: '7rem',
  });

  body.append(
    stage,
    el('div', { class: 'vz-controls' },
      control('separation', 'Separation').node,
      control('alignment', 'Alignment').node,
      control('cohesion', 'Cohesion').node,
      slider({ label: 'View radius', min: 15, max: 120, step: 5, value: radius, onInput: v => { radius = v; }, width: '7rem' }).node),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' }, playButton(loop), button('Scatter', () => { scatter(); draw(); })),
      el('div', { style: 'min-width:9rem' }, order.node))
  );

  function scatter() {
    const count = view.width < 500 ? 70 : 130;

    boids = Array.from({ length: count }, () => {
      const angle = 2 * Math.PI * random();
      const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * random();

      return { x: random() * view.width, y: random() * view.height, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    });
  }

  function step() {
    const { width, height } = view;
    const forces = boids.map((b, i) => steer(boids, i, weights, radius));

    boids.forEach((b, i) => {
      b.vx += forces[i][0];
      b.vy += forces[i][1];

      const speed = Math.hypot(b.vx, b.vy) || 1;
      const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));

      b.vx = (b.vx / speed) * clamped;
      b.vy = (b.vy / speed) * clamped;
      b.x = (b.x + b.vx + width) % width;
      b.y = (b.y + b.vy + height) % height;
    });
  }

  function draw() {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    if (!boids.length) {
      scatter();
    }

    ctx.clearRect(0, 0, width, height);

    boids.forEach(b => {
      const angle = Math.atan2(b.vy, b.vx);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, 3.6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, -3.6);
      ctx.closePath();
      ctx.fillStyle = COLORS.blue;
      ctx.fill();
      ctx.restore();
    });

    order.set(fmt(polarization(boids), 2));
  }

  // Starts on its own unless the reader prefers reduced motion.
  if (!prefersReducedMotion()) {
    loop.start();
  }
}
