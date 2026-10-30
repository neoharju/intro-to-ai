import { COLORS, createCanvas, el, fmt, frame, legend, slider, stat } from './lib';

const PEOPLE = 1000;
const PRIORS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5];

const COLOR = {
  get truePositive() { return COLORS.orange; },
  get falseNegative() { return COLORS.orange; },
  get falsePositive() { return COLORS.blue; },
  get trueNegative() { return COLORS.quiet; },
};

const percent = (p, digits = 1) => `${fmt(100 * p, digits)}%`;

// Bayes rule with natural frequencies: 1000 people, of whom P(condition) have the condition; the
// observation (a positive test) has probability P(positive | condition) and P(positive | no condition).
export function bayesCounts(prior, sensitivity, falsePositiveRate) {
  const withCondition = Math.round(PEOPLE * prior);
  const truePositives = Math.round(withCondition * sensitivity);
  const without = PEOPLE - withCondition;
  const falsePositives = Math.round(without * falsePositiveRate);

  return {
    withCondition,
    truePositives,
    falseNegatives: withCondition - truePositives,
    falsePositives,
    trueNegatives: without - falsePositives,
  };
}

export function posterior(prior, sensitivity, falsePositiveRate) {
  const joint = prior * sensitivity;
  const evidence = joint + (1 - prior) * falsePositiveRate;

  return { joint, evidence, posterior: evidence > 0 ? joint / evidence : NaN };
}

export default function mountBayes(figure) {
  const { body } = frame(figure, 'Bayes rule with 1000 people');
  let prior = 0.05;
  let sensitivity = 0.9;
  let falsePositiveRate = 0.2;

  const stage = el('div', { class: 'vz-stage', style: 'padding:.6rem' });
  const view = createCanvas(stage, {
    aspect: 0.4,
    minHeight: 150,
    maxHeight: 300,
    label: 'A grid of 1000 people coloured by whether they have the condition and whether they test positive.',
    onResize: () => draw(),
  });

  const priorControl = slider({
    label: 'P(condition)',
    min: 0,
    max: PRIORS.length - 1,
    value: PRIORS.indexOf(prior),
    format: i => percent(PRIORS[i], PRIORS[i] < 0.01 ? 1 : 0),
    onInput: i => { prior = PRIORS[i]; update(); },
  });
  const sensitivityControl = slider({
    label: 'P(positive | condition)',
    min: 50,
    max: 100,
    value: 90,
    format: v => `${v}%`,
    onInput: v => { sensitivity = v / 100; update(); },
  });
  const falsePositiveControl = slider({
    label: 'P(positive | no condition)',
    min: 0,
    max: 50,
    value: 20,
    format: v => `${v}%`,
    onInput: v => { falsePositiveRate = v / 100; update(); },
  });

  const priorStat = stat('Prior P(condition)');
  const posteriorStat = stat('Posterior P(condition | positive)');
  const sentence = el('p', { class: 'vz-narration', 'aria-live': 'polite' });
  const formula = el('p', { class: 'vz-math', style: 'margin:0' });
  const ratio = el('p', { class: 'vz-math', style: 'margin:.35rem 0 0' });

  body.append(
    el('div', { class: 'vz-controls' }, priorControl.node, sensitivityControl.node, falsePositiveControl.node),
    stage,
    legend([
      { color: COLOR.truePositive, label: 'Has the condition, tests positive' },
      { style: `background:var(--surface);box-shadow:inset 0 0 0 2px ${COLOR.falseNegative}`, label: 'Has the condition, tests negative' },
      { color: COLOR.falsePositive, label: 'No condition, tests positive' },
      { color: COLOR.trueNegative, label: 'No condition, tests negative' },
    ]),
    el('div', { class: 'vz-split', style: 'margin-top:.85rem' },
      el('div', { class: 'vz-panel' }, el('h5', {}, 'In numbers'), sentence, formula, ratio,
        el('p', { class: 'vz-note' }, 'c = has the condition, + = tests positive; the dots are rounded to whole people.')),
      el('div', { class: 'vz-stats', style: 'margin-top:0' }, priorStat.node, posteriorStat.node))
  );

  function update() {
    const counts = bayesCounts(prior, sensitivity, falsePositiveRate);
    const { joint, evidence, posterior: post } = posterior(prior, sensitivity, falsePositiveRate);
    const positives = counts.truePositives + counts.falsePositives;
    const notJoint = (1 - prior) * falsePositiveRate;

    sentence.textContent = positives
      ? `Of ${PEOPLE} people, ${counts.withCondition} have the condition and ${positives} test positive. `
        + `Only ${counts.truePositives} of the ${positives} positives have the condition.`
      : `Of ${PEOPLE} people, ${counts.withCondition} have the condition and nobody tests positive.`;

    formula.textContent = `P(c | +) = P(c) P(+|c) / P(+) = ${fmt(prior, 3)} × ${fmt(sensitivity, 2)} / `
      + `(${fmt(prior, 3)} × ${fmt(sensitivity, 2)} + ${fmt(1 - prior, 3)} × ${fmt(falsePositiveRate, 2)}) `
      + `= ${fmt(joint, 4)} / ${fmt(evidence, 4)} = ${Number.isFinite(post) ? fmt(post, 3) : 'undefined'}`;

    ratio.textContent = notJoint > 0
      ? `Ratio form: R = ${fmt(joint, 4)} / ${fmt(notJoint, 4)} = ${fmt(joint / notJoint, 3)}, and R / (1 + R) = ${fmt(post, 3)}.`
      : 'Ratio form: no false positives, so R is infinite and every positive has the condition.';

    priorStat.set(percent(prior, prior < 0.01 ? 1 : 0));
    posteriorStat.set(Number.isFinite(post) ? percent(post) : '–');
    draw(counts);
  }

  let lastCounts = bayesCounts(prior, sensitivity, falsePositiveRate);

  // People are placed column by column: first those with the condition (positives on top), then
  // those without (positives on top).
  function draw(counts = lastCounts) {
    lastCounts = counts;

    const { ctx, width, height } = view;
    const cols = 50;
    const rows = PEOPLE / cols;
    const size = Math.min((width - 4) / cols, (height - 4) / rows);
    const ox = (width - size * cols) / 2;
    const oy = (height - size * rows) / 2;
    const r = Math.max(1.2, size * 0.36);
    const kinds = [
      ...Array(counts.truePositives).fill('tp'),
      ...Array(counts.falseNegatives).fill('fn'),
      ...Array(counts.falsePositives).fill('fp'),
      ...Array(counts.trueNegatives).fill('tn'),
    ];

    ctx.clearRect(0, 0, width, height);

    kinds.forEach((kind, i) => {
      const x = ox + Math.floor(i / rows) * size + size / 2;
      const y = oy + (i % rows) * size + size / 2;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);

      if (kind === 'fn') {
        ctx.strokeStyle = COLOR.falseNegative;
        ctx.lineWidth = Math.max(1, r * 0.45);
        ctx.stroke();
      } else {
        ctx.fillStyle = kind === 'tp' ? COLOR.truePositive : kind === 'fp' ? COLOR.falsePositive : COLOR.trueNegative;
        ctx.fill();
      }
    });
  }

  update();
}
