import { button, el, fmt, frame, slider } from './lib';

// Next-token scores for the prompt "Artificial intelligence will". The numbers are made up for
// illustration; a real model scores its whole vocabulary (50,257 tokens for GPT-2).
const PROMPT = 'Artificial intelligence will';
const CANDIDATES = [
  [' be', 3.1], [' change', 2.6], [' help', 2.2], [' not', 2.0], [' make', 1.7],
  [' become', 1.5], [' never', 1.1], [' replace', 0.9], [' transform', 0.6], [' purple', -1.5],
];

// As in nanoGPT's generate(): divide the logits by the temperature, keep the logits that are at
// least the k-th largest, and apply softmax.
export function distribution(logits, temperature, topK) {
  const scaled = logits.map(l => l / temperature);
  const kth = [...scaled].sort((a, b) => b - a)[Math.min(topK, scaled.length) - 1];
  const kept = scaled.map(l => (l >= kth ? l : -Infinity));
  const max = Math.max(...kept);
  const exps = kept.map(l => (l === -Infinity ? 0 : Math.exp(l - max)));
  const total = exps.reduce((a, b) => a + b, 0);

  return exps.map(e => e / total);
}

export function entropyBits(probs) {
  return -probs.reduce((sum, p) => (p > 0 ? sum + p * Math.log2(p) : sum), 0);
}

export default function mountSampling(figure) {
  const { body } = frame(figure, 'Temperature and top-k sampling');
  const logits = CANDIDATES.map(([, l]) => l);
  let temperature = 1;
  let topK = CANDIDATES.length;
  let counts = CANDIDATES.map(() => 0);
  let last = null;

  const bars = el('div', { class: 'vz-bars' });
  const text = el('p', { class: 'vz-generated', 'aria-live': 'polite' });
  const info = el('p', { class: 'vz-note' });

  const temperatureControl = slider({
    label: 'Temperature',
    min: 0.1,
    max: 2,
    step: 0.05,
    value: temperature,
    format: v => fmt(v, 2),
    onInput: v => { temperature = v; resetCounts(); },
    width: '9rem',
  });
  const topKControl = slider({
    label: 'top_k',
    min: 1,
    max: CANDIDATES.length,
    value: topK,
    onInput: v => { topK = v; resetCounts(); },
    width: '9rem',
  });

  body.append(
    el('div', { class: 'vz-controls' }, temperatureControl.node, topKControl.node),
    text,
    bars,
    el('div', { class: 'vz-controls' },
      el('div', { class: 'vz-group' },
        button('Sample 1', () => sample(1), { primary: true }),
        button('Sample 100', () => sample(100)),
        button('Clear', () => resetCounts()))),
    info
  );

  function resetCounts() {
    counts = CANDIDATES.map(() => 0);
    last = null;
    render();
  }

  function sample(n) {
    const probs = distribution(logits, temperature, topK);

    for (let s = 0; s < n; s++) {
      let r = Math.random();
      let index = probs.length - 1;

      for (let i = 0; i < probs.length; i++) {
        r -= probs[i];

        if (r < 0) {
          index = i;
          break;
        }
      }

      counts[index] += 1;
      last = index;
    }

    render();
  }

  function render() {
    const probs = distribution(logits, temperature, topK);
    const total = counts.reduce((a, b) => a + b, 0);
    // Bars and sample ticks share one scale, so a tick can sit past the end of its bar.
    const max = Math.max(...probs, ...(total ? counts.map(c => c / total) : []));

    bars.replaceChildren(...CANDIDATES.map(([token], i) => {
      const excluded = probs[i] === 0;
      const share = total ? counts[i] / total : 0;

      return el('div', { class: `vz-bar${excluded ? ' is-excluded' : ''}${i === last ? ' is-last' : ''}` },
        el('span', { class: 'vz-bar__token' }, token.trim()),
        el('div', { class: 'vz-bar__track' },
          el('div', { class: 'vz-bar__fill', style: `width:${(100 * probs[i]) / max}%` }),
          counts[i] ? el('div', { class: 'vz-bar__sample', style: `left:${(100 * share) / max}%`, title: `sampled ${counts[i]} times` }) : null),
        el('b', { class: 'vz-bar__value' }, excluded ? 'cut by top_k' : `${fmt(100 * probs[i], 1)}%`),
        el('span', { class: 'vz-bar__count' }, total ? `${counts[i]}×` : ''));
    }));

    text.replaceChildren(document.createTextNode(PROMPT), last === null ? el('span', { class: 'vz-generated__next' }, ' …') : el('mark', {}, CANDIDATES[last][0]));

    info.textContent = `Entropy of the distribution: ${fmt(entropyBits(probs), 2)} bits (${fmt(Math.log2(CANDIDATES.length), 2)} bits would be uniform over all ${CANDIDATES.length}).`
      + (total ? ` The dark ticks show the share of ${total} samples drawn so far.` : '');
  }

  render();
}
