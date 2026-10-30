import {
  CLASS_COLORS, COLORS, button, createCanvas, createLoop, createRandom, el, fmt, frame, legend,
  lineChart, marker, playButton, pointerPosition, rgbOf, segmented, select, slider, stat,
} from './lib';

const X_RANGE = [-1, 1];
const Y_RANGE = [-0.6, 0.6];
const ITERATIONS_PER_FRAME = 2;

const sigmoid = z => 1 / (1 + Math.exp(-z));

function makeData(seed) {
  const random = createRandom(seed);
  const points = [];
  const centres = [[-0.32, -0.18], [0.3, 0.22]];

  for (let label = 0; label < 2; label++) {
    for (let i = 0; i < 36; i++) {
      points.push({
        x: Math.max(-0.97, Math.min(0.97, centres[label][0] + 0.3 * random.normal())),
        y: Math.max(-0.57, Math.min(0.57, centres[label][1] + 0.22 * random.normal())),
        label,
      });
    }
  }

  return points;
}

// Mean log-loss (cross-entropy) and its gradient for p = sigmoid(w1 x + w2 y + w0).
export function lossAndGradient(points, w) {
  let loss = 0;
  const grad = [0, 0, 0];

  points.forEach(({ x, y, label }) => {
    const p = sigmoid(w[0] * x + w[1] * y + w[2]);
    const e = p - label;

    // log(1 + exp(-z)) terms, written to avoid log(0).
    const z = w[0] * x + w[1] * y + w[2];

    loss += label ? Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z));
    grad[0] += e * x;
    grad[1] += e * y;
    grad[2] += e;
  });

  const n = points.length || 1;

  return { loss: loss / n, grad: grad.map(g => g / n) };
}

