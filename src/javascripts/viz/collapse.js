import {
  COLORS, button, createCanvas, createLoop, el, fmt, frame, legend, lineChart, playButton, slider, stat,
} from './lib';

const CATEGORIES = 20;
const SAMPLE_SIZES = [25, 50, 100, 200, 500, 1000];
const REAL_SHARES = [0, 0.05, 0.1, 0.25, 0.5];
const MAX_GENERATIONS = 200;

// A long-tailed distribution over 20 categories (Zipf-like, p_k proportional to 1 / k^1.2).
function original() {
  const weights = Array.from({ length: CATEGORIES }, (v, k) => 1 / (k + 1) ** 1.2);
  const total = weights.reduce((a, b) => a + b, 0);

  return weights.map(w => w / total);
}

// Adds n samples drawn from the distribution dist to counts.
function sample(dist, n, counts, random) {
  const cumulative = [];
  let sum = 0;

  dist.forEach(p => {
    sum += p;
    cumulative.push(sum);
  });

  for (let i = 0; i < n; i++) {
    const r = random() * sum;
    let k = cumulative.findIndex(c => r < c);

    if (k < 0) {
      k = dist.length - 1;
    }

    counts[k] += 1;
  }
}

// One generation: draw n samples and fit the next model to them, here simply the observed frequencies
// (the maximum-likelihood estimate). The samples come from the current model, except for a share of
// fresh real data drawn from the original distribution. Without real data, a category that gets no
// samples has probability 0 from then on.
export function nextGeneration(model, n, random = Math.random, real = null, share = 0) {
  const fresh = real ? Math.round(n * share) : 0;
  const counts = new Array(model.length).fill(0);

  sample(model, n - fresh, counts, random);
  sample(real || model, fresh, counts, random);

  return counts.map(c => c / n);
}

export default function mountCollapse(figure) {
  const { body } = frame(figure, 'Training on generated data, generation after generation');
  const truth = original();
  let model = truth.slice();
  let generation = 0;
  let sizeIndex = 2;
  let shareIndex = 0;
  let history;

  const stage = el('div', { class: 'vz-stage', style: 'background:var(--surface)' });
  const view = createCanvas(stage, {
    aspect: 0.36,
    minHeight: 170,
    maxHeight: 260,
    label: 'Column chart of the probability of each of 20 categories in the current model, with the original distribution as outlines.',
    onResize: () => draw(),
  });

  const stats = { generation: stat('Generation'), alive: stat('Categories left'), distance: stat('Total variation distance') };
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

  // A run ends after MAX_GENERATIONS, or earlier when one category has all the probability and no real
  // data comes in, because then nothing can change any more.
  const finished = () => generation >= MAX_GENERATIONS || (REAL_SHARES[shareIndex] === 0 && model.includes(1));

  const loop = createLoop(figure, (() => {
    let budget = 0;

    return dt => {
      budget += dt / 1000 * 6;

      while (budget >= 1 && !finished()) {
        budget -= 1;
        step();
      }

      draw();
      return !finished();
    };
  })());

  // Run after the end of a run starts a new one (it used to do nothing).
  loop.onChange(running => {
    if (running && finished()) {
      reset();
    }
  });

  const sizeControl = slider({
    label: 'Samples per generation',
    min: 0,
    max: SAMPLE_SIZES.length - 1,
    value: sizeIndex,
    format: i => String(SAMPLE_SIZES[i]),
    onInput: i => { sizeIndex = i; reset(); },
    width: '8rem',
  });

  const shareControl = slider({
    label: 'Fresh real data',
    min: 0,
    max: REAL_SHARES.length - 1,
    value: shareIndex,
    format: i => `${Math.round(REAL_SHARES[i] * 100)} %`,
    onInput: i => { shareIndex = i; reset(); },
    width: '7rem',
  });

  body.append(
    el('div', { class: 'vz-controls' }, sizeControl.node, shareControl.node),
    stage,
    legend([
      { color: COLORS.blue, label: 'Current model' },
      { style: `background:var(--surface);box-shadow:inset 0 0 0 1.5px ${COLORS.ink}`, label: 'Original data' },
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
    model = nextGeneration(model, SAMPLE_SIZES[sizeIndex], Math.random, truth, REAL_SHARES[shareIndex]);
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
