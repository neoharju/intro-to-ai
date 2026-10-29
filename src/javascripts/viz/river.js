import { GOAL, ITEMS, NAMES, START, bfs, label, moves, neighbours, side } from './river-core';
import { button, createLoop, el, frame, prefersReducedMotion, stat, svg } from './lib';

// The scene: two banks with the river in between; every item has a fixed place on either bank. The
// compact layout is for narrow screens, where the wide one would shrink its labels too much.
const H = 196;
const SCENES = {
  wide: { W: 640, BANK: 236, SLOT: { f: [62, 66], w: [170, 66], g: [62, 140], c: [170, 140] }, boat: 66 },
  compact: { W: 420, BANK: 156, SLOT: { f: [42, 66], w: [114, 66], g: [42, 140], c: [114, 140] }, boat: 46 },
};
const COMPACT_BELOW = 520;

// The state transition diagram: [state, column, row]. It has the shape of a diamond: one way in,
// two ways round the middle, one way out.
const LAYOUT = [
  [0b0000, 0, 1], [0b1010, 1, 1], [0b0010, 2, 1], [0b1110, 3, 0], [0b1011, 3, 2],
  [0b0100, 4, 0], [0b0001, 4, 2], [0b1101, 5, 1], [0b0101, 6, 1], [0b1111, 7, 1],
];
const POSITION = new Map(LAYOUT.map(([state, column, row]) => [state, [46 + column * 92, 24 + row * 46]]));
const NODE_W = 78;
const NODE_H = 28;

// Events per second while the breadth-first search is shown.
const BFS_RATE = 1.6;

const verb = cargo => (cargo ? `takes the ${NAMES[cargo]}` : 'rows across alone');

// 'c|fwg' with each letter in the colour of its item.
function notation(state, inSvg) {
  return [...label(state)].map(ch => (ch === '|'
    ? (inSvg ? svg('tspan', { class: 'wgc-bar' }, '|') : el('span', { class: 'wgc-bar' }, '|'))
    : (inSvg ? svg('tspan', { class: `wgc-ink--${ch}` }, ch) : el('span', { class: `wgc-ink--${ch}` }, ch))));
}

function describe(state) {
  const names = bank => ITEMS.filter(item => side(state, item) === bank).map(item => NAMES[item]).join(', ') || 'nobody';

  return `State ${label(state)}: on the left bank ${names(0)}; on the right bank ${names(1)}.`;
}

