import { accuracy, adamStep, createNetwork, forward, lossAndGradient } from './mlp-core';
import {
  CLASS_COLORS, COLORS, button, checkbox, createCanvas, createLoop, createRandom, el, fmt, frame, legend,
  lineChart, marker, playButton, rgbOf, segmented, select, slider, stat, withAlpha,
} from './lib';

const RANGE = 1.15;
const EPOCHS_PER_FRAME = 4;
const MAX_EPOCHS = 4000;
const RATE = 0.03;

function makeData(kind, seed) {
  const random = createRandom(seed);
  const points = [];

  if (kind === 'xor') {
    [[-0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 1], [0.5, -0.5, 1]].forEach(([cx, cy, label]) => {
      for (let i = 0; i < 25; i++) {
        points.push({ x: cx + 0.18 * random.normal(), y: cy + 0.18 * random.normal(), label });
      }
    });
  } else if (kind === 'circle') {
    for (let i = 0; i < 100; i++) {
      const inner = i % 2 === 0;
      const r = inner ? 0.35 * Math.sqrt(random()) : 0.62 + 0.3 * random();
      const a = 2 * Math.PI * random();

      points.push({ x: r * Math.cos(a), y: r * Math.sin(a), label: inner ? 1 : 0 });
    }
  } else {
    // Two interleaved half-moons.
    for (let i = 0; i < 100; i++) {
      const upper = i % 2 === 0;
      const a = Math.PI * random();
      const x = upper ? Math.cos(a) - 0.5 : 0.5 - Math.cos(a);
      const y = upper ? Math.sin(a) - 0.25 : 0.25 - Math.sin(a);

      points.push({ x: 0.8 * x + 0.06 * random.normal(), y: 0.8 * y + 0.06 * random.normal(), label: upper ? 1 : 0 });
    }
  }

  return points;
}

