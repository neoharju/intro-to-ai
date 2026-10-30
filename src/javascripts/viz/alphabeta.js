import { LEAF_COUNT, buildTree, minimax, traceAlphaBeta } from './alphabeta-core';
import {
  COLORS, button, checkbox, createLoop, createRandom, el, fmt, frame, playButton, slider, stat, svg,
} from './lib';

const DEFAULT_LEAVES = [3, 5, 6, 9, 1, 2, 0, -1, 7, 4, 2, 8];
const STEPS_PER_SECOND = [1, 2, 3, 5, 8, 12];

const W = 640;
const H = 300;
const LEVEL_Y = [34, 112, 190, 262];

const MAX_CODE = [
  '    max_value(node, alpha, beta):',
  '1:     if end_state(node): return value(node)',
  '2:     v = -Inf',
  '3:     for each child in node.children():',
  '4:        v = max(v, min_value(child, alpha, beta))',
  '5:        alpha = max(alpha, v)',
  '6:        if alpha >= beta: return v',
  '7:     return v',
];

const MIN_CODE = MAX_CODE.map(line => line
  .replace('max_value', 'MIN_TMP').replace('min_value', 'max_value').replace('MIN_TMP', 'min_value')
  .replace('-Inf', '+Inf').replace('v = max(v,', 'v = min(v,')
  .replace('alpha = max(alpha, v)', 'beta = min(beta, v)'));

const num = v => fmt(v, 0);

// Node names: R for the root, A-C below it, A1-C2 below them, leaves a-l.
function names(nodes) {
  const result = [];
  let leaf = 0;

  nodes.forEach(node => {
    if (node.depth === 0) {
      result[node.id] = 'R';
    } else if (node.type === 'leaf') {
      result[node.id] = String.fromCharCode(97 + leaf++);
    }
  });

  nodes[0].children.forEach((a, i) => {
    const letter = String.fromCharCode(65 + i);

    result[a] = letter;
    nodes[a].children.forEach((b, j) => { result[b] = `${letter}${j + 1}`; });
  });

  return result;
}

// Leaf values reordered so that every node examines its best child first (by minimax value).
function bestFirst(leaves) {
  const nodes = buildTree(leaves);

  function order(id) {
    const node = nodes[id];

    if (node.type === 'leaf') {
      return [node.value];
    }

    const children = node.children.slice().sort((a, b) => (node.type === 'max'
      ? minimax(nodes, b) - minimax(nodes, a)
      : minimax(nodes, a) - minimax(nodes, b)));

    return children.flatMap(order);
  }

  return order(0);
}

function layout(nodes) {
  const position = [];
  const gap = (W - 80) / LEAF_COUNT;
  let leaf = 0;

  function place(id) {
    const node = nodes[id];

    if (node.type === 'leaf') {
      position[id] = [64 + gap * (leaf++ + 0.5), LEVEL_Y[node.depth]];
    } else {
      node.children.forEach(place);

      const xs = node.children.map(c => position[c][0]);

      position[id] = [(Math.min(...xs) + Math.max(...xs)) / 2, LEVEL_Y[node.depth]];
    }
  }

  place(0);

  return position;
}

