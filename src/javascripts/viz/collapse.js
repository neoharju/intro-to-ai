import {
  COLORS, button, createCanvas, createLoop, el, fmt, frame, legend, lineChart, playButton, slider, stat,
} from './lib';

const CATEGORIES = 20;
const SAMPLE_SIZES = [25, 50, 100, 200, 500, 1000];
const MAX_GENERATIONS = 200;

// A long-tailed distribution over 20 categories (Zipf-like, p_k proportional to 1 / k^1.2).
function original() {
  const weights = Array.from({ length: CATEGORIES }, (v, k) => 1 / (k + 1) ** 1.2);
  const total = weights.reduce((a, b) => a + b, 0);

  return weights.map(w => w / total);
}

// One generation: draw n samples from the current model and fit the next model to them, here simply
// the observed frequencies (the maximum-likelihood estimate). A category that gets no samples has
// probability 0 from then on.
export function nextGeneration(model, n, random = Math.random) {
  const cumulative = [];
  let sum = 0;

  model.forEach(p => {
    sum += p;
    cumulative.push(sum);
  });

  const counts = new Array(model.length).fill(0);

  for (let i = 0; i < n; i++) {
    const r = random() * sum;
    let k = cumulative.findIndex(c => r < c);

    if (k < 0) {
      k = model.length - 1;
    }

    counts[k] += 1;
  }

  return counts.map(c => c / n);
}

export default function mountCollapse(figure) {
  const { body } = frame(figure, 'Training on generated data, generation after generation');
  const truth = original();
  let model = truth.slice();
  let generation = 0;
  let sizeIndex = 2;
  let history;

  const stage = el('div', { class: 'vz-stage', style: 'background:#fff' });
  const view = createCanvas(stage, {
    aspect: 0.36,
    minHeight: 170,
    maxHeight: 260,
    label: 'Column chart of the probability of each of 20 categories in the current model, with the original distribution as outlines.',
    onResize: () => draw(),
  });

  const stats = { generation: stat('Generation'), alive: stat('Categories left'), distance: stat('Distance from the original') };
  const chart = lineChart(null, {
    series: [{ name: 'categories left', color: COLORS.violet }],
    height: 140,
    xLabel: 'generation',
    yMin: 0,
    yMax: CATEGORIES,
    yFormat: v => fmt(v, 0),
    integer: true,
    label: 'Line chart of the number of categories that still have a positive probability, by generation.',
  });

  const loop = createLoop(figure, (() => {
    let budget = 0;

    return dt => {
      budget += dt / 1000 * 6;

      while (budget >= 1 && generation < MAX_GENERATIONS) {
        budget -= 1;
        step();
      }

      draw();
      return generation < MAX_GENERATIONS;
    };
  })());

  const sizeControl = slider({
    label: 'Samples per generation',
    min: 0,
    max: SAMPLE_SIZES.length - 1,
    value: sizeIndex,
    format: i => String(SAMPLE_SIZES[i]),
    onInput: i => { sizeIndex = i; reset(); },
    width: '8rem',
  });

  body.append(
    el('div', { class: 'vz-controls' }, sizeControl.node),
    stage,
    legend([
      { color: COLORS.blue, label: 'Current model' },
      { style: `background:#fff;box-shadow:inset 0 0 0 1.5px ${COLORS.ink}`, label: 'Original data' },
    ]),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        button('Next generation', () => { loop.stop(); step(); draw(); }, { primary: true }),
        playButton(loop, { play: 'Run', pause: 'Pause' }),
        button('Reset', () => { loop.stop(); reset(); }))),
    el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
    chart.node
  );

  function step() {
    model = nextGeneration(model, SAMPLE_SIZES[sizeIndex]);
    generation += 1;
    history.xs.push(generation);
    history.ys.push(model.filter(p => p > 0).length);
  }

  function reset() {
    model = truth.slice();
    generation = 0;
    history = { xs: [0], ys: [CATEGORIES] };
    draw();
  }

  function draw() {
    const { ctx, width, height } = view;

    if (width) {
      const pad = { left: 30, right: 6, top: 10, bottom: 20 };
      const slot = (width - pad.left - pad.right) / CATEGORIES;
      const bar = Math.min(24, slot - 4);
      const max = Math.max(truth[0], ...model) * 1.05;
      const y = p => height - pad.bottom - (p / max) * (height - pad.top - pad.bottom);

      ctx.clearRect(0, 0, width, height);
      ctx.font = '10px "Inter Variable", system-ui, sans-serif';
      ctx.fillStyle = COLORS.muted;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';

      const tickStep = max > 0.5 ? 0.2 : 0.1;
      const ticks = Array.from({ length: Math.floor(max / tickStep) + 1 }, (v, i) => Math.round(i * tickStep * 10) / 10);

      ticks.forEach(t => {
        ctx.strokeStyle = t ? COLORS.grid : COLORS.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, Math.round(y(t)) + 0.5);
        ctx.lineTo(width - pad.right, Math.round(y(t)) + 0.5);
        ctx.stroke();
        ctx.fillText(fmt(t, 1), pad.left - 5, y(t));
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('most common → rarest category', (pad.left + width - pad.right) / 2, height - pad.bottom + 5);

      model.forEach((p, k) => {
        const x = pad.left + k * slot + (slot - bar) / 2;

        if (p > 0) {
          ctx.fillStyle = COLORS.blue;
          roundTop(ctx, x, y(p), bar, y(0) - y(p), Math.min(4, bar / 2));
        }

        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y(truth[k]), bar - 1.5, y(0) - y(truth[k]));
      });
    }

    const alive = model.filter(p => p > 0).length;
    const distance = 0.5 * model.reduce((sum, p, k) => sum + Math.abs(p - truth[k]), 0);

    stats.generation.set(String(generation));
    stats.alive.set(`${alive} of ${CATEGORIES}`);
    stats.distance.set(fmt(distance, 3));
    chart.setData(history.xs, [history.ys]);
  }

  reset();
}

function roundTop(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h);

  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}
