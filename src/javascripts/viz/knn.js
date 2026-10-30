import {
  CLASS_COLORS, COLORS, button, checkbox, createCanvas, createRandom, el, fmt, frame, legend, marker,
  pointerPosition, segmented, slider, withAlpha,
} from './lib';

const CLASS_NAMES = ['A', 'B', 'C'];
const X_RANGE = [0, 1];
const Y_RANGE = [0, 0.62];

function makeData(seed) {
  const random = createRandom(seed);
  const centres = [[0.27, 0.42], [0.68, 0.45], [0.5, 0.17]];
  const points = [];

  centres.forEach(([cx, cy], label) => {
    for (let i = 0; i < 18; i++) {
      points.push({
        x: Math.min(0.98, Math.max(0.02, cx + 0.12 * random.normal())),
        y: Math.min(0.6, Math.max(0.02, cy + 0.09 * random.normal())),
        label,
      });
    }
  });

  return points;
}

const DISTANCES = {
  euclidean: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  manhattan: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
};

// The k nearest training points of u and the majority vote. Ties in the vote go to the class of the
// nearest neighbour among the tied classes.
export function classify(points, u, k, distance) {
  const neighbours = points
    .map(point => ({ point, d: distance(point, u) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  const votes = [0, 0, 0];

  neighbours.forEach(({ point }) => { votes[point.label] += 1; });

  const best = Math.max(...votes);
  const tied = votes.map((v, label) => (v === best ? label : -1)).filter(label => label >= 0);
  const label = tied.length === 1 ? tied[0] : neighbours.find(n => tied.includes(n.point.label)).point.label;

  return { neighbours, votes, label, tie: tied.length > 1 };
}

export default function mountKnn(figure) {
  const { body } = frame(figure, 'k-nearest neighbours');
  let seed = 11;
  let points = makeData(seed);
  let query = { x: 0.47, y: 0.35 };
  let k = 5;
  let metric = 'euclidean';
  let regions = true;
  let addLabel = 0;
  let regionCache = null;

  const stage = el('div', { class: 'vz-stage vz-stage--draw' });
  const view = createCanvas(stage, {
    aspect: (Y_RANGE[1] - Y_RANGE[0]) / (X_RANGE[1] - X_RANGE[0]),
    // Large enough bounds that the scale stays the same in x and y (distances look right).
    minHeight: 120,
    maxHeight: 560,
    label: 'Training points of three classes and a query point; lines join the query to its k nearest neighbours.',
    onResize: () => { regionCache = null; draw(); },
  });

  const kControl = slider({
    label: 'k',
    min: 1,
    max: 15,
    value: k,
    onInput: v => { k = v; regionCache = null; draw(); },
    width: '8rem',
  });

  const votesNode = el('div', { class: 'vz-votes' });
  const verdict = el('p', { class: 'vz-narration', 'aria-live': 'polite', style: 'margin-top:.6rem' });

  body.append(
    el('div', { class: 'vz-controls' },
      kControl.node,
      segmented([
        { value: 'euclidean', label: 'Euclidean' },
        { value: 'manhattan', label: 'Manhattan' },
      ], metric, value => { metric = value; regionCache = null; draw(); }, 'Distance').node,
      checkbox('Decision regions', regions, value => { regions = value; draw(); }).node),
    stage,
    legend([
      ...CLASS_NAMES.map((name, i) => ({ color: CLASS_COLORS[i], label: `Class ${name} (${['circles', 'squares', 'triangles'][i]})` })),
      { color: COLORS.ink, label: 'Query point u (drag it)' },
    ]),
    el('div', { class: 'vz-controls' },
      el('span', { class: 'vz-label' }, 'Click to add'),
      segmented(CLASS_NAMES.map((name, i) => ({ value: i, label: `Class ${name}` })), addLabel, v => { addLabel = v; }, 'Class of new points').node,
      button('New data', () => { seed += 1; points = makeData(seed); regionCache = null; draw(); })),
    el('div', { class: 'vz-panel', style: 'margin-top:.85rem' },
      el('h5', {}, 'Votes of the k nearest neighbours: P(u ~ y) = (1/k) Σ I[y_u(i) = y]'),
      votesNode,
      verdict)
  );

  const sx = x => ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * view.width;
  const sy = y => (1 - (y - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * view.height;
  const dx = px => X_RANGE[0] + (px / view.width) * (X_RANGE[1] - X_RANGE[0]);
  const dy = py => Y_RANGE[0] + (1 - py / view.height) * (Y_RANGE[1] - Y_RANGE[0]);

  // The class predicted for every 6 x 6 pixel block, drawn as a pale tint.
  function regionImage(width, height) {
    if (regionCache) {
      return regionCache;
    }

    const cols = Math.ceil(width / 6);
    const rows = Math.ceil(height / 6);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const distance = DISTANCES[metric];

    canvas.width = cols;
    canvas.height = rows;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const u = { x: dx(((i + 0.5) / cols) * width), y: dy(((j + 0.5) / rows) * height) };

        ctx.fillStyle = withAlpha(CLASS_COLORS[classify(points, u, Math.min(k, points.length), distance).label], 0.16);
        ctx.fillRect(i, j, 1, 1);
      }
    }

    regionCache = canvas;

    return canvas;
  }

  function draw() {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    ctx.clearRect(0, 0, width, height);

    if (regions && points.length) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(regionImage(width, height), 0, 0, width, height);
    }

    const distance = DISTANCES[metric];
    const result = classify(points, query, Math.min(k, points.length), distance);
    const qx = sx(query.x);
    const qy = sy(query.y);

    // The neighbourhood: all points within the distance of the k-th neighbour.
    const radius = result.neighbours.length ? result.neighbours[result.neighbours.length - 1].d : 0;
    const rx = (radius / (X_RANGE[1] - X_RANGE[0])) * width;
    const ry = (radius / (Y_RANGE[1] - Y_RANGE[0])) * height;

    ctx.strokeStyle = withAlpha(COLORS.ink, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();

    if (metric === 'euclidean') {
      ctx.ellipse(qx, qy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(qx, qy - ry);
      ctx.lineTo(qx + rx, qy);
      ctx.lineTo(qx, qy + ry);
      ctx.lineTo(qx - rx, qy);
      ctx.closePath();
    }

    ctx.stroke();

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.2;
    result.neighbours.forEach(({ point }) => {
      ctx.beginPath();
      ctx.moveTo(qx, qy);
      ctx.lineTo(sx(point.x), sy(point.y));
      ctx.stroke();
    });

    points.forEach(point => marker(ctx, point.label, sx(point.x), sy(point.y), 4.5, CLASS_COLORS[point.label]));

    // Query point: a ringed dot in the colour of its predicted class.
    ctx.beginPath();
    ctx.arc(qx, qy, 10, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(qx, qy, 5, 0, Math.PI * 2);
    ctx.fillStyle = CLASS_COLORS[result.label];
    ctx.fill();

    renderVotes(result);
  }

  function renderVotes(result) {
    const n = result.neighbours.length || 1;

    votesNode.replaceChildren(...CLASS_NAMES.map((name, label) => el('div', { class: 'vz-vote' },
      el('span', {}, `Class ${name}`),
      el('div', { class: 'vz-vote__track' },
        el('div', { class: 'vz-vote__bar', style: `width:${(100 * result.votes[label]) / n}%;background:${CLASS_COLORS[label]}` })),
      el('b', {}, `${result.votes[label]} / ${n} = ${fmt(result.votes[label] / n, 2)}`))));

    verdict.textContent = result.tie
      ? `The vote is tied, so u gets the class of its nearest neighbour among the tied classes: class ${CLASS_NAMES[result.label]}.`
      : `Prediction a(u) = class ${CLASS_NAMES[result.label]}, the most frequent class among the ${n} nearest neighbours.`;
  }

  let dragging = false;

  view.canvas.addEventListener('pointerdown', event => {
    const { x, y } = pointerPosition(view.canvas, event);

    event.preventDefault();

    if (Math.hypot(x - sx(query.x), y - sy(query.y)) < 18) {
      dragging = true;
      view.canvas.setPointerCapture(event.pointerId);
    } else {
      points.push({ x: dx(x), y: dy(y), label: addLabel });
      regionCache = null;
      draw();
    }
  });

  view.canvas.addEventListener('pointermove', event => {
    if (!dragging) {
      return;
    }

    const { x, y } = pointerPosition(view.canvas, event);

    query = {
      x: Math.min(X_RANGE[1], Math.max(X_RANGE[0], dx(x))),
      y: Math.min(Y_RANGE[1], Math.max(Y_RANGE[0], dy(y))),
    };
    draw();
  });

  const stop = () => { dragging = false; };

  view.canvas.addEventListener('pointerup', stop);
  view.canvas.addEventListener('pointercancel', stop);

  // Keyboard: the arrow keys move the query point.
  view.canvas.tabIndex = 0;
  view.canvas.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] };
    const move = moves[event.key];

    if (move) {
      event.preventDefault();
      query = {
        x: Math.min(X_RANGE[1], Math.max(X_RANGE[0], query.x + move[0])),
        y: Math.min(Y_RANGE[1], Math.max(Y_RANGE[0], query.y + move[1])),
      };
      draw();
    }
  });

  draw();
}