export default function mountAlphaBeta(figure) {
  const { body } = frame(figure, 'Alpha-beta pruning, one line of pseudocode at a time');
  const random = createRandom(2024);
  let leaves = DEFAULT_LEAVES.slice();
  let sorted = false;
  let nodes;
  let steps;
  let label;
  let position;
  let index = 0;
  let speed = 3;
  let budget = 0;

  const tree = svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'vz-tree',
    role: 'img',
    'aria-label': 'Game tree with a Max root, Min nodes, Max nodes and leaves; the current node, its alpha and beta, and pruned branches are marked.',
  });

  const narration = el('p', { class: 'vz-narration', 'aria-live': 'polite' });
  const stack = el('p', { class: 'vz-note vz-math' });
  const maxCode = el('div', { class: 'vz-code', 'aria-label': 'max_value pseudocode' });
  const minCode = el('div', { class: 'vz-code', 'aria-label': 'min_value pseudocode' });
  const stats = { step: stat('Step'), leaves: stat('Leaves evaluated'), root: stat('Value of the game') };

  const loop = createLoop(figure, dt => {
    budget += (dt / 1000) * STEPS_PER_SECOND[speed - 1];

    while (budget >= 1 && index < steps.length - 1) {
      budget -= 1;
      index += 1;
    }

    render();

    return index < steps.length - 1;
  });

  // While playing, the narration is not announced line by line.
  loop.onChange(running => {
    budget = 0;
    narration.setAttribute('aria-live', running ? 'off' : 'polite');

    if (running && index >= steps.length - 1) {
      index = 0;
    }
  });

  const back = button('◀ Back', () => { loop.stop(); index = Math.max(0, index - 1); render(); }, { ariaLabel: 'Previous step' });
  const next = button('Step ▶', () => { loop.stop(); index = Math.min(steps.length - 1, index + 1); render(); }, { ariaLabel: 'Next step' });
  const reset = button('Reset', () => { loop.stop(); index = 0; render(); });
  const speedControl = slider({
    label: 'Speed',
    min: 1,
    max: STEPS_PER_SECOND.length,
    value: speed,
    format: v => `${STEPS_PER_SECOND[v - 1]}/s`,
    onInput: v => { speed = v; },
    width: '5rem',
  });
  const newValues = button('New values', () => {
    leaves = Array.from({ length: LEAF_COUNT }, () => random.int(19) - 9);
    rebuild();
  });
  const order = checkbox('Best child first', sorted, value => {
    sorted = value;
    rebuild();
  });

  body.append(
    el('div', { class: 'vz-stage vz-stage--plain vz-scroll' }, tree),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' }, back, next, playButton(loop), reset),
      speedControl.node,
      el('div', { class: 'vz-group' }, newValues, order.node)),
    el('div', { class: 'vz-split vz-split--even', style: 'margin-top:.85rem' },
      el('div', {},
        el('div', { class: 'vz-panel' }, el('h5', {}, 'What happens'), narration, stack),
        el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node))),
      el('div', {}, maxCode, el('div', { style: 'height:.5rem' }), minCode))
  );

  function rebuild() {
    loop.stop();
    nodes = buildTree(sorted ? bestFirst(leaves) : leaves);
    steps = traceAlphaBeta(nodes);
    label = names(nodes);
    position = layout(nodes);
    index = 0;
    render();
  }

  function describe(step) {
    const n = step.note;
    const call = `${step.fn}_value(${nodeName(step.node)})`;

    switch (n.kind) {
      case 'leaf':
        return `${call}: leaf ${label[step.node]} is an end state, so return its value ${num(n.v)}.`;
      case 'enter':
        return `${call} is called with alpha = ${num(n.alpha)} and beta = ${num(n.beta)}. It is not an end state.`;
      case 'init':
        return `Line 2: v = ${num(n.v)}.`;
      case 'child':
        return `Line 3: next child ${nodeName(n.child)}.`;
      case 'update':
        return `Line 4: v = ${step.fn}(${num(n.before)}, ${num(n.result)}) = ${num(n.v)}.`;
      case 'bound':
        return step.fn === 'max'
          ? `Line 5: alpha = max(alpha, v) = ${num(n.alpha)}.`
          : `Line 5: beta = min(beta, v) = ${num(n.beta)}.`;
      case 'continue':
        return `Line 6: alpha < beta (${num(n.alpha)} < ${num(n.beta)}), so keep going.`;
      case 'cut': {
        const pruned = n.pruned.map(nodeName);
        const rest = pruned.length
          ? ` The remaining ${pruned.length === 1 ? 'child' : 'children'} (${pruned.join(', ')}) ${pruned.length === 1 ? 'is' : 'are'} pruned: ${step.fn === 'max' ? 'Min' : 'Max'} already has a better option elsewhere.`
          : ' There were no more children to examine.';

        return `Line 6: alpha ≥ beta (${num(n.alpha)} ≥ ${num(n.beta)}), so return v = ${num(n.v)} now.${rest}`;
      }
      case 'return':
        return `Line 7: all children examined, return v = ${num(n.v)}.`;
      default:
        return '';
    }
  }

  function nodeName(id) {
    return nodes[id].type === 'leaf' ? `leaf ${label[id]}` : label[id];
  }

  function valueText(entry) {
    if (!entry) {
      return '';
    }

    const prefix = entry.kind === 'lower' ? '≥' : entry.kind === 'upper' ? '≤' : '';

    return `${prefix}${num(entry.v)}`;
  }

  function render() {
    const step = steps[index];

    tree.replaceChildren();

    // Edges first.
    nodes.forEach(node => node.children.forEach(child => {
      const [x1, y1] = position[node.id];
      const [x2, y2] = position[child];
      const pruned = step.state[child] === 'pruned';
      const used = step.state[child] === 'done' || step.state[child] === 'active';

      tree.append(svg('line', {
        x1, y1: y1 + 14, x2, y2: y2 - 14,
        stroke: used ? COLORS.muted : COLORS.axis,
        'stroke-width': used ? 1.6 : 1.2,
        opacity: pruned ? 0.35 : 1,
      }));

      // A cut across the edge into a pruned subtree whose parent was not pruned itself.
      if (pruned && step.state[node.id] !== 'pruned') {
        const mx = (x1 + x2) / 2;
        const my = (y1 + 14 + y2 - 14) / 2;
        const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        const dx = Math.cos(angle) * 9;
        const dy = Math.sin(angle) * 9;

        [-3, 3].forEach(offset => {
          const ox = Math.cos(angle - Math.PI / 2) * offset;
          const oy = Math.sin(angle - Math.PI / 2) * offset;

          tree.append(svg('line', {
            x1: mx - dx + ox, y1: my - dy + oy, x2: mx + dx + ox, y2: my + dy + oy,
            stroke: COLORS.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round',
          }));
        });
      }
    }));

    nodes.forEach(node => {
      const [x, y] = position[node.id];
      const state = step.state[node.id];
      const current = node.id === step.node;
      const group = svg('g', { opacity: state === 'pruned' ? 0.32 : 1 });
      const fill = state === 'done' ? COLORS.primarySoft : state === 'active' ? COLORS.amberSoft : COLORS.surface;
      const stroke = current ? COLORS.amber : state === 'done' ? COLORS.blue : state === 'active' ? COLORS.yellow : COLORS.axis;
      const strokeWidth = current ? 2.6 : state === 'idle' || state === 'pruned' ? 1.2 : 1.8;

      if (node.type === 'leaf') {
        group.append(svg('rect', {
          x: x - 15, y: y - 13, width: 30, height: 26, rx: 6,
          fill, stroke, 'stroke-width': strokeWidth,
        }));
        group.append(svg('text', {
          x, y: y + 1, class: state === 'done' ? 'vz-tree__value' : 'vz-tree__value is-muted',
        }, num(node.value)));
        group.append(svg('text', { x, y: y + 27, class: 'vz-tree__name' }, label[node.id]));
      } else {
        const up = node.type === 'max';
        const points = up
          ? `${x},${y - 18} ${x + 21},${y + 14} ${x - 21},${y + 14}`
          : `${x},${y + 18} ${x + 21},${y - 14} ${x - 21},${y - 14}`;

        group.append(svg('polygon', { points, fill, stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' }));
        group.append(svg('text', { x, y: up ? y + 5 : y - 3, class: 'vz-tree__value' }, valueText(step.value[node.id])));
        group.append(svg('text', { x: x - 30, y: y + 1, class: 'vz-tree__name vz-tree__name--side' }, label[node.id]));

        const window = step.windows[node.id];

        if (window) {
          const text = `α ${num(window[0])} · β ${num(window[1])}`;
          const px = node.depth === 2 ? x : x + 30;
          const py = node.depth === 2 ? y - 32 : y - 1;
          const anchor = node.depth === 2 ? 'middle' : 'start';
          const width = 8 + text.length * 6.2;
          const left = anchor === 'middle' ? px - width / 2 : px;

          group.append(svg('rect', {
            x: left, y: py - 10, width, height: 19, rx: 9.5,
            fill: COLORS.amberSoft, stroke: COLORS.amberLine,
          }));
          group.append(svg('text', { x: left + width / 2, y: py, class: 'vz-tree__window' }, text));
        }
      }

      tree.append(group);
    });

    // Level labels.
    ['MAX', 'MIN', 'MAX'].forEach((text, depth) => {
      tree.append(svg('text', { x: 4, y: LEVEL_Y[depth] + 1, class: 'vz-tree__level' }, text));
    });

    // Code listings.
    [[maxCode, MAX_CODE, 'max'], [minCode, MIN_CODE, 'min']].forEach(([node, lines, fn]) => {
      node.replaceChildren(...lines.map((line, i) => el('div', {
        class: step.fn === fn ? (i === step.line ? 'is-active' : undefined) : 'is-muted',
      }, line)));
    });

    narration.textContent = describe(step);

    const open = nodes.filter(node => step.windows[node.id])
      .sort((a, b) => a.depth - b.depth)
      .map(node => `${node.type}_value(${label[node.id]}, α=${num(step.windows[node.id][0])}, β=${num(step.windows[node.id][1])})`);

    stack.textContent = open.length ? `Call stack: ${open.join(' → ')}` : 'Call stack: empty';

    stats.step.set(`${index + 1} / ${steps.length}`);
    stats.leaves.set(`${step.evaluated} of ${LEAF_COUNT}`);

    const root = step.value[0];

    stats.root.set(step.state[0] === 'done' ? `${num(root.v)} (plain minimax: ${num(minimax(nodes))})` : '–');
    back.disabled = index === 0;
    next.disabled = index === steps.length - 1;
  }

  rebuild();
}
