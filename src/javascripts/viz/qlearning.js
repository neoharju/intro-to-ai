import {
  ACTIONS, ACTION_NAMES, COLS, GOAL, GOAL_REWARD, PIT, PIT_REWARD, ROWS, START, WALLS, createQ, epsilonGreedy,
  transition, update,
} from './qlearning-core';
import {
  COLORS, button, createCanvas, createLoop, diverging, el, fmt, frame, legend, lineChart, playButton, slider, stat,
} from './lib';

const MAX_MOVES = 100;
const MOVES_PER_SECOND = [2, 5, 15, 60, 250, 1000];

export default function mountQLearning(figure) {
  const { body } = frame(figure, 'Q-learning in a small grid world');
  let q = createQ();
  let state = START;
  let alpha = 0.5;
  let gamma = 0.9;
  let epsilon = 0.2;
  let speed = 2;
  let budget = 0;
  let episode = 1;
  let moves = 0;
  let trail = [START];
  let last = null;
  let history = { xs: [], ys: [] };
  let outcomes = { goal: 0, pit: 0, timeout: 0 };

  const stage = el('div', { class: 'vz-stage', style: 'background:#fff' });
  const view = createCanvas(stage, {
    aspect: ROWS / COLS,
    minHeight: 160,
    maxHeight: 420,
    label: 'Grid world with a start, a goal worth +10 and a pit worth −10. Each cell is split into four triangles coloured by the Q-value of moving up, right, down or left; arrows show the best action.',
    onResize: () => draw(),
  });

  const explanation = el('div', { class: 'vz-math', 'aria-live': 'off' });
  const stats = {
    episode: stat('Episode'),
    moves: stat('Moves this episode'),
    outcomes: stat('Goal / pit / timeout'),
  };
  const chart = lineChart(null, {
    series: [{ name: 'moves', color: COLORS.violet }],
    height: 130,
    xLabel: 'episode',
    yMin: 0,
    yFormat: v => fmt(v, 0),
    integer: true,
    label: 'Line chart of the number of moves in each finished episode.',
  });

  const loop = createLoop(figure, dt => {
    budget += (dt / 1000) * MOVES_PER_SECOND[speed - 1];

    let steps = 0;

    while (budget >= 1 && steps < 400) {
      budget -= 1;
      steps += 1;
      move();
    }

    draw();
  });

  loop.onChange(running => {
    budget = 0;
    explanation.setAttribute('aria-live', running ? 'off' : 'polite');
  });

  const controls = {
    alpha: slider({ label: 'Learning rate α', min: 0.05, max: 1, step: 0.05, value: alpha, format: v => fmt(v, 2), onInput: v => { alpha = v; }, width: '7rem' }),
    gamma: slider({ label: 'Discount γ', min: 0, max: 0.99, step: 0.01, value: gamma, format: v => fmt(v, 2), onInput: v => { gamma = v; }, width: '7rem' }),
    epsilon: slider({ label: 'Exploration ε', min: 0, max: 1, step: 0.05, value: epsilon, format: v => fmt(v, 2), onInput: v => { epsilon = v; }, width: '7rem' }),
    speed: slider({ label: 'Speed', min: 1, max: MOVES_PER_SECOND.length, value: speed, format: v => `${MOVES_PER_SECOND[v - 1]}/s`, onInput: v => { speed = v; }, width: '6rem' }),
  };

  body.append(
    el('div', { class: 'vz-split' },
      el('div', {}, stage,
        legend([
          { style: `background:linear-gradient(90deg, ${diverging(-1, COLORS.red, COLORS.blue)}, #f0efec, ${diverging(1, COLORS.red, COLORS.blue)})`, label: 'Q-value from −10 to +10' },
          { color: COLORS.ink, label: 'Agent' },
        ])),
      el('div', {},
        el('div', { class: 'vz-panel' }, el('h5', {}, 'Last update'), explanation),
        el('div', { class: 'vz-stats' }, Object.values(stats).map(s => s.node)))),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        button('Step', () => { loop.stop(); move(); draw(); }, { ariaLabel: 'Take one action' }),
        playButton(loop),
        button('Forget', () => { loop.stop(); reset(); }, { ariaLabel: 'Reset all Q-values to zero' })),
      controls.speed.node),
    el('div', { class: 'vz-controls' }, controls.alpha.node, controls.gamma.node, controls.epsilon.node),
    el('p', { class: 'vz-multiples__title', style: 'margin-top:.85rem' }, 'Moves per episode'),
    chart.node
  );

  function move() {
    const action = epsilonGreedy(q, state, epsilon);
    const { next, reward, done } = transition(state, action);
    const numbers = update(q, state, action, reward, next, done, alpha, gamma);

    last = { state, action, reward, next, done, ...numbers, alpha, gamma };
    moves += 1;
    trail.push(next);
    state = next;

    if (done || moves >= MAX_MOVES) {
      outcomes[next === GOAL ? 'goal' : next === PIT ? 'pit' : 'timeout'] += 1;
      history.xs.push(episode);
      history.ys.push(moves);

      if (history.xs.length > 400) {
        history.xs.shift();
        history.ys.shift();
      }

      episode += 1;
      moves = 0;
      state = START;
      trail = [START];
    }
  }

  function reset() {
    q = createQ();
    state = START;
    episode = 1;
    moves = 0;
    trail = [START];
    last = null;
    history = { xs: [], ys: [] };
    outcomes = { goal: 0, pit: 0, timeout: 0 };
    draw();
  }

  function cellRect(index, cell, ox, oy) {
    return [ox + (index % COLS) * cell, oy + Math.floor(index / COLS) * cell];
  }

  function draw() {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    const cell = Math.floor(Math.min(width / COLS, height / ROWS));
    const ox = Math.floor((width - cell * COLS) / 2);
    const oy = Math.floor((height - cell * ROWS) / 2);
    const showNumbers = cell >= 78;

    ctx.clearRect(0, 0, width, height);
    ctx.font = `${showNumbers ? 11 : 10}px "Inter Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let s = 0; s < COLS * ROWS; s++) {
      const [x, y] = cellRect(s, cell, ox, oy);
      const cx = x + cell / 2;
      const cy = y + cell / 2;

      if (WALLS.has(s)) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, cell, cell);
        continue;
      }

      if (s === GOAL || s === PIT) {
        ctx.fillStyle = s === GOAL ? diverging(1, COLORS.red, COLORS.blue) : diverging(-1, COLORS.red, COLORS.blue);
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.round(cell * 0.2)}px "Inter Variable", system-ui, sans-serif`;
        ctx.fillText(s === GOAL ? `+${GOAL_REWARD}` : `${PIT_REWARD}`.replace('-', '−'), cx, cy - cell * 0.08);
        ctx.font = `600 ${Math.max(9, Math.round(cell * 0.12))}px "Inter Variable", system-ui, sans-serif`;
        ctx.fillText(s === GOAL ? 'goal' : 'pit', cx, cy + cell * 0.16);
        ctx.font = `${showNumbers ? 11 : 10}px "Inter Variable", system-ui, sans-serif`;
        continue;
      }

      // Four triangles: up, right, down, left.
      const corners = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]];

      ACTIONS.forEach((a, i) => {
        const [p1, p2] = [corners[i], corners[(i + 1) % 4]];

        ctx.fillStyle = diverging(q[s][i] / 10, COLORS.red, COLORS.blue);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (showNumbers) {
          ctx.fillStyle = Math.abs(q[s][i]) > 6 ? '#fff' : COLORS.ink;
          ctx.fillText(fmt(q[s][i], 1), cx + a[0] * cell * 0.33, cy + a[1] * cell * 0.33);
        }
      });

      if (s === START) {
        ctx.fillStyle = COLORS.muted;
        ctx.font = `600 ${Math.max(9, Math.round(cell * 0.11))}px "Inter Variable", system-ui, sans-serif`;
        ctx.fillText('start', cx, y + cell - Math.max(8, cell * 0.08));
        ctx.font = `${showNumbers ? 11 : 10}px "Inter Variable", system-ui, sans-serif`;
      }

      // Arrow for the best action, when there is a single best one.
      const best = Math.max(...q[s]);

      if (best !== 0 && q[s].filter(v => v === best).length === 1) {
        const a = ACTIONS[q[s].indexOf(best)];
        const length = cell * (showNumbers ? 0.09 : 0.16);

        ctx.strokeStyle = COLORS.ink;
        ctx.fillStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - a[0] * length, cy - a[1] * length);
        ctx.lineTo(cx + a[0] * length, cy + a[1] * length);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + a[0] * (length + 5), cy + a[1] * (length + 5));
        ctx.lineTo(cx + a[0] * length - a[1] * 4, cy + a[1] * length + a[0] * 4);
        ctx.lineTo(cx + a[0] * length + a[1] * 4, cy + a[1] * length - a[0] * 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // The path of the current episode and the agent.
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(15, 23, 42, .3)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      trail.forEach((s, i) => {
        const [x, y] = cellRect(s, cell, ox, oy);

        if (i === 0) {
          ctx.moveTo(x + cell / 2, y + cell / 2);
        } else {
          ctx.lineTo(x + cell / 2, y + cell / 2);
        }
      });
      ctx.stroke();
    }

    const [ax, ay] = cellRect(state, cell, ox, oy);

    ctx.beginPath();
    ctx.arc(ax + cell / 2, ay + cell / 2, Math.max(6, cell * 0.13) + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ax + cell / 2, ay + cell / 2, Math.max(6, cell * 0.13), 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ink;
    ctx.fill();

    describe();
  }

  function describe() {
    stats.episode.set(String(episode));
    stats.moves.set(String(moves));
    stats.outcomes.set(`${outcomes.goal} / ${outcomes.pit} / ${outcomes.timeout}`);
    chart.setData(history.xs, [history.ys]);

    if (!last) {
      explanation.replaceChildren(el('p', { style: 'margin:0' },
        'All Q-values start at 0. The agent chooses the best known action, or a random one with probability ε.'));
      return;
    }

    const { action, reward, done, old, future, target, error, value } = last;
    const lines = [
      `Action ${ACTION_NAMES[action]}, reward r = ${fmt(reward, 0)}${done ? ', episode ends' : ''}.`,
      done
        ? `target = r = ${fmt(target, 2)} (no future value after the end)`
        : `target = r + γ·max Q(s′, a′) = ${fmt(reward, 0)} + ${fmt(last.gamma, 2)} × ${fmt(future, 2)} = ${fmt(target, 2)}`,
      `TD error = target − old = ${fmt(target, 2)} − ${fmt(old, 2)} = ${fmt(error, 2)}`,
      `new Q(s, ${ACTION_NAMES[action]}) = ${fmt(old, 2)} + ${fmt(last.alpha, 2)} × ${fmt(error, 2)} = ${fmt(value, 2)}`,
    ];

    explanation.replaceChildren(...lines.map(text => el('p', { style: 'margin:0 0 .2rem' }, text)));
  }

  draw();
}
