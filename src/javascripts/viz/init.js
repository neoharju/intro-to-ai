// Week 4, "Why the starting weights matter": the network of the numerical backward pass with three hidden ReLU
// units, trained on five points of y = |x| from three starts (all 0, all 0.5, random). The plot shows the
// function of the network and what each unit adds to it, the table every parameter with its gradient, the note
// why the parameters move as they do, and the chart how one parameter of each unit, and the output bias c,
// change during training. From all 0 only c moves: it is what lifts the flat line. The mathematics is in
// init-core.js.
import {
  CLASS_COLORS, COLORS, button, clamp, createCanvas, createLoop, createRandom, dot, el, fmt, frame, legend,
  lineChart, playButton, prefersReducedMotion, segmented, stat,
} from './lib';
import { POINTS, UNITS, createNetwork, identicalUnits, lossAndGradient, predict, step } from './init-core';

const RATE = 0.1;
const STEPS_PER_SECOND = 40;
const MAX_STEPS = 400;
const X_RANGE = [-2.5, 2.5];
const Y_RANGE = [-1, 3];
const KEYS = ['w', 'b', 'v'];
const UNIT_INDICES = [...Array(UNITS).keys()];

const MEAN_TARGET = POINTS.reduce((sum, { y }) => sum + y, 0) / POINTS.length;

// Read when drawn, so that the colours follow the colour theme.
const unitColor = j => CLASS_COLORS[j];
const swatch = j => el('i', {
  'aria-hidden': 'true',
  style: `display:inline-block;width:.7rem;height:.7rem;margin-right:.45rem;border-radius:.2rem;background:${unitColor(j)}`,
});

// A table cell with a parameter and, under it, its gradient: "∇ 0" when the gradient is exactly 0 (the
// parameter cannot move), "∇ 0.000" when it only rounds to 0.
function parameterCell() {
  const value = el('span');
  const gradient = el('span', { style: 'display:block;font-size:.6875rem;font-weight:500;color:var(--muted)' });

  return {
    node: el('td', {}, value, gradient),
    set(parameter, slope) {
      value.textContent = fmt(parameter, 3);
      gradient.textContent = `∇ ${slope === 0 ? '0' : fmt(slope, 3)}`;
    },
  };
}