export default function mountLogisticRegression(figure) {
  const { body } = frame(figure, 'Logistic regression and the decision threshold');
  let seed = 3;
  let points = makeData(seed);
  let w = [0, 0, 0];
  let rate = 1;
  let threshold = 0.5;
  let addLabel = 1;
  let iterations = 0;
  let history = { xs: [], ys: [] };

  const stage = el('div', { class: 'vz-stage vz-stage--draw' });
  const view = createCanvas(stage, {
    aspect: (Y_RANGE[1] - Y_RANGE[0]) / (X_RANGE[1] - X_RANGE[0]),
    // Large enough bounds that the scale stays the same in x and y (distances look right).
    minHeight: 120,
    maxHeight: 560,
    label: 'Two classes of points in the plane, shaded by the predicted probability of class 1, with the decision line for the chosen threshold.',
    onResize: () => draw(),
  });

  const loop = createLoop(figure, () => {
    for (let i = 0; i < ITERATIONS_PER_FRAME; i++) {
      step();
    }

    draw();

    return iterations < 5000;
  });

  const thresholdControl = slider({
    label: 'Threshold t',
    min: 0.05,
    max: 0.95,
    step: 0.05,
    value: threshold,
    format: v => fmt(v, 2),
    onInput: v => { threshold = v; draw(); },
    width: '8rem',
  });

  const stats = {
    iterations: stat('Iterations'),
    loss: stat('Mean log-loss'),
    accuracy: stat('Accuracy at t'),
    positives: stat('Predicted class 1'),
  };

  const formula = el('p', { class: 'vz-math', style: 'margin:.75rem 0 0' });

  const chart = lineChart(null, {
    series: [{ name: 'mean log-loss', color: COLORS.violet }],
    height: 150,
    xLabel: 'iterations',
    yMin: 0,
    yFormat: v => fmt(v, 2),
    label: 'Line chart of the mean log-loss against the number of gradient descent iterations.',
  });

  body.append(
    stage,
    legend([
      { color: CLASS_COLORS[0], label: 'Class 0 (circles)' },
      { color: CLASS_COLORS[1], label: 'Class 1 (squares)' },
      { style: `background:linear-gradient(90deg, ${CLASS_COLORS[0]}66, ${COLORS.neutral}, ${CLASS_COLORS[1]}66)`, label: 'Shading: predicted p from 0 to 1' },
      { color: COLORS.ink, label: 'Decision line: p = t' },
    ]),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        playButton(loop, { play: 'Train', pause: 'Pause' }),
        button('1 step', () => { loop.stop(); step(); draw(); }, { ariaLabel: 'One gradient descent step' }),
        button('Reset weights', () => { loop.stop(); resetWeights(); })),
      el('label', { class: 'vz-group' }, el('span', { class: 'vz-label' }, 'Learning rate'),
        select([0.1, 0.3, 1, 3].map(v => ({ value: String(v), label: String(v) })), String(rate), v => { rate = Number(v); }, 'Learning rate')),
      thresholdControl.node),
    el('div', { class: 'vz-controls' },
      el('span', { class: 'vz-label' }, 'Click to add'),
      segmented([{ value: 0, label: 'Class 0' }, { value: 1, label: 'Class 1' }], addLabel, v => { addLabel = v; }, 'Class of new points').node,
      button('New data', () => { loop.stop(); seed += 1; points = makeData(seed); resetWeights(); })),
    el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
    formula,
    chart.node
  );

  function step() {
    const { loss, grad } = lossAndGradient(points, w);

    if (iterations === 0) {
      history.xs.push(0);
      history.ys.push(loss);
    }

    w = w.map((v, i) => v - rate * grad[i]);
    iterations += 1;
    history.xs.push(iterations);
    history.ys.push(lossAndGradient(points, w).loss);
  }

  function resetWeights() {
    w = [0, 0, 0];
    iterations = 0;
    history = { xs: [], ys: [] };
    draw();
  }

  // Data coordinates <-> canvas pixels.
  const sx = x => ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * view.width;
  const sy = y => (1 - (y - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * view.height;
  const dx = px => X_RANGE[0] + (px / view.width) * (X_RANGE[1] - X_RANGE[0]);
  const dy = py => Y_RANGE[0] + (1 - py / view.height) * (Y_RANGE[1] - Y_RANGE[0]);

  // The probability shading is computed on a coarse grid and scaled up.
  const shade = document.createElement('canvas');
  const shadeCtx = shade.getContext('2d');

  function drawShading(ctx, width, height) {
    const cols = Math.ceil(width / 6);
    const rows = Math.ceil(height / 6);

    shade.width = cols;
    shade.height = rows;

    const image = shadeCtx.createImageData(cols, rows);
    // Read at every draw, so that the shading follows the colour theme.
    const blue = rgbOf(COLORS.blue);
    const orange = rgbOf(COLORS.orange);
    const neutral = rgbOf(COLORS.neutral);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = dx(((i + 0.5) / cols) * width);
        const y = dy(((j + 0.5) / rows) * height);
        const p = sigmoid(w[0] * x + w[1] * y + w[2]);
        const t = Math.abs(2 * p - 1);
        const pole = p < 0.5 ? blue : orange;
        const k = 4 * (j * cols + i);

        for (let c = 0; c < 3; c++) {
          image.data[k + c] = Math.round(neutral[c] + (pole[c] - neutral[c]) * t * 0.42);
        }

        image.data[k + 3] = 255;
      }
    }

    shadeCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shade, 0, 0, width, height);
  }

  function draw() {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    drawShading(ctx, width, height);

    // Decision line: w1 x + w2 y + w0 = log(t / (1 - t)).
    const logit = Math.log(threshold / (1 - threshold));
    const [a, b, c] = w;

    if (Math.hypot(a, b) > 1e-9) {
      const ends = [];

      if (Math.abs(b) > 1e-9) {
        [X_RANGE[0], X_RANGE[1]].forEach(x => ends.push([x, (logit - c - a * x) / b]));
      }

      if (Math.abs(a) > 1e-9) {
        [Y_RANGE[0], Y_RANGE[1]].forEach(y => ends.push([(logit - c - b * y) / a, y]));
      }

      const inside = ends.filter(([x, y]) => x >= X_RANGE[0] - 1e-9 && x <= X_RANGE[1] + 1e-9 && y >= Y_RANGE[0] - 1e-9 && y <= Y_RANGE[1] + 1e-9);

      if (inside.length >= 2) {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx(inside[0][0]), sy(inside[0][1]));
        ctx.lineTo(sx(inside[1][0]), sy(inside[1][1]));
        ctx.stroke();
      }
    }

    let correct = 0;
    let predictedPositive = 0;

    points.forEach(point => {
      const p = sigmoid(a * point.x + b * point.y + c);
      const predicted = p >= threshold ? 1 : 0;
      const px = sx(point.x);
      const py = sy(point.y);

      predictedPositive += predicted;

      if (predicted === point.label) {
        correct += 1;
      } else {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      marker(ctx, point.label, px, py, 4.5, CLASS_COLORS[point.label]);
    });

    const { loss } = lossAndGradient(points, w);

    stats.iterations.set(String(iterations));
    stats.loss.set(fmt(loss, 3));
    stats.accuracy.set(`${fmt((100 * correct) / points.length, 0)}%`);
    stats.positives.set(`${predictedPositive} of ${points.length}`);

    formula.textContent = `p = σ(w₁x₁ + w₂x₂ + w₀) with w₁ = ${fmt(a, 2)}, w₂ = ${fmt(b, 2)}, w₀ = ${fmt(c, 2)}. `
      + `Decision line: w₁x₁ + w₂x₂ + w₀ = log(t / (1 − t)) = ${fmt(logit, 2)}. Ringed points are misclassified at t = ${fmt(threshold, 2)}.`;

    chart.setData(history.xs, [history.ys]);
  }

  view.canvas.addEventListener('pointerdown', event => {
    const { x, y } = pointerPosition(view.canvas, event);

    points.push({ x: dx(x), y: dy(y), label: addLabel });
    draw();
  });

  draw();
}