export default function mountMlp(figure) {
  const { body } = frame(figure, 'Training a small neural network');
  let kind = 'xor';
  let hidden = 4;
  let activation = 'tanh';
  let showUnits = false;
  let seed = 1;
  let points = makeData(kind, 3);
  let net;
  let epoch = 0;
  let history;

  const stage = el('div', { class: 'vz-stage' });
  const view = createCanvas(stage, {
    aspect: 0.62,
    minHeight: 200,
    maxHeight: 400,
    label: 'Training points of two classes and the predicted probability of the network over the plane.',
    onResize: () => draw(),
  });

  const stats = { epoch: stat('Epochs'), loss: stat('Training loss'), accuracy: stat('Training accuracy') };
  const chart = lineChart(null, {
    series: [{ name: 'cross-entropy loss', color: COLORS.violet }],
    height: 140,
    xLabel: 'epochs',
    yMin: 0,
    label: 'Line chart of the training loss against the number of epochs.',
  });

  const loop = createLoop(figure, () => {
    for (let i = 0; i < EPOCHS_PER_FRAME; i++) {
      train();
    }

    draw();
    return epoch < MAX_EPOCHS;
  });

  const hiddenControl = slider({
    label: 'Hidden units',
    min: 1,
    max: 8,
    value: hidden,
    onInput: v => { hidden = v; reset(); },
    width: '6rem',
  });

  body.append(
    el('div', { class: 'vz-controls' },
      el('label', { class: 'vz-group' }, el('span', { class: 'vz-label' }, 'Data'),
        select([
          { value: 'xor', label: 'XOR' },
          { value: 'circle', label: 'Circle' },
          { value: 'moons', label: 'Two moons' },
        ], kind, value => { kind = value; points = makeData(kind, 3); reset(); }, 'Data set')),
      hiddenControl.node,
      segmented([
        { value: 'relu', label: 'ReLU' },
        { value: 'tanh', label: 'tanh' },
        { value: 'sigmoid', label: 'sigmoid' },
      ], activation, value => { activation = value; reset(); }, 'Activation function').node),
    el('div', { class: 'vz-split' },
      el('div', {}, stage,
        legend([
          { color: CLASS_COLORS[0], label: 'Class 0 (circles)' },
          { color: CLASS_COLORS[1], label: 'Class 1 (squares)' },
          { style: `background:linear-gradient(90deg, ${CLASS_COLORS[0]}66, ${COLORS.neutral}, ${CLASS_COLORS[1]}66)`, label: 'Predicted p' },
        ])),
      el('div', {},
        el('div', { class: 'vz-stats', style: 'margin-top:0' }, Object.values(stats).map(s => s.node)),
        chart.node,
        el('p', { class: 'vz-note' },
          `Each epoch is a forward pass over all points, the cross-entropy loss, backpropagation and one Adam step (learning rate ${RATE}).`))),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        playButton(loop, { play: 'Train', pause: 'Pause' }),
        button('New initial weights', () => { loop.stop(); seed += 1; reset(); })),
      checkbox('Show the line of each hidden unit', showUnits, value => { showUnits = value; draw(); }).node)
  );

  function reset() {
    loop.stop();
    net = createNetwork(hidden, activation, createRandom(1000 + seed * 31 + hidden));
    epoch = 0;
    history = { xs: [0], ys: [lossAndGradient(net, points).loss] };
    draw();
  }

  function train() {
    const { grad } = lossAndGradient(net, points);

    adamStep(net, grad, RATE);
    epoch += 1;

    if (epoch % 10 === 0) {
      history.xs.push(epoch);
      history.ys.push(lossAndGradient(net, points).loss);
    }
  }

  const scale = () => view.height / 2 / RANGE;
  const sx = x => view.width / 2 + x * scale();
  const sy = y => view.height / 2 - y * scale();
  const shade = document.createElement('canvas');

  function draw() {
    const { ctx, width, height } = view;

    if (!width || !net) {
      return;
    }

    const cols = Math.ceil(width / 5);
    const rows = Math.ceil(height / 5);
    const shadeCtx = shade.getContext('2d');

    shade.width = cols;
    shade.height = rows;

    const image = shadeCtx.createImageData(cols, rows);
    // Read at every draw, so that the shading follows the colour theme.
    const blue = rgbOf(COLORS.blue);
    const orange = rgbOf(COLORS.orange);
    const neutral = rgbOf(COLORS.neutral);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (((i + 0.5) / cols) * width - width / 2) / scale();
        const y = (height / 2 - ((j + 0.5) / rows) * height) / scale();
        const p = forward(net, x, y);
        const t = Math.abs(2 * p - 1);
        const pole = p < 0.5 ? blue : orange;
        const k = 4 * (j * cols + i);

        for (let c = 0; c < 3; c++) {
          image.data[k + c] = Math.round(neutral[c] + (pole[c] - neutral[c]) * t * 0.45);
        }

        image.data[k + 3] = 255;
      }
    }

    shadeCtx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shade, 0, 0, width, height);

    if (showUnits) {
      // Hidden unit j changes sign along W1[j] · x + b1[j] = 0.
      ctx.strokeStyle = withAlpha(COLORS.ink, 0.45);
      ctx.lineWidth = 1;

      for (let j = 0; j < hidden; j++) {
        const a = net.params[2 * j];
        const b = net.params[2 * j + 1];
        const c = net.params[2 * hidden + j];
        const norm = Math.hypot(a, b);

        if (norm < 1e-9) {
          continue;
        }

        const foot = [(-c * a) / (norm * norm), (-c * b) / (norm * norm)];
        const along = [-b / norm, a / norm];

        ctx.beginPath();
        ctx.moveTo(sx(foot[0] - along[0] * 5), sy(foot[1] - along[1] * 5));
        ctx.lineTo(sx(foot[0] + along[0] * 5), sy(foot[1] + along[1] * 5));
        ctx.stroke();
      }
    }

    points.forEach(point => marker(ctx, point.label, sx(point.x), sy(point.y), 4, CLASS_COLORS[point.label]));

    stats.epoch.set(String(epoch));
    stats.loss.set(fmt(history.ys[history.ys.length - 1], 3));
    stats.accuracy.set(`${fmt(100 * accuracy(net, points), 0)}%`);
    chart.setData(history.xs, [history.ys]);
  }

  reset();
}
