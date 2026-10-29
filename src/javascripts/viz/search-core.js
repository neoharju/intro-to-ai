// The generic search template of Week 1, on a grid:
//
//   add start_node to node_list
//   while node_list is not empty:
//      node = node_list.first(); remove node from node_list
//      if node not in visited:
//         visited.add(node)
//         if goal_node(node): return node
//         add node.neighbors() to node_list
//
// node_list is a queue (BFS), a stack (DFS) or a min-priority queue ordered by the path cost
// (Dijkstra), by the heuristic (greedy best-first) or by cost + heuristic (A*). A node can be in the
// list several times; the visited check skips the later copies. Neighbours that are already visited
// are not added, which skips the same copies earlier and does not change the order of the search.

export const FREE = 0;
export const WALL = 1;
export const MUD = 2;
export const MUD_COST = 5;

// Up, right, down, left.
const MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// A binary heap; entries with equal keys come out in insertion order.
class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  less(a, b) {
    return a.key < b.key || (a.key === b.key && a.seq < b.seq);
  }

  push(item) {
    const items = this.items;

    items.push(item);

    let i = items.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;

      if (!this.less(items[i], items[parent])) {
        break;
      }

      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();

    if (items.length) {
      items[0] = last;

      let i = 0;

      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;

        if (l < items.length && this.less(items[l], items[m])) {
          m = l;
        }

        if (r < items.length && this.less(items[r], items[m])) {
          m = r;
        }

        if (m === i) {
          break;
        }

        [items[i], items[m]] = [items[m], items[i]];
        i = m;
      }
    }

    return top;
  }
}

function createList(algorithm) {
  if (algorithm === 'bfs') {
    // A queue: an array with a moving head.
    const items = [];
    let head = 0;

    return {
      get size() { return items.length - head; },
      push: item => items.push(item),
      pop: () => items[head++],
    };
  }

  if (algorithm === 'dfs') {
    const items = [];

    return {
      get size() { return items.length; },
      push: item => items.push(item),
      pop: () => items.pop(),
    };
  }

  return new MinHeap();
}

// grid: { cols, rows, cells: Uint8Array (FREE | WALL | MUD) }; start and goal are cell indices.
export function createSearch(grid, start, goal, algorithm) {
  const { cols, cells } = grid;
  const goalX = goal % cols;
  const goalY = Math.floor(goal / cols);

  // Manhattan distance: every move changes it by exactly 1 and costs at least 1, so it never
  // overestimates and is consistent.
  const h = node => Math.abs((node % cols) - goalX) + Math.abs(Math.floor(node / cols) - goalY);

  const keyOf = (node, cost) => {
    if (algorithm === 'dijkstra') {
      return cost;
    }

    if (algorithm === 'greedy') {
      return h(node);
    }

    return cost + h(node);
  };

  const list = createList(algorithm);
  const parent = new Int32Array(cells.length).fill(-1);
  const cost = new Float64Array(cells.length).fill(Infinity);
  const order = new Int32Array(cells.length).fill(-1);
  const inList = new Uint16Array(cells.length);
  let seq = 0;
  let expanded = 0;
  let result = null;

  const add = (node, pathCost, from) => {
    list.push({ node, cost: pathCost, from, key: keyOf(node, pathCost), seq: seq++ });
    inList[node] += 1;
  };

  add(start, 0, -1);

  function neighbours(node) {
    const x = node % cols;
    const y = Math.floor(node / cols);
    const out = [];

    MOVES.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && ny >= 0 && nx < cols && ny < grid.rows) {
        const next = ny * cols + nx;

        if (cells[next] !== WALL) {
          out.push(next);
        }
      }
    });

    return out;
  }

  // One pass of the while loop. Returns the node taken from the list (or -1 when the search ended).
  function step() {
    if (result) {
      return -1;
    }

    if (list.size === 0) {
      result = { found: false };
      return -1;
    }

    const entry = list.pop();

    inList[entry.node] -= 1;

    if (order[entry.node] >= 0) {
      return entry.node;
    }

    order[entry.node] = expanded++;
    parent[entry.node] = entry.from;
    cost[entry.node] = entry.cost;

    if (entry.node === goal) {
      result = { found: true, path: pathTo(goal), cost: entry.cost };
      return entry.node;
    }

    neighbours(entry.node).forEach(next => {
      if (order[next] < 0) {
        add(next, entry.cost + (cells[next] === MUD ? MUD_COST : 1), entry.node);
      }
    });

    return entry.node;
  }

  function pathTo(node) {
    const path = [];

    for (let n = node; n >= 0; n = parent[n]) {
      path.push(n);
    }

    return path.reverse();
  }

  // Passes of the loop until a node is visited for the first time (or the search ends); the copies
  // of visited nodes that are skipped on the way do not change anything on screen.
  function advance() {
    while (!result) {
      const node = step();

      if (node >= 0 && order[node] === expanded - 1) {
        return node;
      }
    }

    return -1;
  }

  return {
    step,
    advance,
    run() {
      while (!result) {
        step();
      }

      return result;
    },
    get result() { return result; },
    get expanded() { return expanded; },
    get listSize() { return list.size; },
    order,
    inList,
    h,
  };
}
