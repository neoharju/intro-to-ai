import {
  CLASS_COLORS, COLORS, button, createCanvas, createRandom, dot, el, fmt, frame, legend, marker,
  pointerPosition, withAlpha,
} from './lib';

const X_MAX = 10;
const COUNT = 16;
const YES = 1;

// Entropy of a yes/no set with a fraction p of yes, in bits; 0 log 0 = 0.
export function entropy(p) {
  if (p <= 0 || p >= 1) {
    return 0;
  }

  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function summary(points) {
  const yes = points.filter(point => point.label === YES).length;

  return { n: points.length, yes, no: points.length - yes, p: points.length ? yes / points.length : 0 };
}

// Gain(S, [x <= t]) = Entropy(S) - sum over the two children of |S_v| / |S| * Entropy(S_v).
export function split(points, t) {
  const all = summary(points);
  const left = summary(points.filter(point => point.x <= t));
  const right = summary(points.filter(point => point.x > t));
  const weighted = (left.n / all.n) * entropy(left.p) + (right.n / all.n) * entropy(right.p);

  return { all, left, right, weighted, gain: entropy(all.p) - weighted };
}

// Thresholds halfway between neighbouring values: every distinct split of the points.
export function candidates(points) {
  const xs = [...new Set(points.map(point => point.x))].sort((a, b) => a - b);

  return xs.slice(1).map((x, i) => (xs[i] + x) / 2);
}

function makeData(seed) {
  const random = createRandom(seed);
  const xs = [];

  while (xs.length < COUNT) {
    const x = Math.round((0.3 + random() * (X_MAX - 0.6)) * 10) / 10;

    if (xs.every(other => Math.abs(other - x) >= 0.35)) {
      xs.push(x);
    }
  }

  // Mostly "yes" for small x and "no" for large x, with some noise.
  return xs.sort((a, b) => a - b).map(x => {
    const pYes = 1 / (1 + Math.exp((x - 5.2) * 1.1));

    return { x, label: random() < pYes ? YES : 0 };
  });
}

export default function mountInfoGain(figure) {
  const { body } = frame(figure, 'Choosing a threshold by information gain');
  let seed = 5;
  let points = makeData(seed);
  let t = 4.1;

  const stripStage = el('div', { class: 'vz-stage vz-stage--draw' });
  const strip = createCanvas(stripStage, {
    aspect: 0.3,
    minHeight: 200,
    maxHeight: 250,
    label: 'Points on a line labelled yes or no, a movable threshold t, and below them the information gain of every threshold.',
    onResize: () => draw(),
  });

  const curveStage = el('div', { class: 'vz-stage' });
  const curve = createCanvas(curveStage, {
    aspect: 0.62,
    minHeight: 170,
    maxHeight: 250,
    label: 'The entropy curve with the parent set and both child sets marked; the gain is the gap between the parent and the line joining the children.',
    onResize: () => draw(),
  });

  const numbers = el('div', { class: 'vz-math', 'aria-live': 'polite' });

  body.append(
    stripStage,
    legend([
      { color: CLASS_COLORS[1], label: 'Yes (squares)' },
      { color: CLASS_COLORS[0], label: 'No (circles)' },
      { color: COLORS.violet, label: 'Gain of each threshold' },
    ]),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        button('◀', () => moveTo(-1), { ariaLabel: 'Previous threshold' }),
        button('▶', () => moveTo(1), { ariaLabel: 'Next threshold' }),
        button('Best threshold', () => {
          const best = candidates(points).reduce((a, b) => (split(points, b).gain > split(points, a).gain ? b : a));

          t = best;
          draw();
        }),
        button('New data', () => { seed += 1; points = makeData(seed); draw(); }))),
    el('div', { class: 'vz-split vz-split--even', style: 'margin-top:.85rem' },
      curveStage,
      el('div', { class: 'vz-panel' }, el('h5', {}, 'Predicate [x ≤ t]'), numbers))
  );

  const pad = 18;
  const sx = x => pad + (x / X_MAX) * (strip.width - 2 * pad);
  const dx = px => ((px - pad) / (strip.width - 2 * pad)) * X_MAX;

  function moveTo(direction) {
    const list = candidates(points);
    const index = direction > 0 ? list.findIndex(c => c > t + 1e-9) : list.length - 1 - [...list].reverse().findIndex(c => c < t - 1e-9);

    if (index >= 0 && index < list.length) {
      t = list[index];
      draw();
    }
  }

  function drawStrip(result) {
    const { ctx, width, height } = strip;
    const axisY = 70;
    const gainTop = 104;
    const gainBottom = height - 28;
    const gy = g => gainBottom - g * (gainBottom - gainTop);
    const tx = sx(t);

    ctx.clearRect(0, 0, width, height);

    // Left side of the threshold.
    ctx.fillStyle = withAlpha(COLORS.blue, 0.06);
    ctx.fillRect(pad, 8, Math.max(0, tx - pad), gainBottom - 8);

    // Axis with ticks.
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, axisY + 0.5);
    ctx.lineTo(width - pad, axisY + 0.5);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Inter Variable", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let x = 0; x <= X_MAX; x += 2) {
      ctx.fillText(String(x), sx(x), axisY + 6);
    }

    // Gain of every candidate threshold (constant between neighbouring points).
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(pad, gainBottom + 0.5);
    ctx.lineTo(width - pad, gainBottom + 0.5);
    ctx.stroke();

    const list = candidates(points);
    const gains = list.map(c => split(points, c).gain);
    const best = Math.max(...gains);

    ctx.strokeStyle = COLORS.violet;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    list.forEach((c, i) => {
      const x = sx(c);
      const y = gy(gains[i]);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    list.forEach((c, i) => {
      if (gains[i] === best) {
        dot(ctx, sx(c), gy(gains[i]), 4, COLORS.violet);
      }
    });

    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Gain(t)', pad + 2, gainTop - 6);
    ctx.fillText(`best ${fmt(best, 3)} bits`, pad + 2, gainBottom + 6);

    // Points (stacked slightly so that equal x would not overlap).
    points.forEach(point => {
      marker(ctx, point.label === YES ? 1 : 0, sx(point.x), axisY - 16, 5, CLASS_COLORS[point.label === YES ? 1 : 0]);
    });

    // Threshold handle.
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, 14);
    ctx.lineTo(tx, gainBottom);
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(tx, 14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = tx > width - 70 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`t = ${fmt(t, 2)}`, tx + (tx > width - 70 ? -10 : 10), 14);
    dot(ctx, tx, gy(result.gain), 4, COLORS.ink);
  }

  function drawCurve(result) {
    const { ctx, width, height } = curve;
    const left = 34;
    const right = width - 12;
    const top = 12;
    const bottom = height - 26;
    const px = p => left + p * (right - left);
    const py = h => bottom - h * (bottom - top);

    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px "Inter Variable", system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    [0, 0.5, 1].forEach(h => {
      ctx.beginPath();
      ctx.moveTo(left, Math.round(py(h)) + 0.5);
      ctx.lineTo(right, Math.round(py(h)) + 0.5);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h), left - 6, py(h));
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('0', px(0), bottom + 6);
    ctx.fillText('fraction of yes, p', px(0.5), bottom + 6);
    ctx.fillText('1', px(1), bottom + 6);

    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i <= 100; i++) {
      const p = i / 100;

      if (i === 0) {
        ctx.moveTo(px(p), py(entropy(p)));
      } else {
        ctx.lineTo(px(p), py(entropy(p)));
      }
    }

    ctx.stroke();

    const { all, left: l, right: r, weighted } = result;
    const children = [l, r].filter(s => s.n > 0);

    // Chord between the children: its height at p(S) is the weighted average entropy.
    if (children.length === 2) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px(l.p), py(entropy(l.p)));
      ctx.lineTo(px(r.p), py(entropy(r.p)));
      ctx.stroke();
    }

    // The gain: from the weighted average up to Entropy(S).
    ctx.strokeStyle = COLORS.violet;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(all.p), py(weighted));
    ctx.lineTo(px(all.p), py(entropy(all.p)));
    ctx.stroke();

    if (l.n) {
      dot(ctx, px(l.p), py(entropy(l.p)), 4, COLORS.muted);
    }

    if (r.n) {
      dot(ctx, px(r.p), py(entropy(r.p)), 4, COLORS.muted);
    }

    dot(ctx, px(all.p), py(entropy(all.p)), 4, COLORS.ink);

    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('S', px(all.p) + 7, py(entropy(all.p)) - 3);

    [[l, 'x ≤ t'], [r, 'x > t']].forEach(([s, text]) => {
      if (s.n) {
        ctx.textAlign = s.p > 0.75 ? 'right' : 'left';
        ctx.fillText(text, px(s.p) + (s.p > 0.75 ? -7 : 7), py(entropy(s.p)) + 16);
      }
    });
  }

  function draw() {
    if (!strip.width || !curve.width) {
      return;
    }

    const result = split(points, t);
    const { all, left, right, weighted, gain } = result;
    const row = (name, set) => el('tr', {},
      el('td', {}, name), el('td', {}, String(set.yes)), el('td', {}, String(set.no)),
      el('td', {}, `${set.n}/${all.n}`), el('td', {}, fmt(entropy(set.p), 3)));

    drawStrip(result);
    drawCurve(result);

    numbers.replaceChildren(
      el('table', { class: 'vz-table', style: 'margin-top:0' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Set'), el('th', {}, 'Yes'), el('th', {}, 'No'), el('th', {}, 'Weight'), el('th', {}, 'Entropy'))),
        el('tbody', {}, row('S', all), row('x ≤ t', left), row('x > t', right))),
      el('p', { style: 'margin:.6rem 0 0' },
        `Weighted entropy = ${left.n}/${all.n} × ${fmt(entropy(left.p), 3)} + ${right.n}/${all.n} × ${fmt(entropy(right.p), 3)} = ${fmt(weighted, 3)}`),
      el('p', { style: 'margin:.25rem 0 0' }, 'Gain = ', el('b', {}, `${fmt(entropy(all.p), 3)} − ${fmt(weighted, 3)} = ${fmt(gain, 3)} bits`))
    );
  }

  let dragging = false;

  const setFromPointer = event => {
    const { x } = pointerPosition(strip.canvas, event);

    t = Math.min(X_MAX, Math.max(0, dx(x)));
    draw();
  };

  strip.canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    dragging = true;
    strip.canvas.setPointerCapture(event.pointerId);
    setFromPointer(event);
  });
  strip.canvas.addEventListener('pointermove', event => {
    if (dragging) {
      setFromPointer(event);
    }
  });
  strip.canvas.addEventListener('pointerup', () => { dragging = false; });
  strip.canvas.addEventListener('pointercancel', () => { dragging = false; });

  strip.canvas.tabIndex = 0;
  strip.canvas.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveTo(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  draw();
}
