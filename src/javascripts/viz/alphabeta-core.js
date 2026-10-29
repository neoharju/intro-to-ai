// Alpha-beta pruning exactly as in the Week 1 pseudocode, recorded line by line:
//
//     max_value(node, alpha, beta):              min_value(node, alpha, beta):
//  1:   if end_state(node): return value(node)    1:   if end_state(node): return value(node)
//  2:   v = -Inf                                  2:   v = +Inf
//  3:   for each child in node.children():        3:   for each child in node.children():
//  4:      v = max(v, min_value(child, a, b))     4:      v = min(v, max_value(child, a, b))
//  5:      alpha = max(alpha, v)                  5:      beta = min(beta, v)
//  6:      if alpha >= beta: return v             6:      if alpha >= beta: return v
//  7:   return v                                  7:   return v
//
// The tree has a Max root with BRANCHING[0] Min children, each with BRANCHING[1] Max children, each
// with BRANCHING[2] leaves.

export const BRANCHING = [3, 2, 2];
export const LEAF_COUNT = BRANCHING.reduce((a, b) => a * b, 1);

// nodes[0] is the root; children are listed left to right; leaves carry a value.
export function buildTree(leafValues) {
  const nodes = [];
  let leafIndex = 0;

  function add(depth) {
    const id = nodes.length;
    const node = { id, depth, children: [] };

    nodes.push(node);

    if (depth === BRANCHING.length) {
      node.type = 'leaf';
      node.value = leafValues[leafIndex++];
    } else {
      node.type = depth % 2 === 0 ? 'max' : 'min';

      for (let i = 0; i < BRANCHING[depth]; i++) {
        node.children.push(add(depth + 1));
      }
    }

    return id;
  }

  add(0);

  return nodes;
}

export function minimax(nodes, id = 0) {
  const node = nodes[id];

  if (node.type === 'leaf') {
    return node.value;
  }

  const values = node.children.map(child => minimax(nodes, child));

  return node.type === 'max' ? Math.max(...values) : Math.min(...values);
}

// Which values the algorithm has really computed. A leaf's value is exact. A node that pruned some of
// its children only knows a bound: at a Max node the true value is at least v, at a Min node at most
// v. Otherwise v is exact when a child with an exact value attains it; when only bounded children
// attain it, the node inherits their bound. (At a Max node a child that is only a lower bound always
// triggers a cut, so it is the last child examined; the same holds for upper bounds at a Min node.)
function classify(type, prunedChildren, attainingKinds) {
  if (prunedChildren > 0) {
    return type === 'max' ? 'lower' : 'upper';
  }

  if (attainingKinds.has('exact')) {
    return 'exact';
  }

  if (type === 'max') {
    return attainingKinds.has('lower') ? 'lower' : 'upper';
  }

  return attainingKinds.has('upper') ? 'upper' : 'lower';
}

// Returns the list of steps. Every step is a snapshot: which function and line runs, on which node,
// a short note, and for every node its state ('idle' | 'active' | 'done' | 'pruned'), its current or
// returned value and, while its call is on the stack, its own alpha and beta.
export function traceAlphaBeta(nodes) {
  const steps = [];
  const state = nodes.map(() => 'idle');
  const value = nodes.map(() => null);
  const windows = nodes.map(() => null);
  let evaluated = 0;

  const snapshot = (fn, node, line, note) => {
    steps.push({
      fn,
      node,
      line,
      note,
      evaluated,
      state: state.slice(),
      value: value.map(v => (v ? { ...v } : null)),
      windows: windows.map(w => (w ? w.slice() : null)),
    });
  };

  const prune = id => {
    state[id] = 'pruned';
    nodes[id].children.forEach(prune);
  };

  function call(fn, id, alpha, beta) {
    const node = nodes[id];

    state[id] = 'active';
    windows[id] = [alpha, beta];

    if (node.type === 'leaf') {
      evaluated += 1;
      state[id] = 'done';
      windows[id] = null;
      value[id] = { v: node.value, kind: 'exact' };
      snapshot(fn, id, 1, { kind: 'leaf', v: node.value });
      return node.value;
    }

    snapshot(fn, id, 1, { kind: 'enter', alpha, beta });

    let v = fn === 'max' ? -Infinity : Infinity;
    let attaining = new Set();

    value[id] = { v, kind: 'current' };
    snapshot(fn, id, 2, { kind: 'init', v });

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];

      snapshot(fn, id, 3, { kind: 'child', child, index: i });

      const result = call(fn === 'max' ? 'min' : 'max', child, alpha, beta);
      const childKind = value[child].kind;
      const before = v;

      if (fn === 'max' ? result > v : result < v) {
        v = result;
        attaining = new Set([childKind]);
      } else if (result === v) {
        attaining.add(childKind);
      }

      value[id] = { v, kind: 'current' };
      snapshot(fn, id, 4, { kind: 'update', before, result, v });

      if (fn === 'max') {
        alpha = Math.max(alpha, v);
      } else {
        beta = Math.min(beta, v);
      }

      windows[id] = [alpha, beta];
      snapshot(fn, id, 5, { kind: 'bound', alpha, beta });

      if (alpha >= beta) {
        const rest = node.children.slice(i + 1);

        rest.forEach(prune);
        state[id] = 'done';
        windows[id] = null;
        value[id] = { v, kind: classify(node.type, rest.length, attaining) };
        snapshot(fn, id, 6, { kind: 'cut', alpha, beta, v, pruned: rest });
        return v;
      }

      snapshot(fn, id, 6, { kind: 'continue', alpha, beta });
    }

    state[id] = 'done';
    windows[id] = null;
    value[id] = { v, kind: classify(node.type, 0, attaining) };
    snapshot(fn, id, 7, { kind: 'return', v });

    return v;
  }

  call('max', 0, -Infinity, Infinity);

  return steps;
}
