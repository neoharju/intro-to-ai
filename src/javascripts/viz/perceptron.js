import {
  CLASS_COLORS, COLORS, button, createCanvas, createLoop, createRandom, el, fmt, frame, legend, marker,
  playButton, segmented, stat, withAlpha,
} from './lib';

const RANGE = 1.2;
const MAX_EPOCHS = 30;

// Labels are -1 and +1, as in the perceptron rule.
export function makeData(kind, margin = 0.08, count = 36) {
  const random = createRandom(kind === 'xor' ? 17 : 8);
  const points = [];

  if (kind === 'xor') {
    [[-0.55, -0.55, -1], [0.55, 0.55, -1], [-0.55, 0.55, 1], [0.55, -0.55, 1]].forEach(([cx, cy, label]) => {
      for (let i = 0; i < 8; i++) {
        points.push({ x: cx + 0.16 * random.normal(), y: cy + 0.16 * random.normal(), label });
      }
    });
  } else {
    // Two groups on either side of the line x + 0.6 y = 0.1, at least `margin` away from it.
    while (points.length < count) {
      const x = -1 + 2 * random();
      const y = -1 + 2 * random();
      const side = x + 0.6 * y - 0.1;

      if (Math.abs(side) > margin * Math.hypot(1, 0.6)) {
        points.push({ x, y, label: side > 0 ? 1 : -1 });
      }
    }
  }

  // A fixed order in which the examples are visited in every epoch.
  for (let i = points.length - 1; i > 0; i--) {
    const j = random.int(i + 1);

    [points[i], points[j]] = [points[j], points[i]];
  }

  return points;
}

export function predict(w, b, point) {
  return w[0] * point.x + w[1] * point.y + b > 0 ? 1 : -1;
}