export default function mountRiver(figure) {
  const { body } = frame(figure, 'Wolf, goat and cabbage: find the way across');
  let state = START;
  let history = [START];
  let discovered = new Set([START]);
  let refused = 0;
  let visitOrder = new Map();
  let solution = [];
  let queue = null;
  let events = [];
  let budget = 0;

  // --- scene ---
  const scene = svg('svg', { class: 'wgc wgc-scene', role: 'img' });
  const sceneStage = el('div', { class: 'vz-stage', style: 'padding:.5rem' }, scene);
  let layout = null;
  let boat;
  let tokens;

  // Draws the banks, the river, the boat and the items for the wide or the compact layout.
  function buildScene(next) {
    const { W, BANK } = next;
    const waves = [];
    const river = W - 2 * BANK;

    for (let y = 34; y < H - 20; y += 34) {
      waves.push(svg('path', {
        class: 'wgc-wave',
        d: `M${BANK + river * 0.14} ${y} q${river / 20} -7 ${river / 10} 0` + ` t${river / 10} 0`.repeat(6),
      }));
    }

    layout = next;
    boat = svg('path', { class: 'wgc-boat wgc-scene__boat', d: `M0 0 h${next.boat} l-${next.boat * 0.18} 18 h-${next.boat * 0.64} z` });
    tokens = Object.fromEntries(ITEMS.map(item => [item, svg('g', { class: `wgc-token wgc-token--${item} wgc-scene__token` },
      svg('circle', { r: 23 }),
      svg('text', { y: 1 }, item),
      svg('text', { class: 'wgc-scene__name', y: 36 }, NAMES[item]))]));

    // No gliding while the scene is rebuilt: the items would fly in from the corner.
    scene.classList.remove('is-animated');
    scene.setAttribute('viewBox', `0 0 ${W} ${H}`);
    scene.replaceChildren(
      svg('rect', { class: 'wgc-bank', x: 0, y: 0, width: W, height: H, rx: 14 }),
      svg('rect', { class: 'wgc-river', x: BANK, y: 0, width: river, height: H }),
      ...waves,
      svg('text', { class: 'wgc-zone', x: BANK / 2, y: 16 }, 'left bank'),
      svg('text', { class: 'wgc-zone', x: W - BANK / 2, y: 16 }, 'right bank'),
      boat,
      ...Object.values(tokens)
    );
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => scene.classList.add('is-animated')));
  }

  const chooseLayout = () => {
    const next = sceneStage.clientWidth && sceneStage.clientWidth < COMPACT_BELOW ? SCENES.compact : SCENES.wide;

    if (next !== layout) {
      buildScene(next);
      renderScene();
    }
  };

  buildScene(SCENES.wide);

  // --- controls ---
  const actions = [null, 'w', 'g', 'c'].map(cargo => ({
    cargo,
    node: button(cargo ? `Take the ${NAMES[cargo]}` : 'Cross alone', () => cross(cargo)),
  }));
  const undoButton = button('Undo', undo);
  const resetButton = button('Reset', () => { loop.stop(); restart(); render(); });
  const solveButton = button('Solve with BFS', solve, { primary: true });

  const loop = createLoop(figure, dt => {
    budget += (dt / 1000) * BFS_RATE;

    while (budget >= 1 && events.length) {
      budget -= 1;
      events.shift()();
    }

    render();

    return events.length > 0;
  });

  loop.onChange(running => {
    budget = running ? 1 : 0;
    render();
  });

  // --- read-outs ---
  const graph = svg('svg', { viewBox: '0 0 736 140', class: 'wgc wgc-graph', role: 'img' });
  const narration = el('p', { class: 'vz-narration', 'aria-live': 'polite', style: 'margin-top:.75rem' });
  const queueLine = el('p', { class: 'vz-note wgc-queue' });
  const stats = { crossings: stat('Crossings'), found: stat('States found'), refused: stat('Moves not allowed') };

  body.append(
    sceneStage,
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' }, actions.map(action => action.node)),
      el('div', { class: 'vz-group' }, undoButton, resetButton, solveButton)),
    narration,
    el('p', { class: 'vz-label', style: 'margin:.9rem 0 .35rem' }, 'State transition diagram (the states found so far)'),
    el('div', { class: 'vz-stage vz-stage--plain vz-scroll' }, graph),
    queueLine,
    el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node))
  );

  // --- state changes ---

  function restart() {
    state = START;
    history = [START];
    discovered = new Set([START]);
    refused = 0;
    visitOrder = new Map();
    solution = [];
    queue = null;
    events = [];
    narration.textContent = 'Everyone starts on the left bank. Choose who goes in the boat with the farmer.';
  }

  function cross(cargo) {
    const move = moves(state).find(m => m.cargo === cargo);

    if (!move) {
      return;
    }

    if (move.problem) {
      const bank = side(state, 'f') ? 'right' : 'left';

      refused += 1;
      narration.textContent = `Not allowed: if the farmer ${verb(cargo)}, ${move.problem} on the ${bank} bank. `
        + `${label(move.next)} breaks the rules, so it is not a state in the diagram.`;
      render();
      return;
    }

    const before = state;
    const revisit = history.includes(move.next);

    state = move.next;
    history.push(state);
    discovered.add(state);

    const crossings = history.length - 1;

    if (state === GOAL) {
      narration.textContent = `${label(before)} → ${label(state)}. Everyone is across after ${crossings} crossings`
        + (crossings === 7 ? ', the fewest possible!' : '. The shortest solution needs 7: can you find it?');
    } else {
      narration.textContent = `${label(before)} → ${label(state)}: the farmer ${verb(cargo)}.`
        + (revisit ? ' You have been in this state before: a search that forgets where it has been can go round in circles.' : '');
    }

    render();
  }

  function undo() {
    if (history.length > 1) {
      history.pop();
      state = history[history.length - 1];
      narration.textContent = `Back to ${label(state)}.`;
      render();
    }
  }

  // Shows breadth-first search from the start: the states in the order they are visited, with the
  // queue after each visit, and then the farmer rows along the path that was found.
  function solve() {
    const result = bfs(START);

    loop.stop();
    restart();
    discovered = new Set();
    queue = [START];
    narration.textContent = 'Breadth-first search starts with node_list = [fwgc|].';

    result.visits.forEach(({ state: visited, queue: after }, i) => {
      events.push(() => {
        visitOrder.set(visited, i + 1);
        discovered.add(visited);
        queue = after;
        narration.textContent = visited === GOAL
          ? `Visit ${i + 1}: ${label(visited)} is the goal, so the search stops. It visited every state of the puzzle on the way.`
          : `Visit ${i + 1}: take ${label(visited)} from the front of the queue and add its unvisited neighbours to the back.`;
      });
    });

    events.push(() => {
      solution = result.path;
      queue = null;
      narration.textContent = `The path back from the goal has ${result.path.length - 1} crossings. Watch the farmer follow it.`;
    });

    result.path.slice(1).forEach(next => {
      events.push(() => {
        state = next;
        history.push(next);
      });
    });

    events.push(() => {
      narration.textContent = `Solved in ${result.path.length - 1} crossings, found without any cleverness: just a queue and a visited set.`;
    });

    if (prefersReducedMotion()) {
      while (events.length) {
        events.shift()();
      }

      render();
    } else {
      render();
      loop.start();
    }
  }

  // --- drawing ---

  function place(node, x, y) {
    node.style.transform = `translate(${x}px, ${y}px)`;
  }

  function renderScene() {
    const { W, BANK, SLOT } = layout;
    const farmer = side(state, 'f');

    ITEMS.forEach(item => {
      const [x, y] = SLOT[item];

      place(tokens[item], side(state, item) ? W - BANK + x : x, y);
    });

    place(boat, farmer ? W - BANK - layout.boat - 8 : BANK + 8, H - 30);
    scene.setAttribute('aria-label', describe(state));
  }

  function renderGraph() {
    const onPath = (a, b) => {
      const pairs = [...(solution.length ? [solution] : []), history];

      return pairs.some(list => list.some((s, i) => i > 0 && ((list[i - 1] === a && s === b) || (list[i - 1] === b && s === a))));
    };

    graph.replaceChildren();

    // Edges run between the centres; the opaque nodes drawn afterwards cover their ends.
    LAYOUT.forEach(([a]) => neighbours(a).forEach(b => {
      if (a < b && discovered.has(a) && discovered.has(b)) {
        const [x1, y1] = POSITION.get(a);
        const [x2, y2] = POSITION.get(b);

        graph.append(svg('line', { class: `wgc-edge${onPath(a, b) ? ' is-travelled' : ''}`, x1, y1, x2, y2 }));
      }
    }));

    LAYOUT.forEach(([s]) => {
      if (!discovered.has(s)) {
        return;
      }

      const [x, y] = POSITION.get(s);
      const classes = ['wgc-node', s === state ? 'is-current' : '', s === GOAL ? 'is-goal' : '', solution.includes(s) ? 'is-solution' : '']
        .filter(Boolean).join(' ');
      const group = svg('g', { class: classes },
        svg('rect', { x: x - NODE_W / 2, y: y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: NODE_H / 2 }),
        svg('text', { x, y: y + 0.5, class: 'wgc-notation' }, notation(s, true)));

      if (visitOrder.has(s)) {
        group.append(
          svg('circle', { class: 'wgc-node__order', cx: x - NODE_W / 2 + 2, cy: y - NODE_H / 2 + 1, r: 8 }),
          svg('text', { class: 'wgc-node__order-text', x: x - NODE_W / 2 + 2, y: y - NODE_H / 2 + 1.5 }, String(visitOrder.get(s))));
      }

      graph.append(group);
    });

    graph.setAttribute('aria-label', `State transition diagram with ${discovered.size} of 10 states found: `
      + `${LAYOUT.filter(([s]) => discovered.has(s)).map(([s]) => label(s)).join(', ')}.`);
  }

  function render() {
    const busy = loop.isRunning();
    const available = new Set(moves(state).map(m => m.cargo));

    renderScene();
    renderGraph();

    actions.forEach(({ cargo, node }) => {
      node.disabled = busy || state === GOAL || !available.has(cargo);
    });
    undoButton.disabled = busy || history.length < 2;
    solveButton.disabled = busy;

    const chips = queue && queue.length
      ? queue.flatMap((s, i) => [i ? ', ' : '', el('span', { class: 'wgc-code' }, notation(s, false))])
      : ['empty'];

    queueLine.replaceChildren(...(queue ? ['node_list (a queue): ', ...chips] : []));

    stats.crossings.set(String(history.length - 1));
    stats.found.set(`${discovered.size} of 10`);
    stats.refused.set(String(refused));
  }

  restart();
  render();

  if ('ResizeObserver' in window) {
    new ResizeObserver(chooseLayout).observe(sceneStage);
  }
}
