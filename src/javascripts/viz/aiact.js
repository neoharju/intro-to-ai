import { el, frame, svg } from './lib';

// The four risk levels of the EU AI Act as summarised on the page, with status colours (the level is
// also written on every tier, so the colour never carries the meaning alone).
const TIERS = [
  {
    id: 'unacceptable',
    name: 'Unacceptable risk',
    rule: 'Prohibited',
    color: '#d03b3b',
    ink: '#fff',
    text: 'Prohibited practices (Chapter II, Art. 5), for example social scoring, manipulative techniques that cause significant harm, untargeted scraping of facial images, and emotion recognition at work or in education.',
  },
  {
    id: 'high',
    name: 'High risk',
    rule: 'Regulated',
    color: '#ec835a',
    ink: '#fff',
    text: 'Safety components of products (or products) covered by the EU laws in Annex I that need a third-party conformity assessment, and the use cases in Annex III (biometrics, critical infrastructure, education, employment, essential services, law enforcement, migration, justice and democratic processes). Providers must, among other things, run a risk management system, govern their data, keep technical documentation and logs, enable human oversight and ensure accuracy, robustness and cybersecurity (Art. 8–17).',
  },
  {
    id: 'limited',
    name: 'Limited risk',
    rule: 'Transparency obligations',
    color: '#fab219',
    ink: '#0b0b0b',
    text: 'Lighter transparency obligations: people must be made aware that they are interacting with an AI system, and AI-generated content such as deepfakes must be disclosed.',
  },
  {
    id: 'minimal',
    name: 'Minimal risk',
    rule: 'Unregulated',
    color: '#0ca30c',
    ink: '#fff',
    text: 'No specific obligations under the risk-based rules. In 2021 this covered most AI applications on the EU market, such as AI in video games and spam filters.',
  },
];

// Examples taken from the lists on this page.
const EXAMPLES = [
  { text: 'A public authority scores citizens by their social behaviour and treats low scorers unfavourably', tier: 'unacceptable', why: 'Social scoring that leads to detrimental or unfavourable treatment is prohibited (Art. 5).' },
  { text: 'Software that infers the emotions of employees at work', tier: 'unacceptable', why: 'Emotion recognition in workplaces and educational institutions is prohibited, except for medical or safety reasons (Art. 5).' },
  { text: 'A system that ranks job applicants by analysing their CVs', tier: 'high', why: 'Employment (recruitment, analysing and filtering applications, evaluating candidates) is an Annex III use case; as it profiles people, it is always high-risk.' },
  { text: 'A system that decides who is admitted to a university programme', tier: 'high', why: 'Education (determining access or admission) is an Annex III use case.' },
  { text: 'Credit scoring of loan applicants', tier: 'high', why: 'Evaluating creditworthiness is an Annex III use case (essential services), except when it is used to detect financial fraud.' },
  { text: 'A customer-service chatbot', tier: 'limited', why: 'People must be told that they are interacting with an AI system.' },
  { text: 'A tool that generates realistic videos of real people (deepfakes)', tier: 'limited', why: 'The content must be disclosed as artificially generated or manipulated.' },
  { text: 'An email spam filter', tier: 'minimal', why: 'Spam filters are the page\'s example of minimal-risk AI, which the Act does not regulate.' },
  { text: 'Computer-controlled opponents in a video game', tier: 'minimal', why: 'AI-enabled video games are the page\'s example of minimal-risk AI.' },
];

const W = 520;
const H = 300;

export default function mountAiAct(figure) {
  const { body } = frame(figure, 'The risk levels of the EU AI Act');
  let tier = 'high';
  let example = null;

  const pyramid = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'vz-pyramid', role: 'group', 'aria-label': 'Risk pyramid of the EU AI Act; select a level' });
  const detail = el('div', { class: 'vz-panel', 'aria-live': 'polite' });
  const cards = el('div', { class: 'vz-cards' });

  body.append(
    el('div', { class: 'vz-split' },
      el('div', { class: 'vz-stage vz-stage--plain' }, pyramid),
      detail),
    el('p', { class: 'vz-multiples__title', style: 'margin-top:1rem' }, 'Where would these fall? Select one.'),
    cards,
    el('p', { class: 'vz-note' },
      'General-purpose AI models have their own obligations (see General Purpose AI above), in addition to the level of the system they are used in.')
  );

  function render() {
    pyramid.replaceChildren();

    const levels = TIERS.length;
    const top = 14;
    const height = (H - top - 6) / levels;

    TIERS.forEach((t, i) => {
      // Trapezoid i of a triangle with its apex at the top centre.
      const y1 = top + i * height + (i ? 3 : 0);
      const y2 = top + (i + 1) * height;
      // A truncated pyramid: the top tier is wide enough for its label.
      const half = y => 78 + ((y - top) / (H - top)) * (W / 2 - 82);
      const points = [
        [W / 2 - half(y1), y1], [W / 2 + half(y1), y1], [W / 2 + half(y2), y2], [W / 2 - half(y2), y2],
      ].map(p => p.join(',')).join(' ');
      const selected = t.id === tier;
      const group = svg('g', {
        class: `vz-pyramid__tier${selected ? ' is-selected' : ''}`,
        role: 'button',
        tabindex: 0,
        'aria-pressed': String(selected),
        'aria-label': `${t.name}: ${t.rule}`,
        onClick: () => { tier = t.id; example = null; render(); },
        onKeydown: event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            tier = t.id;
            example = null;
            render();
          }
        },
      });

      group.append(svg('polygon', {
        points,
        fill: t.color,
        opacity: selected ? 1 : 0.72,
        stroke: selected ? '#0f172a' : '#fff',
        'stroke-width': selected ? 2.5 : 1,
        'stroke-linejoin': 'round',
      }));
      group.append(svg('text', { x: W / 2, y: (y1 + y2) / 2 - (i ? 8 : 4), fill: t.ink, class: 'vz-pyramid__name' }, t.name));
      group.append(svg('text', { x: W / 2, y: (y1 + y2) / 2 + (i ? 10 : 12), fill: t.ink, class: 'vz-pyramid__rule' }, t.rule));
      pyramid.append(group);
    });

    const current = TIERS.find(t => t.id === tier);
    const chosen = example === null ? null : EXAMPLES[example];

    detail.replaceChildren(...[
      el('h5', {}, `${current.name}: ${current.rule.toLowerCase()}`),
      el('p', { style: 'margin:0' }, current.text),
      chosen && el('p', { class: 'vz-verdict' }, el('b', {}, chosen.text), ` falls under ${current.name.toLowerCase()}. ${chosen.why}`),
    ].filter(Boolean));

    cards.replaceChildren(...EXAMPLES.map((e, i) => el('button', {
      type: 'button',
      class: 'vz-card',
      'aria-pressed': String(i === example),
      onClick: () => { example = i; tier = e.tier; render(); },
    }, e.text)));
  }

  render();
}
