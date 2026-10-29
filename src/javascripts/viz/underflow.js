import { COLORS, createRandom, el, fmt, frame, legend, lineChart, scientific, slider, stat } from './lib';

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

// P(spam | message) from ln R. Close to 1 it is written as 1 − P(ham | message): a double can hold
// 1.97 × 10⁻¹⁴, but 1 − 1.97 × 10⁻¹⁴ would print as 1.000000.
function posterior(logR) {
  if (logR > 0) {
    const ham = 1 / (1 + Math.exp(logR));

    return ham < 1e-6 ? `1 − ${scientific(ham)}` : fmt(1 - ham, 6);
  }

  const spam = 1 / (1 + Math.exp(-logR));

  return spam < 1e-6 ? scientific(spam) : fmt(spam, 6);
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

  const spamStat = stat('P(spam) · ∏ P(wᵢ | spam)');
  const hamStat = stat('P(ham) · ∏ P(wᵢ | ham)');
  const ratioStat = stat('R = spam product / ham product');
  const errorStat = stat('Relative error of that R');
  const logStat = stat('ln R, as a sum of logs');
  const expStat = stat('R = exp(ln R)');
  const posteriorStat = stat('P(spam | message) from ln R');

  body.prepend(el('div', { class: 'vz-controls' }, control.node));
  body.append(el('p', { class: 'vz-multiples__title', style: 'margin:.25rem 0 0' },
    'log₁₀ of the two products: a line ends where its product has underflowed to exactly 0'));

  const chart = lineChart(body, {
    series: [
      { name: 'log₁₀ of P(spam) · ∏ P(wᵢ | spam)', color: COLORS.orange },
      { name: 'log₁₀ of P(ham) · ∏ P(wᵢ | ham)', color: COLORS.blue },
    ],
    height: 230,
    xLabel: 'words',
    yMin: -340,
    yMax: 0,
    yFormat: v => fmt(v, 0),
    reference: { value: Math.log10(Number.MIN_VALUE), label: 'smallest positive double, 4.9 × 10⁻³²⁴' },
    bands: [{ from: Math.log10(MIN_NORMAL), to: Math.log10(Number.MIN_VALUE), color: COLORS.yellow }],
    label: 'Line chart of the base-10 logarithm of both products against the number of words; both lines stop where the product underflows to zero.',
  });

  const note = el('p', { class: 'vz-narration', 'aria-live': 'polite', style: 'margin-top:.75rem' });

  body.append(
    legend([
      { color: COLORS.orange, label: 'spam product' },
      { color: COLORS.blue, label: 'ham product' },
      { style: `background:${COLORS.yellow};opacity:.45`, label: 'subnormal range, 2.2 × 10⁻³⁰⁸ down to 4.9 × 10⁻³²⁴' },
    ]),
    el('div', { class: 'vz-stats', style: 'grid-template-columns:repeat(auto-fit, minmax(10.5rem, 1fr))' },
      spamStat.node, hamStat.node, ratioStat.node, errorStat.node, logStat.node, expStat.node, posteriorStat.node),
    note
  );

  function update() {
    const shown = rows.slice(0, words);
    const row = shown[shown.length - 1];
    const xs = shown.map((r, i) => i + 1);
    const log10 = x => (x > 0 ? Math.log10(x) : NaN);
    const exact = Math.exp(row.logR);
    const error = Math.abs(row.ratio / exact - 1);

    chart.setData(xs, [shown.map(r => log10(r.spamProduct)), shown.map(r => log10(r.hamProduct))]);

    spamStat.set(scientific(row.spamProduct));
    hamStat.set(scientific(row.hamProduct));
    ratioStat.set(scientific(row.ratio));
    // The sum of logs is itself rounded, so differences below about 10⁻¹² are not errors of the product.
    errorStat.set(!Number.isFinite(error) ? 'useless' : error < 1e-12 ? 'none' : error < 0.01 ? scientific(error) : `${fmt(100 * error, 0)} %`);
    logStat.set(fmt(row.logR, 1));
    expStat.set(scientific(exact));
    posteriorStat.set(posterior(row.logR));

    if (Math.min(row.spamProduct, row.hamProduct) >= MIN_NORMAL) {
      note.textContent = 'Both products are still ordinary doubles, so R = numerator / denominator works, although the numbers are tiny.';
    } else if (row.spamProduct > 0 && row.hamProduct > 0) {
      note.textContent = 'A product is below 2.2 × 10⁻³⁰⁸, where doubles keep fewer and fewer significant digits (subnormal numbers), so R from the products is losing accuracy: see its error.';
    } else if (row.spamProduct > 0 || row.hamProduct > 0) {
      note.textContent = 'One product has underflowed to exactly 0, so the ratio of the products is infinite. The log-ratio is unaffected.';
    } else {
      note.textContent = 'Both products have underflowed to 0, and 0 / 0 is NaN ("not a number"). The sum of logarithms still gives the answer.';
    }
  }

  update();
}
