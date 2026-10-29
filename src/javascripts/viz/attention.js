import { D_K, SENTENCES, WORDS, attention } from './attention-core';
import { COLORS, el, fmt, frame, segmented, sequential, svg } from './lib';

const ARC_W = 640;
const ARC_H = 150;

export default function mountAttention(figure) {
  const { body } = frame(figure, 'Self-attention weights, step by step');
  let sentence = 0;
  let causal = false;
  let selected = 1;

  const arcs = svg('svg', {
    viewBox: `0 0 ${ARC_W} ${ARC_H}`,
    class: 'vz-arcs',
    role: 'img',
    'aria-label': 'The tokens of the sentence with arcs from the selected token to the tokens it attends to; thicker arcs mean larger weights.',
  });
  const tokens = el('div', { class: 'vz-tokens', role: 'group', 'aria-label': 'Query token' });
  const heat = svg('svg', { class: 'vz-heat', role: 'img', 'aria-label': 'Attention weight matrix: rows are queries, columns are keys.' });
  const steps = el('div', { class: 'vz-table-wrap' });
  const plane = svg('svg', { viewBox: '0 0 220 212', class: 'vz-plane', role: 'img', 'aria-label': 'The value vectors and the output vector of the selected token in the (finance, nature) plane.' });
  const summary = el('p', { class: 'vz-narration', 'aria-live': 'polite', style: 'margin:.6rem 0 0' });

  body.append(
    el('div', { class: 'vz-controls' },
      segmented(SENTENCES.map((words, i) => ({ value: i, label: words.join(' ') })), sentence, value => {
        sentence = value;
        selected = SENTENCES[sentence].indexOf('bank');
        render();
      }, 'Sentence').node,
      segmented([
        { value: false, label: 'Bidirectional (encoder, BERT)' },
        { value: true, label: 'Causal mask (decoder, GPT)' },
      ], causal, value => { causal = value; render(); }, 'Attention mask').node),
    el('p', { class: 'vz-label', style: 'margin:.2rem 0 .35rem' }, 'Query token (select one)'),
    tokens,
    el('div', { class: 'vz-stage vz-stage--plain vz-scroll', style: 'margin-top:.5rem' }, arcs),
    summary,
    el('div', { class: 'vz-split', style: 'margin-top:.85rem' },
      el('div', {},
        el('p', { class: 'vz-multiples__title' }, 'softmax(QKᵀ / √dₖ): one row per query'),
        el('div', { class: 'vz-stage vz-stage--plain' }, heat)),
      el('div', {},
        el('p', { class: 'vz-multiples__title' }, 'Output = weighted sum of the values'),
        el('div', { class: 'vz-stage', style: 'background:#fff' }, plane),
        el('ul', { class: 'vz-legend' },
          el('li', {}, el('i', { style: `background:${COLORS.blue};border-radius:50%;opacity:.6` }), 'value vectors (larger = more weight)'),
          el('li', {}, el('i', { style: `background:#fff;border-radius:50%;box-shadow:inset 0 0 0 2px ${COLORS.ink}` }), 'output of the selected token')))),
    steps
  );

  function render() {
    const words = SENTENCES[sentence];
    const rows = attention(words, causal);
    const row = rows[selected];

    tokens.replaceChildren(...words.map((word, i) => el('button', {
      type: 'button',
      class: 'vz-token',
      'aria-pressed': String(i === selected),
      onClick: () => { selected = i; render(); },
    }, word)));

    renderArcs(words, row);
    renderHeat(words, rows);
    renderPlane(words, row);
    renderSteps(words, row);

    const [finance, nature] = row.output;
    const leaning = Math.abs(finance - nature) < 0.1 ? 'is still ambiguous' : finance > nature ? 'leans towards finance' : 'leans towards nature';

    summary.textContent = `The new representation of “${words[selected]}” is (${fmt(finance, 2)}, ${fmt(nature, 2)}): it ${leaning}.`
      + (causal && selected < words.length - 1 ? ' With the causal mask it cannot use the words after it.' : '');
  }

  function renderArcs(words, row) {
    const n = words.length;
    const gap = ARC_W / n;
    const cx = i => gap * (i + 0.5);
    const baseY = ARC_H - 22;
    // Height of the apex above the start of an arc; the control point is twice as high.
    const arcHeight = distance => Math.min(ARC_H - 52, 22 + distance * 0.26);

    arcs.replaceChildren();

    // Only the three largest weights get a number; the table below lists all of them.
    const labelled = new Set(row.weights
      .map((w, j) => [w, j])
      .filter(([w]) => w > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([, j]) => j));

    row.weights.forEach((w, j) => {
      if (w <= 0) {
        return;
      }

      const x1 = cx(selected);
      const x2 = cx(j);
      const width = 1 + 11 * w;
      const opacity = 0.25 + 0.75 * w;

      if (j === selected) {
        arcs.append(svg('path', {
          d: `M${x1 - 10},${baseY - 14} C${x1 - 26},${baseY - 64} ${x1 + 26},${baseY - 64} ${x1 + 10},${baseY - 14}`,
          fill: 'none', stroke: COLORS.blue, 'stroke-width': width, 'stroke-linecap': 'round', opacity,
        }));
      } else {
        const height = arcHeight(Math.abs(x2 - x1));

        arcs.append(svg('path', {
          d: `M${x1},${baseY - 14} Q${(x1 + x2) / 2},${baseY - 14 - height * 2} ${x2},${baseY - 14}`,
          fill: 'none', stroke: COLORS.blue, 'stroke-width': width, 'stroke-linecap': 'round', opacity,
        }));
      }

      if (labelled.has(j)) {
        const lx = j === selected ? x1 : (x1 + x2) / 2;
        const ly = j === selected ? baseY - 58 : baseY - 14 - arcHeight(Math.abs(x2 - x1)) - 5;

        arcs.append(svg('text', { x: lx, y: ly, class: 'vz-arcs__label' }, fmt(w, 2)));
      }
    });

    words.forEach((word, i) => {
      const masked = causal && i > selected;

      arcs.append(svg('text', {
        x: cx(i),
        y: baseY,
        class: `vz-arcs__word${i === selected ? ' is-selected' : ''}${masked ? ' is-masked' : ''}`,
      }, word));
    });
  }

  function renderHeat(words, rows) {
    const n = words.length;
    const cell = 46;
    const left = 74;
    const top = 58;

    heat.setAttribute('viewBox', `0 0 ${left + n * cell + 4} ${top + n * cell + 4}`);
    heat.replaceChildren();

    words.forEach((word, j) => {
      heat.append(svg('text', {
        x: left + j * cell + cell / 2, y: top - 8,
        class: 'vz-heat__key', transform: `rotate(-35 ${left + j * cell + cell / 2} ${top - 8})`,
      }, word));
    });

    rows.forEach((r, i) => {
      heat.append(svg('text', { x: left - 8, y: top + i * cell + cell / 2, class: `vz-heat__query${i === selected ? ' is-selected' : ''}` }, words[i]));

      r.weights.forEach((w, j) => {
        const masked = r.scores[j] === -Infinity;
        const x = left + j * cell;
        const y = top + i * cell;
        const rect = svg('rect', {
          x: x + 1, y: y + 1, width: cell - 2, height: cell - 2, rx: 4,
          fill: masked ? '#f1f5f9' : sequential(0.05 + 0.95 * w),
        });

        rect.append(svg('title', {}, masked
          ? `${words[i]} → ${words[j]}: masked (score −∞, weight 0)`
          : `${words[i]} → ${words[j]}: score ${fmt(r.scores[j], 2)}, weight ${fmt(w, 3)}`));
        heat.append(rect);
        heat.append(svg('text', {
          x: x + cell / 2, y: y + cell / 2 + 1,
          class: `vz-heat__value${w > 0.45 ? ' is-dark' : ''}${masked ? ' is-masked' : ''}`,
        }, masked ? '–' : fmt(w, 2)));
      });
    });

    heat.append(svg('rect', {
      x: left - 1, y: top + selected * cell - 1, width: n * cell + 2, height: cell + 2, rx: 5,
      fill: 'none', stroke: COLORS.ink, 'stroke-width': 2,
    }));
  }

  function renderPlane(words, row) {
    const left = 34;
    const bottom = 176;
    const size = 146;
    const px = v => left + v * size;
    const py = v => bottom - v * size;

    plane.replaceChildren(
      svg('line', { x1: left, y1: bottom, x2: left + size + 10, y2: bottom, stroke: COLORS.axis }),
      svg('line', { x1: left, y1: bottom, x2: left, y2: bottom - size - 10, stroke: COLORS.axis }),
      svg('text', { x: left + size / 2, y: bottom + 28, class: 'vz-plane__axis' }, 'finance →'),
      svg('text', { x: left - 6, y: bottom - size - 14, class: 'vz-plane__axis is-start' }, '↑ nature')
    );

    // Each distinct value vector once, labelled with its words.
    const seen = new Map();

    words.forEach((word, j) => {
      const key = WORDS[word].v.join(',');

      if (!seen.has(key)) {
        seen.set(key, { v: WORDS[word].v, words: new Set(), weight: 0 });
      }

      seen.get(key).words.add(word);
      seen.get(key).weight += row.weights[j];
    });

    seen.forEach(({ v, words: names, weight }) => {
      plane.append(svg('circle', { cx: px(v[0]), cy: py(v[1]), r: 3 + 5 * weight, fill: COLORS.blue, opacity: 0.25 + 0.6 * weight }));

      // Points on the horizontal axis get their label below it, others to the right.
      plane.append(svg('text', {
        x: px(v[0]) + (v[1] === 0 ? 0 : 9),
        y: py(v[1]) + (v[1] === 0 ? 11 : 0),
        class: `vz-plane__label${v[1] === 0 ? ' is-centred' : ''}`,
      }, [...names].join(', ')));
    });

    const [ox, oy] = row.output;

    plane.append(svg('circle', { cx: px(ox), cy: py(oy), r: 7, fill: '#fff', stroke: COLORS.ink, 'stroke-width': 2.5 }));
    plane.append(svg('circle', { cx: px(ox), cy: py(oy), r: 3, fill: COLORS.ink }));
  }

  function renderSteps(words, row) {
    const query = WORDS[words[selected]];
    const vec = v => `(${v.map(x => fmt(x, 1)).join(', ')})`;

    steps.replaceChildren(el('table', { class: 'vz-table' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Key'), el('th', {}, `q · k`), el('th', {}, `÷ √${D_K}`), el('th', {}, 'Weight'), el('th', {}, 'Value v'))),
      el('tbody', {}, words.map((word, j) => {
        const masked = row.scores[j] === -Infinity;

        return el('tr', { class: masked ? 'is-muted' : undefined },
          el('td', {}, word),
          el('td', {}, masked ? 'masked' : fmt(row.raw[j], 2)),
          el('td', {}, masked ? '−∞' : fmt(row.scores[j], 2)),
          el('td', {}, fmt(row.weights[j], 3)),
          el('td', {}, vec(WORDS[word].v)));
      }))),
    el('p', { class: 'vz-note' },
      `Query q = ${vec(query.q)} for “${words[selected]}”. Each word has the same toy vectors in both sentences (chosen by hand, not taken from a trained model), so only the context changes the result.`));
  }

  render();
}