export default function mountInit(figure) {
  const { body } = frame(figure, 'Three hidden units, three ways to start');
  let start = 'zero';
  let seed = 1;
  let net;
  let steps = 0;
  let owed = 0;
  let shown = 'v';
  let history;

  const stage = el('div', { class: 'vz-stage' });
  const plot = createCanvas(stage, {
    aspect: 0.62,
    minHeight: 190,
    maxHeight: 340,
    label: 'The five training points of y = |x|, the function that the network computes, and the part that each of the three hidden units adds to it.',
    onResize: () => draw(),
  });

  // The parameters with their gradients: one row per hidden unit, and the output bias c below them.
  const cells = UNIT_INDICES.map(() => Object.fromEntries(KEYS.map(key => [key, parameterCell()])));
  const biasCell = parameterCell();
  const table = el('table', { class: 'vz-table', style: 'margin-top:0' },
    el('caption', { class: 'visually-hidden' }, 'The parameters of the three hidden units and the output bias c, each with its gradient'),
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col' }, 'Hidden unit'),
      KEYS.map(key => el('th', { scope: 'col', class: 'is-math' }, key)))),
    el('tbody', {}, UNIT_INDICES.map(j => el('tr', {},
      el('th', { scope: 'row' }, swatch(j), `Unit ${j + 1}`),
      KEYS.map(key => cells[j][key].node)))),
    el('tfoot', {}, el('tr', {}, el('td', { colspan: KEYS.length }, 'Output bias c'), biasCell.node)));

  const readout = el('p', { class: 'vz-note' });
  const stats = { steps: stat('Steps'), loss: stat('Loss') };

  const chart = lineChart(null, {
    series: [
      ...UNIT_INDICES.map(j => ({ name: `unit ${j + 1}`, get color() { return unitColor(j); } })),
      { name: 'output bias c', get color() { return COLORS.violet; } },
    ],
    height: 150,
    xLabel: 'steps',
    label: 'Line chart of one parameter of each of the three hidden units, and of the output bias c, against the number of gradient descent steps.',
  });

  const loop = createLoop(figure, dt => {
    owed += prefersReducedMotion() ? MAX_STEPS : (dt * STEPS_PER_SECOND) / 1000;

    for (; owed >= 1 && steps < MAX_STEPS; owed -= 1) {
      advance();
    }

    draw();

    return steps < MAX_STEPS;
  });

  // Training again after the last step starts from the beginning.
  loop.onChange(running => {
    if (running && steps >= MAX_STEPS) {
      reset();
    }
  });

  const startControl = segmented([
    { value: 'zero', label: 'all 0' },
    { value: 'equal', label: 'all 0.5' },
    { value: 'random', label: 'random (He)' },
  ], start, value => { start = value; loop.stop(); reset(); }, 'Initial parameters');

  const shownControl = segmented([
    { value: 'w', label: 'input weights w' },
    { value: 'b', label: 'biases b' },
    { value: 'v', label: 'output weights v' },
  ], shown, value => { shown = value; drawChart(); }, 'Parameter shown in the chart');

  body.append(
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' }, el('span', { class: 'vz-label' }, 'Start from'), startControl.node)),
    el('div', { class: 'vz-split' },
      el('div', {}, stage,
        legend([
          { color: COLORS.violet, label: 'network output ŷ' },
          ...UNIT_INDICES.map(j => ({ color: unitColor(j), label: `unit ${j + 1} (dashed)` })),
          { color: COLORS.ink, label: 'training points, y = |x|' },
        ]),
        el('p', { class: 'vz-note' },
          'A dashed line is what one unit adds to ŷ, v · ReLU(wx + b). Units that are copies of each other draw the same line.')),
      el('div', {},
        table,
        el('p', { class: 'vz-note' },
          `Under each value: its gradient ∇. The next step subtracts ${RATE} × ∇, so a parameter whose ∇ is exactly 0 does not move.`),
        el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
        readout)),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' }, el('span', { class: 'vz-label' }, 'Chart'), shownControl.node)),
    chart.node,
    el('p', { class: 'vz-note' }, 'In the colours of the units: the chosen parameter of each unit. Violet: the output bias c.'),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        playButton(loop, { play: 'Train', pause: 'Pause' }),
        button('1 step', () => {
          loop.stop();

          if (steps < MAX_STEPS) {
            advance();
          }

          draw();
        }, { ariaLabel: 'One gradient descent step' }),
        button('Reset', () => { loop.stop(); reset(); })),
      button('New random start', () => {
        loop.stop();
        seed += 1;
        start = 'random';
        startControl.set('random');
        reset();
      })),
  );

  function reset() {
    net = createNetwork(start, createRandom(seed));
    steps = 0;
    owed = 0;
    history = { xs: [0], w: [[...net.w]], b: [[...net.b]], v: [[...net.v]], c: [net.c] };
    draw();
  }

  function advance() {
    step(net, RATE);
    steps += 1;
    history.xs.push(steps);
    KEYS.forEach(key => history[key].push([...net[key]]));
    history.c.push(net.c);
  }

  // Data coordinates -> canvas pixels.
  const pad = { left: 30, right: 10, top: 10, bottom: 24 };
  const sx = x => pad.left + ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * (plot.width - pad.left - pad.right);
  const sy = y => pad.top + (1 - (y - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * (plot.height - pad.top - pad.bottom);

  function curve(ctx, f, color, width, dash) {
    const n = 240;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plot.width - pad.left - pad.right, plot.height - pad.top - pad.bottom);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();

    for (let i = 0; i <= n; i++) {
      const x = X_RANGE[0] + ((X_RANGE[1] - X_RANGE[0]) * i) / n;
      // A point far outside the plot would give the line huge coordinates.
      const y = clamp(f(x), Y_RANGE[0] - 10, Y_RANGE[1] + 10);

      if (i) {
        ctx.lineTo(sx(x), sy(y));
      } else {
        ctx.moveTo(sx(x), sy(y));
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawPlot() {
    const { ctx, width, height } = plot;

    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px "Inter Variable", system-ui, sans-serif';
    ctx.lineWidth = 1;

    for (let x = -2; x <= 2; x++) {
      const px = Math.round(sx(x)) + 0.5;

      ctx.strokeStyle = x ? COLORS.grid : COLORS.axis;
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, height - pad.bottom);
      ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(fmt(x, 0), sx(x), height - pad.bottom + 6);
    }

    for (let y = Y_RANGE[0]; y <= Y_RANGE[1]; y++) {
      const py = Math.round(sy(y)) + 0.5;

      ctx.strokeStyle = y ? COLORS.grid : COLORS.axis;
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(width - pad.right, py);
      ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(y, 0), pad.left - 8, sy(y));
    }

    // In the order of the chart: when the units are copies, the line of the last unit is the one on top in both.
    UNIT_INDICES.forEach(j => {
      curve(ctx, x => net.v[j] * Math.max(0, net.w[j] * x + net.b[j]), unitColor(j), 2, [6, 5]);
    });

    curve(ctx, x => predict(net, x), COLORS.violet, 3, []);
    POINTS.forEach(({ x, y }) => dot(ctx, sx(x), sy(y), 4.5, COLORS.ink));
  }

  // The values, and what the gradient at the current parameters (the next step) does to them.
  function drawNumbers() {
    const { loss, grad } = lossAndGradient(net);
    // A unit that is 0 at every training point (wx + b ≤ 0 there) gets no gradient through ReLU.
    const still = UNIT_INDICES.filter(j => POINTS.every(({ x }) => net.w[j] * x + net.b[j] <= 0));

    UNIT_INDICES.forEach(j => KEYS.forEach(key => cells[j][key].set(net[key][j], grad[key][j])));
    biasCell.set(net.c, grad.c);
    stats.steps.set(String(steps));
    stats.loss.set(fmt(loss, 4));

    if (KEYS.every(key => net[key].every(value => value === 0))) {
      readout.textContent = 'Every gradient of the hidden units is exactly 0: ∂L/∂v has the factor h = ReLU(0) = 0, and '
        + '∂L/∂w and ∂L/∂b have the factor v = 0. So w, b and v cannot move. Only c learns, and it moves the flat line '
        + `up to ${fmt(MEAN_TARGET, 1)}, the mean of the targets (∂L/∂c = ${fmt(grad.c, 3)}).`;
    } else if (identicalUnits(net)) {
      readout.textContent = `The three units get the same gradients (∂L/∂w = ${fmt(grad.w[0], 3)}, `
        + `∂L/∂b = ${fmt(grad.b[0], 3)} and ∂L/∂v = ${fmt(grad.v[0], 3)} each), so they stay copies of each other.`;
    } else if (still.length) {
      const names = still.map(j => `unit ${j + 1}`).join(' and ');

      readout.textContent = `The units get different gradients, but ${names} ${still.length > 1 ? 'are' : 'is'} 0 at every `
        + `training point: ReLU passes no gradient there, so ${still.length > 1 ? 'they have' : 'it has'} stopped learning.`;
    } else {
      readout.textContent = 'The units get different gradients, so they can learn different parts of the function.';
    }
  }

  function drawChart() {
    chart.setData(history.xs, [...UNIT_INDICES.map(j => history[shown].map(values => values[j])), history.c]);
  }

  function draw() {
    if (!plot.width || !net) {
      return;
    }

    drawPlot();
    drawNumbers();
    drawChart();
  }

  reset();
}
