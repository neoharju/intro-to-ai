import { createSearch, FREE, WALL, MUD } from './search-core';
import {
  COLORS, button, createCanvas, createLoop, el, fmt, frame, legend, playButton, pointerPosition,
  prefersReducedMotion, segmented, sequential, slider, stat,
} from './lib';

const COLS = 27;
const ROWS = 13;
const START = 6 * COLS + 3;
const GOAL = 6 * COLS + 23;

const ALGORITHMS = [
  { value: 'bfs', label: 'BFS' },
  { value: 'dfs', label: 'DFS' },
  { value: 'dijkstra', label: 'Dijkstra' },
  { value: 'greedy', label: 'Greedy' },
  { value: 'astar', label: 'A*' },
];

const NAMES = {
  bfs: 'Breadth-first search',
  dfs: 'Depth-first search',
  dijkstra: 'Dijkstra',
  greedy: 'Greedy best-first',
  astar: 'A*',
};

const STEPS_PER_SECOND = [4, 8, 16, 32, 64, 128, 256, 512];

const COLOR = {
  free: '#ffffff',
  grid: '#e9eef5',
  wall: '#334155',
  mud: '#eadfcf',
  mudHatch: '#cdb999',
  frontier: COLORS.yellow,
  path: COLORS.orange,
  start: COLORS.blue,
  goal: COLORS.violet,
};

// A U-shaped wall that opens towards the start (greedy best-first walks into it) and mud over the
// upper detour (breadth-first search ignores its cost).
function defaultCells() {
  const cells = new Uint8Array(COLS * ROWS);
  const set = (x, y, value) => { cells[y * COLS + x] = value; };

  for (let y = 2; y <= 10; y++) {
    set(16, y, WALL);
  }

  for (let x = 11; x <= 16; x++) {
    set(x, 2, WALL);
    set(x, 10, WALL);
  }

  for (let x = 12; x <= 20; x++) {
    set(x, 0, MUD);
    set(x, 1, MUD);
  }

  return cells;
}

