// Tabular Q-learning on a small grid world, with the update of Week 6:
//   Q(s, a) <- Q(s, a) + alpha * (target - Q(s, a)),  target = r + gamma * max_a' Q(s', a')
// and target = r when s' ends the episode.

export const COLS = 6;
export const ROWS = 4;
export const START = 3 * COLS + 0;
export const GOAL = 0 * COLS + 5;
export const PIT = 1 * COLS + 3;
export const WALLS = new Set([1 * COLS + 1, 2 * COLS + 1]);
export const GOAL_REWARD = 10;
export const PIT_REWARD = -10;

// Up, right, down, left.
export const ACTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const ACTION_NAMES = ['↑', '→', '↓', '←'];

export function isTerminal(state) {
  return state === GOAL || state === PIT;
}

// Deterministic moves; moving into a wall or off the grid leaves the agent where it is.
export function transition(state, action) {
  const x = state % COLS;
  const y = Math.floor(state / COLS);
  const nx = x + ACTIONS[action][0];
  const ny = y + ACTIONS[action][1];
  let next = state;

  if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !WALLS.has(ny * COLS + nx)) {
    next = ny * COLS + nx;
  }

  const reward = next === GOAL ? GOAL_REWARD : next === PIT ? PIT_REWARD : 0;

  return { next, reward, done: isTerminal(next) };
}

export function createQ() {
  return Array.from({ length: COLS * ROWS }, () => [0, 0, 0, 0]);
}

// The best action; ties are broken at random so that an untrained agent explores evenly.
export function greedy(q, state, random = Math.random) {
  const values = q[state];
  const best = Math.max(...values);
  const choices = values.map((v, a) => (v === best ? a : -1)).filter(a => a >= 0);

  return choices[Math.floor(random() * choices.length)];
}

export function epsilonGreedy(q, state, epsilon, random = Math.random) {
  return random() < epsilon ? Math.floor(random() * ACTIONS.length) : greedy(q, state, random);
}

// One Q-learning update. Returns the numbers of the update for display.
export function update(q, state, action, reward, next, done, alpha, gamma) {
  const old = q[state][action];
  const future = done ? 0 : Math.max(...q[next]);
  const target = reward + gamma * future;
  const error = target - old;

  q[state][action] = old + alpha * error;

  return { old, future, target, error, value: q[state][action] };
}
