// Week 4, extra section on end-to-end learning: a one-number bottleneck. Every point of the plane is squeezed
// into one number z, its position along a line, before a classifier sees it. The pipeline chooses the line
// without the labels (the first principal component) and fits only its classifier; the end-to-end model
// starts where the pipeline ends and trains the line and the classifier together, on the classifier's loss.
// The mathematics is in endtoend-core.js.
import {
  CLASS_COLORS, COLORS, button, createCanvas, createLoop, createRandom, el, fmt, frame, legend, marker,
  playButton, prefersReducedMotion, segmented, stat, withAlpha,
} from './lib';
import {
  X_RANGE, Y_RANGE, accuracy, angleBetween, feature, fitPipeline, lossAndGradient, makeData, startEndToEnd, step,
} from './endtoend-core';

const RATE = 2;
const STEPS_PER_SECOND = 30;
const MAX_STEPS = 400;
const degrees = phi => ((((phi * 180) / Math.PI) % 180) + 180) % 180;

export default function mountEndToEnd(figure) {
  const { body } = frame(figure, 'A one-number bottleneck: pipeline or end to end');
  let seed = 1;
  let along = 'narrow';
  let points = [];
  let pipeline = null;
  let model = null;
  let steps = 0;
  let owed = 0;

  const stage = el('div', { class: 'vz-stage' });
  const plane = createCanvas(stage, {
    aspect: (Y_RANGE[1] - Y_RANGE[0]) / (X_RANGE[1] - X_RANGE[0]),
    minHeight: 150,
    maxHeight: 460,
    label: 'Points of two classes in a long, tilted cloud, with two lines through it: the line onto which the pipeline projects every point (the first principal component, dashed) and the line learned end to end (solid).',
    onResize: () => draw(),
  });

  // The one number z of every point, for each system: class 0 on the upper lane, class 1 on the lower one,
  // the background tinted by the class that the classifier predicts there.
  function strip(name) {
    const title = el('span', { class: 'vz-strip__name' }, name);
    const score = el('span', { class: 'vz-strip__score' });
    const box = el('div', { class: 'vz-stage' });
    const view = createCanvas(box, {
      aspect: 0.08,
      minHeight: 52,
      maxHeight: 60,
      label: `The number z of every point for the ${name.toLowerCase()}, with the classifier's threshold.`,
      onResize: () => draw(),
    });

    return { node: el('div', { class: 'vz-strip' }, el('p', { class: 'vz-strip__label' }, title, score), box), score, view };
  }

  const strips = {
    pipeline: strip('Pipeline: z along the first principal component'),
    endToEnd: strip('End to end: z along the learned line'),
  };

  const stats = {
    steps: stat('Training steps'),
    angle: stat('Angle between the lines'),
    pipeline: stat('Pipeline: correct'),
    endToEnd: stat('End to end: correct'),
  };

  const formula = el('p', { class: 'vz-math', style: 'margin:.75rem 0 0' });

  const loop = createLoop(figure, dt => {
    owed += prefersReducedMotion() ? MAX_STEPS : (dt * STEPS_PER_SECOND) / 1000;

    for (; owed >= 1 && steps < MAX_STEPS; owed -= 1) {
      model = step(points, model, { rate: RATE });
      steps += 1;
    }

    draw();

    return steps < MAX_STEPS;
  });

  // Training again after the last step starts from the beginning.
  loop.onChange(running => {
    if (running && steps >= MAX_STEPS) {
      resetModel();
    }
  });

  const alongControl = segmented([
    { value: 'narrow', label: 'across the cloud' },
    { value: 'wide', label: 'along the cloud' },
  ], along, value => { along = value; newData(); }, 'Where the classes differ');

  body.append(
    stage,
    legend([
      { color: CLASS_COLORS[0], label: 'Class 0 (circles)' },
      { color: CLASS_COLORS[1], label: 'Class 1 (squares)' },
      { color: COLORS.muted, label: 'Pipeline: first principal component (dashed)' },
      { color: COLORS.violet, label: 'End to end: learned line' },
    ]),
    el('div', { class: 'vz-strips' }, strips.pipeline.node, strips.endToEnd.node),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        playButton(loop, { play: 'Train end to end', pause: 'Pause' }),
        button('1 step', () => {
          loop.stop();

          if (steps < MAX_STEPS) {
            model = step(points, model, { rate: RATE });
            steps += 1;
          }

          draw();
        }, { ariaLabel: 'One gradient descent step of the end-to-end model' }),
        button('Reset', () => { loop.stop(); resetModel(); })),
      el('div', { class: 'vz-group' },
        el('span', { class: 'vz-label' }, 'The classes differ'),
        alongControl.node,
        button('New data', () => { seed += 1; newData(); }))),
    el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
    formula,
  );

  function resetModel() {
    model = startEndToEnd(pipeline);
    steps = 0;
    owed = 0;
    draw();
  }

  function newData() {
    loop.stop();
    points = makeData(createRandom(seed), along);
    pipeline = fitPipeline(points);
    resetModel();
  }

  // Data coordinates -> canvas pixels (the same scale in x and y, so that angles look right).
  const sx = x => ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * plane.width;
  const sy = y => (1 - (y - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * plane.height;

  // The line through the centre of the points in the direction phi, across the whole canvas.
  function drawLine(ctx, phi, color, dashed, label, end) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const reach = 2.5;
    const [x0, y0] = [cx - reach * Math.cos(phi), cy - reach * Math.sin(phi)];
    const [x1, y1] = [cx + reach * Math.cos(phi), cy + reach * Math.sin(phi)];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 2 : 2.5;
    ctx.setLineDash(dashed ? [7, 6] : []);
    ctx.beginPath();
    ctx.moveTo(sx(x0), sy(y0));
    ctx.lineTo(sx(x1), sy(y1));
    ctx.stroke();
    ctx.restore();

    // The label near one end of the line, inside the canvas: the pipeline's on the left, the other on the right.
    const t = end > 0 ? 0.86 : 0.14;
    const visible = clipToCanvas(x0, y0, x1, y1);

    if (visible) {
      const lx = sx(visible[0][0] + t * (visible[1][0] - visible[0][0]));
      const ly = sy(visible[0][1] + t * (visible[1][1] - visible[0][1]));

      ctx.font = '600 12px "Inter Variable", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.surface2;
      ctx.strokeText(label, lx, ly - 12);
      ctx.fillStyle = color;
      ctx.fillText(label, lx, ly - 12);
    }
  }

  // The part of the segment inside the data range, ordered from left to right, or null.
  function clipToCanvas(x0, y0, x1, y1) {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const edges = [[-dx, x0 - X_RANGE[0]], [dx, X_RANGE[1] - x0], [-dy, y0 - Y_RANGE[0]], [dy, Y_RANGE[1] - y0]];

    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) {
          return null;
        }
      } else {
        const r = q / p;

        if (p < 0) {
          t0 = Math.max(t0, r);
        } else {
          t1 = Math.min(t1, r);
        }
      }
    }

    if (t0 > t1) {
      return null;
    }

    const a = [x0 + t0 * dx, y0 + t0 * dy];
    const b = [x0 + t1 * dx, y0 + t1 * dy];

    return a[0] <= b[0] ? [a, b] : [b, a];
  }

  function drawPlane() {
    const { ctx, width, height } = plane;

    ctx.clearRect(0, 0, width, height);
    drawLine(ctx, pipeline.phi, COLORS.muted, true, 'pipeline', -1);
    drawLine(ctx, model.phi, COLORS.violet, false, 'end to end', 1);
    points.forEach(point => marker(ctx, point.label, sx(point.x), sy(point.y), 4, CLASS_COLORS[point.label]));
  }

  function drawStrip({ view, score }, system) {
    const { ctx, width, height } = view;
    const zs = points.map(point => feature(point, system.phi));
    const low = Math.min(...zs);
    const high = Math.max(...zs);
    const pad = 12;
    const px = z => pad + ((z - low) / (high - low || 1)) * (width - 2 * pad);
    const lane = label => (label ? 0.72 : 0.28) * height;
    // Smaller marks on a narrow strip (a phone), where the rings of neighbours would run together.
    const radius = width < 520 ? 2.75 : 3.5;
    const ring = width < 520 ? 5 : 7;
    let correct = 0;

    ctx.clearRect(0, 0, width, height);

    // Predicted class 1 where a z + b >= 0: right of the threshold if a > 0, left of it if a < 0.
    const threshold = Math.abs(system.a) > 1e-9 ? -system.b / system.a : null;

    if (threshold !== null) {
      const cut = Math.max(0, Math.min(width, px(threshold)));
      const right = system.a > 0 ? 1 : 0;

      ctx.fillStyle = withAlpha(CLASS_COLORS[1 - right], 0.1);
      ctx.fillRect(0, 0, cut, height);
      ctx.fillStyle = withAlpha(CLASS_COLORS[right], 0.1);
      ctx.fillRect(cut, 0, width - cut, height);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cut, 3);
      ctx.lineTo(cut, height - 3);
      ctx.stroke();
    }

    points.forEach((point, i) => {
      const predicted = system.a * zs[i] + system.b >= 0 ? 1 : 0;
      const x = px(zs[i]);
      const y = lane(point.label);

      if (predicted === point.label) {
        correct += 1;
      } else {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, ring, 0, Math.PI * 2);
        ctx.stroke();
      }

      marker(ctx, point.label, x, y, radius, CLASS_COLORS[point.label]);
    });

    score.textContent = ` · ${fmt((100 * correct) / points.length, 0)}% correct`;
  }

  function draw() {
    if (!plane.width || !model) {
      return;
    }

    drawPlane();
    drawStrip(strips.pipeline, pipeline);
    drawStrip(strips.endToEnd, model);

    stats.steps.set(`${steps}`);
    stats.angle.set(`${fmt(angleBetween(model.phi, pipeline.phi), 0)}°`);
    stats.pipeline.set(`${fmt(100 * accuracy(points, pipeline), 0)}%`);
    stats.endToEnd.set(`${fmt(100 * accuracy(points, model), 0)}%`);

    formula.textContent = `z = w · x, with w at ${fmt(degrees(pipeline.phi), 0)}° (pipeline) and ${fmt(degrees(model.phi), 0)}° (end to end). `
      + `End to end: p = σ(a z + b) with a = ${fmt(model.a, 1)}, b = ${fmt(model.b, 2)}, mean log-loss ${fmt(lossAndGradient(points, model).loss, 3)}.`;
  }

  newData();
}