export default function mountSearch(figure) {
  const { body } = frame(figure, 'Search on a grid: BFS, DFS, Dijkstra, greedy best-first and A*');
  const grid = { cols: COLS, rows: ROWS, cells: defaultCells() };
  let start = START;
  let goal = GOAL;
  let algorithm = 'astar';
  let search = null;
  let current = -1;
  let pathProgress = 0;
  let tool = WALL;
  let speed = 4;
  let budget = 0;
  let compareVisible = false;
  let layout = { cell: 20, ox: 0, oy: 0 };

  // --- controls ---
  // A new algorithm starts from an empty grid: it only runs when asked to (Run, Step or Compare all).
  const algorithmControl = segmented(ALGORITHMS, algorithm, value => {
    algorithm = value;
    restart(false);
    status.textContent = `${NAMES[algorithm]}: press Run or Step to start the search.`;
  }, 'Search algorithm');

  const stage = el('div', { class: 'vz-stage vz-stage--draw' });
  const view = createCanvas(stage, {
    aspect: ROWS / COLS,
    minHeight: 150,
    maxHeight: 460,
    label: 'Grid with a start cell S, a goal cell G, walls and mud; visited cells are shaded in the order the search expanded them.',
    onResize: () => draw(),
  });

  const loop = createLoop(figure, dt => {
    if (!search) {
      search = createSearch(grid, start, goal, algorithm);
    }

    if (!search.result) {
      budget += (dt / 1000) * STEPS_PER_SECOND[speed - 1];

      while (budget >= 1 && !search.result) {
        budget -= 1;
        current = search.advance();
      }

      if (search.result) {
        pathProgress = prefersReducedMotion() ? 1 : 0;
        announce();
      }
    } else if (pathProgress < 1) {
      pathProgress = Math.min(1, pathProgress + dt / 700);
    }

    draw();

    return !(search.result && pathProgress >= 1);
  });

  const play = playButton(loop, { play: 'Run', pause: 'Pause' });

  // Running again after a finished search starts a new one.
  loop.onChange(running => {
    if (running && search && search.result) {
      search = null;
      current = -1;
      pathProgress = 0;
      status.textContent = '';
    }
  });
  const stepButton = button('Step', () => {
    loop.stop();

    if (!search) {
      search = createSearch(grid, start, goal, algorithm);
    }

    current = search.advance();

    if (search.result) {
      pathProgress = 1;
      announce();
    }

    draw();
  }, { ariaLabel: 'Take the next node from node_list' });

  const resetButton = button('Reset', () => restart(false));

  const speedControl = slider({
    label: 'Speed',
    min: 1,
    max: STEPS_PER_SECOND.length,
    value: speed,
    format: v => `${STEPS_PER_SECOND[v - 1]}/s`,
    onInput: v => { speed = v; },
    width: '6rem',
  });

  const toolControl = segmented([
    { value: WALL, label: 'Wall' },
    { value: MUD, label: 'Mud' },
    { value: FREE, label: 'Erase' },
  ], tool, value => { tool = value; }, 'Drawing tool');

  const clearButton = button('Clear map', () => {
    grid.cells.fill(FREE);
    restart(false);
  });

  const defaultButton = button('Default map', () => {
    grid.cells = defaultCells();
    start = START;
    goal = GOAL;
    restart(false);
  });

  const compareButton = button('Compare all', () => {
    compareVisible = true;
    renderComparison();
  });

  const stats = {
    expanded: stat('Visited'),
    list: stat('In node_list'),
    steps: stat('Path moves'),
    cost: stat('Path cost'),
  };

  const status = el('p', { class: 'vz-note', 'aria-live': 'polite' });
  const comparison = el('div');

  body.append(
    el('div', { class: 'vz-controls' }, algorithmControl.node),
    stage,
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' }, play, stepButton, resetButton),
      speedControl.node),
    el('div', { class: 'vz-controls' },
      el('span', { class: 'vz-label' }, 'Draw'),
      toolControl.node,
      el('div', { class: 'vz-group' }, clearButton, defaultButton, compareButton)),
    legend([
      { color: COLOR.start, label: 'Start' },
      { color: COLOR.goal, label: 'Goal' },
      { color: COLOR.wall, label: 'Wall' },
      { color: COLOR.mud, label: 'Mud (a move into it costs 5)' },
      { style: `background:linear-gradient(90deg, ${sequential(0.1)}, ${sequential(0.5)})`, label: 'Visited (darker = later)' },
      { style: `background:#fff;box-shadow:inset 0 0 0 2px ${COLOR.frontier}`, label: 'In node_list' },
      { color: COLOR.path, label: 'Path found' },
    ]),
    el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)),
    status,
    comparison
  );

  // --- state changes ---

  // Starts over. Drawing on the map after a finished run passes instant = true: the same algorithm is
  // run again at once, so that the effect of the edit shows immediately. Everything else starts blank.
  function restart(instant) {
    loop.stop();
    budget = 0;
    current = -1;
    pathProgress = 0;
    search = null;
    status.textContent = '';

    if (instant) {
      search = createSearch(grid, start, goal, algorithm);
      search.run();
      pathProgress = 1;
      announce();
    }

    if (compareVisible) {
      renderComparison();
    }

    draw();
  }

  function announce() {
    const r = search.result;

    status.textContent = r.found
      ? `${NAMES[algorithm]}: the goal was taken from node_list after visiting ${search.expanded} nodes. Path: ${r.path.length - 1} moves, cost ${r.cost}.`
      : `${NAMES[algorithm]}: node_list became empty after visiting ${search.expanded} nodes; the goal cannot be reached.`;
  }

  function renderComparison() {
    const rows = ALGORITHMS.map(({ value, label }) => {
      const s = createSearch(grid, start, goal, value);
      const r = s.run();

      return el('tr', { class: value === algorithm ? 'is-current' : undefined },
        el('td', {}, label),
        el('td', {}, String(s.expanded)),
        el('td', {}, r.found ? String(r.path.length - 1) : '–'),
        el('td', {}, r.found ? String(r.cost) : 'no path'));
    });

    comparison.replaceChildren(el('table', { class: 'vz-table' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Algorithm'), el('th', {}, 'Visited'), el('th', {}, 'Path moves'), el('th', {}, 'Path cost'))),
      el('tbody', {}, rows)));
  }

  // --- drawing ---

  function computeLayout() {
    const cell = Math.max(6, Math.floor(Math.min(view.width / COLS, view.height / ROWS)));

    layout = {
      cell,
      ox: Math.floor((view.width - cell * COLS) / 2),
      oy: Math.floor((view.height - cell * ROWS) / 2),
    };
  }

  function cellRect(index) {
    const { cell, ox, oy } = layout;

    return [ox + (index % COLS) * cell, oy + Math.floor(index / COLS) * cell, cell];
  }

  function centre(index) {
    const [x, y, size] = cellRect(index);

    return [x + size / 2, y + size / 2];
  }

  function draw() {
    const { ctx, width, height } = view;

    computeLayout();

    const { cell, ox, oy } = layout;
    const expanded = search ? search.expanded : 0;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < grid.cells.length; i++) {
      const [x, y] = cellRect(i);
      const type = grid.cells[i];

      if (type === WALL) {
        ctx.fillStyle = COLOR.wall;
        ctx.fillRect(x, y, cell, cell);
        continue;
      }

      ctx.fillStyle = type === MUD ? COLOR.mud : COLOR.free;
      ctx.fillRect(x, y, cell, cell);

      if (search && search.order[i] >= 0) {
        const t = expanded > 1 ? search.order[i] / (expanded - 1) : 0;

        ctx.fillStyle = sequential(0.1 + 0.42 * t);
        ctx.globalAlpha = type === MUD ? 0.75 : 1;
        ctx.fillRect(x, y, cell, cell);
        ctx.globalAlpha = 1;
      }

      if (type === MUD) {
        hatch(ctx, x, y, cell);
      }

      if (search && search.inList[i] > 0 && search.order[i] < 0) {
        ctx.strokeStyle = COLOR.frontier;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
      }
    }

    // Hairline grid.
    ctx.strokeStyle = COLOR.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let c = 0; c <= COLS; c++) {
      ctx.moveTo(ox + c * cell + 0.5, oy);
      ctx.lineTo(ox + c * cell + 0.5, oy + ROWS * cell);
    }

    for (let r = 0; r <= ROWS; r++) {
      ctx.moveTo(ox, oy + r * cell + 0.5);
      ctx.lineTo(ox + COLS * cell, oy + r * cell + 0.5);
    }

    ctx.stroke();

    if (current >= 0 && search && !search.result) {
      const [x, y] = cellRect(current);

      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    }

    if (search && search.result && search.result.found && pathProgress > 0) {
      drawPath(search.result.path);
    }

    endpoint(start, COLOR.start, 'S');
    endpoint(goal, COLOR.goal, 'G');

    stats.expanded.set(search ? String(search.expanded) : '0');
    stats.list.set(search ? String(search.listSize) : '1');

    const r = search && search.result;

    stats.steps.set(r && r.found ? String(r.path.length - 1) : '–');
    stats.cost.set(r && r.found ? fmt(r.cost, 0) : '–');
  }

  function hatch(ctx, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.strokeStyle = COLOR.mudHatch;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const gap = Math.max(4, size / 4);

    for (let d = -size; d < size; d += gap) {
      ctx.moveTo(x + d, y + size);
      ctx.lineTo(x + d + size, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawPath(path) {
    const { ctx } = view;
    const segments = (path.length - 1) * pathProgress;
    const whole = Math.floor(segments);

    ctx.strokeStyle = COLOR.path;
    ctx.lineWidth = Math.max(2, layout.cell / 6);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    const [x0, y0] = centre(path[0]);

    ctx.moveTo(x0, y0);

    for (let i = 1; i <= whole; i++) {
      const [x, y] = centre(path[i]);

      ctx.lineTo(x, y);
    }

    if (whole < path.length - 1) {
      const [xa, ya] = centre(path[whole]);
      const [xb, yb] = centre(path[whole + 1]);
      const f = segments - whole;

      ctx.lineTo(xa + (xb - xa) * f, ya + (yb - ya) * f);
    }

    ctx.stroke();
  }

  function endpoint(index, color, letter) {
    const { ctx } = view;
    const [x, y, size] = cellRect(index);
    const inset = Math.max(1, size * 0.08);

    ctx.fillStyle = color;
    roundRect(ctx, x + inset, y + inset, size - 2 * inset, size - 2 * inset, Math.max(2, size * 0.2));
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.max(8, Math.round(size * 0.55))}px "Inter Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x + size / 2, y + size / 2 + 0.5);
  }

  // --- editing ---

  let drag = null;

  function cellAt(event) {
    const { x, y } = pointerPosition(view.canvas, event);
    const { cell, ox, oy } = layout;
    const cx = Math.floor((x - ox) / cell);
    const cy = Math.floor((y - oy) / cell);

    return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? cy * COLS + cx : -1;
  }

  function paint(index) {
    if (index < 0 || index === start || index === goal || grid.cells[index] === tool) {
      return false;
    }

    grid.cells[index] = tool;
    return true;
  }

  view.canvas.addEventListener('pointerdown', event => {
    const index = cellAt(event);

    if (index < 0) {
      return;
    }

    event.preventDefault();
    view.canvas.setPointerCapture(event.pointerId);
    drag = index === start ? 'start' : index === goal ? 'goal' : 'paint';

    if (drag === 'paint' && paint(index)) {
      restart(search && search.result);
    }
  });

  view.canvas.addEventListener('pointermove', event => {
    if (!drag) {
      return;
    }

    const index = cellAt(event);

    if (index < 0) {
      return;
    }

    if (drag === 'paint') {
      if (paint(index)) {
        restart(search && search.result);
      }
    } else if (grid.cells[index] !== WALL && index !== start && index !== goal) {
      if (drag === 'start') {
        start = index;
      } else {
        goal = index;
      }

      restart(search && search.result);
    }
  });

  const endDrag = () => { drag = null; };

  view.canvas.addEventListener('pointerup', endDrag);
  view.canvas.addEventListener('pointercancel', endDrag);

  draw();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
