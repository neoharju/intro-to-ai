// The Wolf, Goat and Cabbage puzzle of Week 1 as a search problem. A state says on which bank each of
// the farmer, the wolf, the goat and the cabbage is (0 = left, 1 = right), packed into four bits fwgc.

export const ITEMS = ['f', 'w', 'g', 'c'];
export const NAMES = { f: 'farmer', w: 'wolf', g: 'goat', c: 'cabbage' };

const BIT = { f: 8, w: 4, g: 2, c: 1 };

export const START = 0b0000;
export const GOAL = 0b1111;

export const side = (state, item) => ((state & BIT[item]) ? 1 : 0);

// Why a state is not allowed, or null when it is: the wolf eats the goat, and the goat eats the
// cabbage, when the two are on a bank without the farmer.
export function problem(state) {
  const farmer = side(state, 'f');
  const goat = side(state, 'g');
  const reasons = [];

  if (goat !== farmer && side(state, 'w') === goat) {
    reasons.push('the wolf eats the goat');
  }

  if (goat !== farmer && side(state, 'c') === goat) {
    reasons.push('the goat eats the cabbage');
  }

  return reasons.length ? reasons.join(' and ') : null;
}

// The notation of the page: the items on the left bank, '|' for the river, the items on the right bank.
export function label(state) {
  const left = ITEMS.filter(item => !side(state, item)).join('');
  const right = ITEMS.filter(item => side(state, item)).join('');

  return `${left}|${right}`;
}

// The farmer rows across alone (cargo null) or with one item from the same bank. Moves into states
// that are not allowed are listed too, with the reason, so that the interface can explain them.
export function moves(state) {
  const farmer = side(state, 'f');

  return [null, 'w', 'g', 'c']
    .filter(cargo => cargo === null || side(state, cargo) === farmer)
    .map(cargo => {
      const next = state ^ BIT.f ^ (cargo ? BIT[cargo] : 0);

      return { cargo, next, problem: problem(next) };
    });
}

export const neighbours = state => moves(state).filter(move => !move.problem).map(move => move.next);

// Breadth-first search with the template of the page: take the first node from the queue, skip it if it
// was visited, otherwise visit it, stop at the goal, and add its neighbours to the end of the queue.
// Returns every visit with the queue after it, and the path to the goal.
export function bfs(start = START) {
  const queue = [{ state: start, from: -1 }];
  const parent = new Map();
  const visits = [];

  while (queue.length) {
    const { state, from } = queue.shift();

    if (parent.has(state)) {
      continue;
    }

    parent.set(state, from);

    if (state === GOAL) {
      visits.push({ state, queue: queue.map(entry => entry.state) });
      break;
    }

    neighbours(state).forEach(next => {
      if (!parent.has(next)) {
        queue.push({ state: next, from: state });
      }
    });

    visits.push({ state, queue: queue.map(entry => entry.state) });
  }

  const path = [];

  for (let state = GOAL; parent.has(state) && state !== -1; state = parent.get(state)) {
    path.push(state);
  }

  return { visits, path: path.reverse() };
}

// Every allowed state reachable from the start (the nodes of the state transition diagram).
export function reachable(start = START) {
  const seen = new Set([start]);
  const stack = [start];

  while (stack.length) {
    neighbours(stack.pop()).forEach(next => {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    });
  }

  return seen;
}
