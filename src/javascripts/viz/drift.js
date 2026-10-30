import { drive, miss, plannedCorners } from './drift-core';
import { button, createLoop, createRandom, el, fmt, frame, prefersReducedMotion, segmented, slider, stat, svg } from './lib';

const SIDES = 18;
const RUNS = 6;
const SLIPS = [0, 0.01, 0.02, 0.05, 0.1];
const TURNS = [0, 0.5, 1, 2, 4];
const FEEDBACK = [
  { value: 0, label: 'No feedback' },
  { value: 6, label: 'Fix every 6 corners' },
  { value: 1, label: 'Fix every corner' },
];
// Sides driven per second while the robots drive.
const SPEED = 7;
const SIDE_CM = 50;

// The planned polygon has side 1, starts at the origin and turns left: its centre is at (0.5, apothem).
const APOTHEM = 1 / (2 * Math.tan(Math.PI / SIDES));
const RADIUS = 1 / (2 * Math.sin(Math.PI / SIDES));
const VIEW = RADIUS + 1.2;
const SCALE = 40;

const toX = x => (x - 0.5 + VIEW) * SCALE;
const toY = y => (VIEW - (y - APOTHEM)) * SCALE;
const points = path => path.map(([x, y]) => `${fmt(toX(x), 1)},${fmt(toY(y), 1)}`).join(' ');

export default function mountDrift(figure) {
  const { body } = frame(figure, 'Dead reckoning: why a robot misses its own starting point');
  let slip = 2;
  let turn = 3;
  let laps = 3;
  let fixEvery = 0;
  let seed = 1;
  let runs = [];
  let progress = 1;

  const size = 2 * VIEW * SCALE;
  const plot = svg('svg', {
    viewBox: `0 0 ${size} ${size}`,
    class: 'drift',
    role: 'img',
    'aria-label': 'The planned 18-sided path as a dashed line and the paths that six robots actually drove.',
  });
  const stage = el('div', { class: 'vz-stage', style: 'padding:.5rem' }, plot);

  const loop = createLoop(figure, dt => {
    progress = Math.min(1, progress + (dt / 1000) * SPEED / (SIDES * laps));
    draw();

    return progress < 1;
  });

  const controls = {
    slip: slider({ label: 'Wheel slip', min: 0, max: SLIPS.length - 1, value: slip, format: i => `${fmt(SLIPS[i] * 100, 0)} %`, onInput: v => { slip = v; simulate(false); }, width: '6rem' }),
    turn: slider({ label: 'Turn error', min: 0, max: TURNS.length - 1, value: turn, format: i => `${TURNS[i]}°`, onInput: v => { turn = v; simulate(false); }, width: '6rem' }),
    laps: slider({ label: 'Laps', min: 1, max: 5, value: laps, onInput: v => { laps = v; simulate(false); }, width: '6rem' }),
    feedback: segmented(FEEDBACK, fixEvery, value => { fixEvery = value; simulate(false); }, 'Feedback'),
  };

  const stats = {
    mean: stat('Average miss at the end'),
    worst: stat('Worst of the six'),
    cm: stat(`If a side is ${SIDE_CM} cm`),
  };
  const note = el('p', { class: 'vz-narration', 'aria-live': 'polite', style: 'margin-top:.75rem' });

  body.append(
    el('div', { class: 'vz-controls' }, controls.feedback.node),
    stage,
    el('div', { class: 'vz-controls' },
      button('Drive again', () => simulate(true), { primary: true }),
      controls.slip.node, controls.turn.node, controls.laps.node),
    el('ul', { class: 'vz-legend' },
      el('li', {}, el('i', { class: 'drift-key drift-key--plan', 'aria-hidden': 'true' }), 'planned path'),
      el('li', {}, el('i', { class: 'drift-key drift-key--run', 'aria-hidden': 'true' }), 'six robots, same commands'),
      el('li', {}, el('i', { class: 'drift-key drift-key--start', 'aria-hidden': 'true' }), 'start, where every lap should end')),
    el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
    note
  );

  // New runs with the current settings; drawn at once, or driven one side at a time.
  function simulate(animate) {
    const random = createRandom(seed);

    seed += 1;
    runs = Array.from({ length: RUNS }, () => drive({
      sides: SIDES,
      laps,
      slip: SLIPS[slip],
      turnError: (TURNS[turn] * Math.PI) / 180,
      fixEvery,
      normal: random.normal,
    }));

    loop.stop();
    progress = animate && !prefersReducedMotion() ? 0 : 1;
    draw();

    if (progress < 1) {
      loop.start();
    }
  }

  function draw() {
    const steps = SIDES * laps;
    const shown = Math.floor(progress * steps);
    const partial = progress * steps - shown;
    const plan = plannedCorners(SIDES);

    plot.replaceChildren(svg('polygon', { class: 'drift-plan', points: points(plan.slice(0, -1)) }));

    runs.forEach((path, k) => {
      const visible = path.slice(0, shown + 1);

      // The side being driven, part of the way.
      if (shown < steps) {
        const [ax, ay] = path[shown];
        const [bx, by] = path[shown + 1];

        visible.push([ax + (bx - ax) * partial, ay + (by - ay) * partial]);
      }

      const end = visible[visible.length - 1];

      plot.append(
        svg('polyline', { class: `drift-run${k === 0 ? ' is-first' : ''}`, points: points(visible) }),
        svg('circle', { class: 'drift-end', cx: toX(end[0]), cy: toY(end[1]), r: progress < 1 ? 5 : 4 }));
    });

    plot.append(svg('circle', { class: 'drift-start', cx: toX(0), cy: toY(0), r: 6 }));

    if (progress >= 1) {
      const misses = runs.map(miss);
      const mean = misses.reduce((a, b) => a + b, 0) / misses.length;

      stats.mean.set(`${fmt(mean, 2)} sides`);
      stats.worst.set(`${fmt(Math.max(...misses), 2)} sides`);
      stats.cm.set(`about ${fmt(mean * SIDE_CM, 0)} cm off`);
      note.textContent = fixEvery === 0
        ? 'Without feedback every small turn error rotates all the sides that follow it, so the errors add up lap after lap.'
        : fixEvery === 1
          ? 'With a position fix at every corner the robot steers back towards the plan: the errors no longer add up.'
          : 'A fix every few corners pulls the robot back now and then; between the fixes the errors add up again.';
    } else {
      stats.mean.set('…');
      stats.worst.set('…');
      stats.cm.set('…');
    }
  }

  simulate(false);
}
