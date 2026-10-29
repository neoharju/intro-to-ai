import { PARENTS, QUERIES, VARIABLES, exactValue, matches, sampleTuple } from './bn-core';
import {
  COLORS, button, createLoop, el, fmt, frame, lineChart, playButton, prefersReducedMotion, select, stat, svg,
} from './lib';

const NAMES = { B: 'Battery', R: 'Radio', I: 'Ignition', G: 'Gas', S: 'Starts', M: 'Moves' };
const POSITION = { B: [130, 64], G: [390, 64], R: [52, 184], I: [236, 184], S: [312, 290], M: [440, 290] };
const R = 30;

function edgePath(from, to) {
  const [x1, y1] = POSITION[from];
  const [x2, y2] = POSITION[to];
  const d = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / d;
  const uy = (y2 - y1) / d;

  return `M${x1 + ux * R},${y1 + uy * R} L${x2 - ux * (R + 6)},${y2 - uy * (R + 6)}`;
}

export default function mountBayesNet(figure) {
  const { body } = frame(figure, 'Monte Carlo estimates from the car network');
  let query = QUERIES[2];
  let exact = exactValue(query);
  let total = 0;
  let evidenceCount = 0;
  let hitCount = 0;
  let history = { xs: [], ys: [] };
  let last = null;
  let reveal = VARIABLES.length;
  let draws = [];
  let animation = null;

  const graph = svg('svg', {
    viewBox: '0 0 480 350',
    class: 'vz-bn',
    role: 'img',
    'aria-label': 'The car network: Battery to Radio and Ignition, Ignition and Gas to Starts, Starts to Moves. Each node shows the value in the latest tuple.',
  });
  const drawing = el('p', { class: 'vz-math vz-bn__drawing', 'aria-live': 'off' });
  const tuple = el('p', { class: 'vz-bn__tuple' });

  const stats = {
    tuples: stat('Tuples n'),
    evidence: stat('Tuples matching the evidence'),
    hits: stat('… also matching the query'),
    estimate: stat('Estimate'),
    exact: stat('Exact (all 64 events)'),
    error: stat('Error'),
  };

  const chart = lineChart(null, {
    series: [{ name: 'estimate', color: COLORS.blue }],
    height: 180,
    xLabel: 'tuples',
    yMin: 0,
    yMax: 1,
    xFormat: v => Math.round(10 ** v).toLocaleString('en-US'),
    reference: { value: exact, label: `exact ${fmt(exact, 3)}` },
    label: 'Line chart of the running estimate against the number of tuples on a logarithmic axis, with the exact value as a horizontal line.',
  });

  // Continuous sampling: the number of tuples per frame grows with n, so the run covers several
  // orders of magnitude in a few seconds.
  const loop = createLoop(figure, () => {
    draw(Math.max(1, Math.round(total / 40)));
    return total < 1_000_000;
  });

  const querySelect = select(QUERIES.map(q => ({ value: q.id, label: q.label })), query.id, id => {
    query = QUERIES.find(q => q.id === id);
    exact = exactValue(query);
    reset();
  }, 'Probability to estimate');

  body.append(
    el('div', { class: 'vz-controls' }, el('span', { class: 'vz-label' }, 'Estimate'), querySelect),
    el('div', { class: 'vz-split' },
      el('div', {},
        el('div', { class: 'vz-stage', style: 'padding:.25rem' }, graph),
        tuple,
        drawing),
      el('div', {},
        el('div', { class: 'vz-stats', style: 'margin-top:0' }, Object.values(stats).map(s => s.node)))),
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        button('Draw 1 tuple', () => { loop.stop(); drawOne(); }),
        button('+100', () => { loop.stop(); draw(100); }, { ariaLabel: 'Draw 100 tuples' }),
        button('+10 000', () => { loop.stop(); draw(10000); }, { ariaLabel: 'Draw 10 000 tuples' }),
        playButton(loop, { play: 'Keep drawing', pause: 'Pause' }),
        button('Reset', () => { loop.stop(); reset(); })))
  );
  body.append(chart.node);

  function count(v) {
    total += 1;

    if (matches(v, query.evidence)) {
      evidenceCount += 1;

      if (matches(v, query.query)) {
        hitCount += 1;
      }
    }
  }

  function record() {
    if (evidenceCount > 0) {
      history.xs.push(Math.log10(total));
      history.ys.push(hitCount / evidenceCount);
    }
  }

  function draw(n) {
    for (let i = 0; i < n; i++) {
      last = sampleTuple();
      count(last);

      // Record at most ~300 points, spread evenly on the logarithmic axis.
      if (i === n - 1 || total < 50 || total % Math.ceil(total / 60) === 0) {
        record();
      }
    }

    reveal = VARIABLES.length;
    draws = [];
    render();
  }

  // One tuple, drawn variable by variable (instantly when reduced motion is preferred).
  function drawOne() {
    const choices = [];
    const v = sampleTuple(Math.random, choice => choices.push(choice));

    count(v);
    record();
    last = v;
    draws = choices;

    if (prefersReducedMotion()) {
      reveal = VARIABLES.length;
      render();
      return;
    }

    reveal = 0;
    window.clearInterval(animation);
    render();
    animation = window.setInterval(() => {
      reveal += 1;
      render();

      if (reveal >= VARIABLES.length) {
        window.clearInterval(animation);
      }
    }, 260);
  }

  function reset() {
    window.clearInterval(animation);
    total = 0;
    evidenceCount = 0;
    hitCount = 0;
    history = { xs: [], ys: [] };
    last = null;
    draws = [];
    reveal = VARIABLES.length;
    chart.setReference({ value: exact, label: `exact ${fmt(exact, 3)}` });
    render();
  }

  function render() {
    graph.replaceChildren(svg('defs', {},
      svg('marker', { id: 'vz-bn-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
        svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: COLORS.muted }))));

    VARIABLES.forEach(name => PARENTS[name].forEach(parent => {
      graph.append(svg('path', { d: edgePath(parent, name), stroke: COLORS.muted, 'stroke-width': 1.6, fill: 'none', 'marker-end': 'url(#vz-bn-arrow)' }));
    }));

    const inQuery = { ...query.evidence, ...query.query };

    VARIABLES.forEach((name, i) => {
      const [x, y] = POSITION[name];
      const shown = last && i < reveal;
      const value = shown ? last[name] : null;
      const active = draws.length && i === reveal - 1;

      graph.append(svg('circle', {
        cx: x, cy: y, r: R,
        fill: value === 1 ? COLORS.blue : '#ffffff',
        stroke: active ? '#b45309' : value === null ? COLORS.axis : COLORS.blue,
        'stroke-width': active ? 3 : 1.6,
      }));
      graph.append(svg('text', {
        x, y: y + 1, class: `vz-bn__letter${value === 1 ? ' is-on' : value === null ? ' is-unknown' : ''}`,
      }, value === 0 ? `¬${name}` : name));
      graph.append(svg('text', { x, y: y + R + 14, class: 'vz-bn__name' }, NAMES[name]));

      if (name in inQuery) {
        const tag = name in query.evidence
          ? `evidence ${query.evidence[name] ? name : `¬${name}`}`
          : `query ${query.query[name] ? name : `¬${name}`}`;
        const width = 12 + tag.length * 6.4;

        graph.append(svg('rect', { x: x - width / 2, y: y - R - 19, width, height: 17, rx: 8.5, fill: '#fffbeb', stroke: '#fde68a' }));
        graph.append(svg('text', { x, y: y - R - 10, class: 'vz-bn__tag' }, tag));
      }
    });

    if (last) {
      const parts = VARIABLES.map((name, i) => (i < reveal ? `${name}=${last[name]}` : `${name}=?`));
      const done = reveal >= VARIABLES.length;
      const fitsEvidence = matches(last, query.evidence);
      const fitsBoth = fitsEvidence && matches(last, query.query);
      const evidenceText = Object.keys(query.evidence).length
        ? (fitsEvidence ? 'matches the evidence' : 'does not match the evidence, so it is not counted')
        : '';
      const verdict = done
        ? ` It ${[evidenceText, fitsEvidence ? (fitsBoth ? 'matches the query' : 'does not match the query') : ''].filter(Boolean).join(' and ')}.`
        : '';

      tuple.textContent = `Latest tuple: ${parts.join(' ')}.${verdict}`;
    } else {
      tuple.textContent = 'No tuples yet.';
    }

    const choice = draws[reveal - 1];

    if (choice && reveal <= VARIABLES.length && draws.length) {
      const given = choice.parents.length
        ? ` given ${choice.parents.map(([p, value]) => `${p}=${value}`).join(', ')}`
        : '';

      drawing.textContent = `${choice.name}${given}: P(${choice.name}=0) = ${fmt(choice.p0, 2)}, r = ${fmt(choice.r, 3)} `
        + `${choice.r < choice.p0 ? '<' : '≥'} ${fmt(choice.p0, 2)}, so ${choice.name} = ${choice.value}.`;
    } else {
      drawing.textContent = '';
    }

    const estimate = evidenceCount ? hitCount / evidenceCount : NaN;

    stats.tuples.set(total.toLocaleString('en-US'));
    stats.evidence.set(Object.keys(query.evidence).length ? evidenceCount.toLocaleString('en-US') : 'all');
    stats.hits.set(hitCount.toLocaleString('en-US'));
    stats.estimate.set(Number.isFinite(estimate) ? fmt(estimate, 4) : '–');
    stats.exact.set(fmt(exact, 4));
    stats.error.set(Number.isFinite(estimate) ? fmt(Math.abs(estimate - exact), 4) : '–');
    chart.setData(history.xs, [history.ys]);
  }

  reset();
}