export default function mountPerceptron(figure) {
  const { body } = frame(figure, 'The perceptron learning rule');
  let kind = 'separable';
  let points = makeData(kind);
  let w = [0, 0];
  let b = 0;
  let index = 0;
  let epoch = 0;
  let mistakesThisEpoch = 0;
  let mistakes = [];
  let last = null;
  let done = false;

  const stage = el('div', { class: 'vz-stage' });
  const view = createCanvas(stage, {
    aspect: 0.62,
    minHeight: 200,
    maxHeight: 420,
    label: 'Training points of two classes, the current decision line of the perceptron and the example being processed.',
    onResize: () => draw(),
  });

  const barStage = el('div', { class: 'vz-stage', style: 'margin-top:.75rem;padding:.25rem .4rem' });
  const bars = createCanvas(barStage, { aspect: 0.25, minHeight: 110, maxHeight: 140, label: 'Column chart of the number of mistakes in each epoch.', onResize: () => drawBars() });
  const explanation = el('p', { class: 'vz-math', style: 'margin:0', 'aria-live': 'polite' });
  const status = el('p', { class: 'vz-narration', style: 'margin:.5rem 0 0' });
  const stats = { epoch: stat('Epoch'), mistakes: stat('Mistakes this epoch'), weights: stat('w'), bias: stat('b') };

  const loop = createLoop(figure, () => {
    for (let i = 0; i < 2 && !done; i++) {
      step();
    }

    draw();
    return !done;
  });

  body.append(
    el('div', { class: 'vz-controls' },
      segmented([
        { value: 'separable', label: 'Linearly separable' },
        { value: 'xor', label: 'XOR' },
      ], kind, value => { kind = value; points = makeData(kind); reset(); }, 'Data set').node),
    el('div', { class: 'vz-split' },
      el('div', {}, stage,
        legend([
          { color: CLASS_COLORS[0], label: 'y = −1 (circles)' },
          { color: CLASS_COLORS[1], label: 'y = +1 (squares)' },
          { color: COLORS.ink, label: 'Decision line w·x + b = 0, arrow = w' },
        ])),
      el('div', {},
        el('div', { class: 'vz-panel' }, el('h5', {}, 'Last update'), explanation, status),
        el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
        barStage)),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        button('Step', () => { loop.stop(); step(); draw(); }, { ariaLabel: 'Process the next example' }),
        button('Epoch', () => {
          loop.stop();
          const target = epoch + 1;

          while (!done && epoch < target) {
            step();
          }

          draw();
        }, { ariaLabel: 'Process a whole pass over the examples' }),
        playButton(loop),
        button('Reset', () => { loop.stop(); reset(); })))
  );

  function step() {
    if (done) {
      return;
    }

    const point = points[index];
    const z = w[0] * point.x + w[1] * point.y + b;
    const predicted = z > 0 ? 1 : -1;
    const before = { w: w.slice(), b };

    if (predicted !== point.label) {
      w = [w[0] + point.label * point.x, w[1] + point.label * point.y];
      b += point.label;
      mistakesThisEpoch += 1;
    }

    last = { point, z, predicted, before, after: { w: w.slice(), b } };
    index += 1;

    if (index === points.length) {
      mistakes.push(mistakesThisEpoch);
      epoch += 1;
      index = 0;

      if (mistakesThisEpoch === 0 || epoch >= MAX_EPOCHS) {
        done = true;
      }

      mistakesThisEpoch = 0;
    }
  }

  function reset() {
    w = [0, 0];
    b = 0;
    index = 0;
    epoch = 0;
    mistakesThisEpoch = 0;
    mistakes = [];
    last = null;
    done = false;
    draw();
  }

  const sx = x => view.width / 2 + (x / RANGE) * (view.height / 2);
  const sy = y => view.height / 2 - (y / RANGE) * (view.height / 2);

  function draw() {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const norm = Math.hypot(w[0], w[1]);

    if (norm > 1e-12) {
      // Shade the side predicted +1, then draw the line w·x + b = 0 and the weight vector.
      const unit = [w[0] / norm, w[1] / norm];
      const foot = [-b * unit[0] / norm, -b * unit[1] / norm];
      const far = 10;
      const along = [-unit[1], unit[0]];
      const p1 = [foot[0] + along[0] * far, foot[1] + along[1] * far];
      const p2 = [foot[0] - along[0] * far, foot[1] - along[1] * far];

      ctx.fillStyle = withAlpha(CLASS_COLORS[1], 0.09);
      ctx.beginPath();
      ctx.moveTo(sx(p1[0]), sy(p1[1]));
      ctx.lineTo(sx(p2[0]), sy(p2[1]));
      ctx.lineTo(sx(p2[0] + unit[0] * far), sy(p2[1] + unit[1] * far));
      ctx.lineTo(sx(p1[0] + unit[0] * far), sy(p1[1] + unit[1] * far));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = withAlpha(CLASS_COLORS[0], 0.08);
      ctx.beginPath();
      ctx.moveTo(sx(p1[0]), sy(p1[1]));
      ctx.lineTo(sx(p2[0]), sy(p2[1]));
      ctx.lineTo(sx(p2[0] - unit[0] * far), sy(p2[1] - unit[1] * far));
      ctx.lineTo(sx(p1[0] - unit[0] * far), sy(p1[1] - unit[1] * far));
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(p1[0]), sy(p1[1]));
      ctx.lineTo(sx(p2[0]), sy(p2[1]));
      ctx.stroke();

      arrow(ctx, sx(foot[0]), sy(foot[1]), sx(foot[0] + unit[0] * 0.3), sy(foot[1] + unit[1] * 0.3));
    }

    // Axes through the origin.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(sy(0)) + 0.5);
    ctx.lineTo(width, Math.round(sy(0)) + 0.5);
    ctx.moveTo(Math.round(sx(0)) + 0.5, 0);
    ctx.lineTo(Math.round(sx(0)) + 0.5, height);
    ctx.stroke();

    points.forEach(point => {
      const wrong = predict(w, b, point) !== point.label;
      const px = sx(point.x);
      const py = sy(point.y);

      if (wrong) {
        ctx.strokeStyle = withAlpha(COLORS.ink, 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 8.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      marker(ctx, point.label > 0 ? 1 : 0, px, py, 4.5, CLASS_COLORS[point.label > 0 ? 1 : 0]);
    });

    if (last) {
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx(last.point.x), sy(last.point.y), 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    describe();
    drawBars();
  }

  function arrow(ctx, x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 9 * Math.cos(angle - 0.4), y2 - 9 * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - 9 * Math.cos(angle + 0.4), y2 - 9 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  const vec = v => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)})`;
  const sign = v => (v > 0 ? '+1' : '−1');

  function describe() {
    stats.epoch.set(String(epoch + (index > 0 && !done ? 1 : 0)));
    // Between epochs, show the count of the epoch that just ended.
    if (index === 0 && mistakes.length) {
      stats.mistakes.setLabel(`Mistakes in epoch ${mistakes.length}`);
      stats.mistakes.set(String(mistakes[mistakes.length - 1]));
    } else {
      stats.mistakes.setLabel('Mistakes this epoch so far');
      stats.mistakes.set(String(mistakesThisEpoch));
    }
    stats.weights.set(vec(w));
    stats.bias.set(fmt(b, 0));

    if (!last) {
      explanation.textContent = 'w = (0, 0) and b = 0, so every example is first predicted −1. Press Step.';
    } else {
      const { point, z, predicted, before, after } = last;
      const head = `x = ${vec([point.x, point.y])}, y = ${sign(point.label)}: w·x + b = ${fmt(z, 2)}, predicted ${sign(predicted)}`;

      explanation.textContent = predicted === point.label
        ? `${head}. Correct, so nothing changes.`
        : `${head}. Mistake, so w ← w + y·x = ${vec(before.w)} ${point.label > 0 ? '+' : '−'} ${vec([point.x, point.y])} = ${vec(after.w)} and b ← b + y = ${fmt(after.b, 0)}.`;
    }

    if (done && mistakes[mistakes.length - 1] === 0) {
      status.textContent = `Converged: a whole epoch without mistakes (epoch ${epoch}). Every training point is on the correct side.`;
    } else if (done) {
      status.textContent = `Stopped after ${MAX_EPOCHS} epochs with ${mistakes[mistakes.length - 1]} mistakes in the last one. No straight line separates these classes, so the rule never settles.`;
    } else {
      status.textContent = '';
    }
  }

  function drawBars() {
    const { ctx, width, height } = bars;

    if (!width) {
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const top = 16;
    const bottom = height - 18;
    const max = Math.max(4, ...mistakes);
    const slot = (width - 8) / MAX_EPOCHS;
    const barWidth = Math.min(14, slot - 2);

    ctx.font = '11px "Inter Variable", system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Mistakes per epoch', 4, 0);
    ctx.textBaseline = 'top';
    ctx.fillText('1', 4 + slot / 2 - 3, bottom + 4);
    ctx.textAlign = 'right';
    ctx.fillText(String(MAX_EPOCHS), width - 4, bottom + 4);

    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(4, bottom + 0.5);
    ctx.lineTo(width - 4, bottom + 0.5);
    ctx.stroke();

    mistakes.forEach((m, i) => {
      const h = (m / max) * (bottom - top);
      const x = 4 + i * slot + (slot - barWidth) / 2;

      if (m === 0) {
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(x, bottom - 2, barWidth, 2);
        return;
      }

      ctx.fillStyle = COLORS.blue;
      roundTop(ctx, x, bottom - h, barWidth, h, Math.min(4, barWidth / 2));
    });
  }

  draw();
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
