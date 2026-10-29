import { COLORS, createRandom, el, fmt, frame, lineChart, scientific, slider, stat } from './lib';

const MAX_WORDS = 300;
// The smallest positive normal double; below it precision is lost gradually.
const MIN_NORMAL = 2.2250738585072014e-308;
const PRIOR_SPAM = 0.5;

// Word probabilities of a made-up message: around 10^-5 ... 10^-2 per word under each class, with
// the words leaning slightly towards spam.
export function makeMessage() {
  const random = createRandom(42);

  return Array.from({ length: MAX_WORDS }, () => {
    const logHam = -5 + 3 * random();
    const logRatio = 0.15 + 0.5 * random.normal();

    return {
      spam: Math.min(0.05, 10 ** (logHam + logRatio)),
      ham: 10 ** logHam,
    };
  });
}

// Everything is computed with ordinary JavaScript numbers, which are IEEE 754 64-bit floats like
// Python's float.
export function computeAll(words) {
  let spamProduct = PRIOR_SPAM;
  let hamProduct = 1 - PRIOR_SPAM;
  let logR = Math.log(PRIOR_SPAM) - Math.log(1 - PRIOR_SPAM);
  const rows = [];

  words.forEach(word => {
    spamProduct *= word.spam;
    hamProduct *= word.ham;
    logR += Math.log(word.spam) - Math.log(word.ham);
    rows.push({ spamProduct, hamProduct, ratio: spamProduct / hamProduct, logR });
  });

  return rows;
}

export default function mountUnderflow(figure) {
  const { body } = frame(figure, 'Multiplying word probabilities in floating point');
  const rows = computeAll(makeMessage());
  let words = 60;

  const control = slider({
    label: 'Words in the message',
    min: 1,
    max: MAX_WORDS,
    value: words,
    onInput: v => { words = v; update(); },
    width: '12rem',
  });

  const spamStat = stat('P(spam) Π P(word | spam)');
  const hamStat = stat('P(ham) Π P(word | ham)');
  const ratioStat = stat('R from the products');
  const logStat = stat('log R, summed');
  const expStat = stat('R = exp(log R)');
  const posteriorStat = stat('P(spam | message) from log R');

  const chart = lineChart(body, {
    series: [
      { name: 'log10 of P(spam) Π P(word | spam)', color: COLORS.orange },
      { name: 'log10 of P(ham) Π P(word | ham)', color: COLORS.blue },
    ],
    height: 210,
    xLabel: 'words',
    yMin: -360,
    yMax: 0,
    yFormat: v => fmt(v, 0),
    reference: { value: Math.log10(Number.MIN_VALUE), label: 'smallest positive double, 4.9 × 10⁻³²⁴' },
    label: 'Line chart of the base-10 logarithm of both products against the number of words; both lines stop where the product underflows to zero.',
  });

  const note = el('p', { class: 'vz-narration', 'aria-live': 'polite', style: 'margin-top:.75rem' });

  body.prepend(el('div', { class: 'vz-controls' }, control.node));
  body.append(
    el('div', { class: 'vz-stats' }, spamStat.node, hamStat.node, ratioStat.node, logStat.node, expStat.node, posteriorStat.node),
    note
  );

  function update() {
    const shown = rows.slice(0, words);
    const row = shown[shown.length - 1];
    const xs = shown.map((r, i) => i + 1);
    const log10 = x => (x > 0 ? Math.log10(x) : NaN);

    chart.setData(xs, [shown.map(r => log10(r.spamProduct)), shown.map(r => log10(r.hamProduct))]);

    spamStat.set(scientific(row.spamProduct));
    hamStat.set(scientific(row.hamProduct));
    ratioStat.set(scientific(row.ratio));
    logStat.set(fmt(row.logR, 1));
    expStat.set(scientific(Math.exp(row.logR)));

    // P(spam | message) = R / (1 + R) = 1 / (1 + e^(-log R)), computed without forming R.
    const p = 1 / (1 + Math.exp(-row.logR));

    posteriorStat.set(p > 0.999999 ? '> 0.999999' : p < 0.000001 ? '< 0.000001' : fmt(p, 6));

    if (Math.min(row.spamProduct, row.hamProduct) >= MIN_NORMAL) {
      note.textContent = 'Both products are still ordinary doubles, so R = numerator / denominator works, although the numbers are tiny.';
    } else if (row.spamProduct > 0 && row.hamProduct > 0) {
      note.textContent = 'A product is below 2.2 × 10⁻³⁰⁸, where doubles keep fewer and fewer significant digits (subnormal numbers), so R from the products is already inaccurate.';
    } else if (row.spamProduct > 0 || row.hamProduct > 0) {
      note.textContent = 'One product has underflowed to exactly 0, so the ratio of the products is infinite or 0. The log-ratio is unaffected.';
    } else {
      note.textContent = 'Both products have underflowed to 0, and 0 / 0 is NaN ("not a number"). The sum of logarithms still gives the answer.';
    }
  }

  update();
}
