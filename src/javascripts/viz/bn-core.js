// The car Bayesian network of Week 3, with the CPTs of the page.
//   Battery -> Radio, Battery -> Ignition, (Ignition, Gas) -> Starts, Starts -> Moves

export const VARIABLES = ['B', 'R', 'I', 'G', 'S', 'M'];

export const PARENTS = { B: [], R: ['B'], I: ['B'], G: [], S: ['I', 'G'], M: ['S'] };

// P(V = 0 | parents), the first column of each CPT row.
export function probabilityOfZero(name, v) {
  switch (name) {
    case 'B': return 0.1;
    case 'R': return v.B ? 0.1 : 1.0;
    case 'I': return v.B ? 0.05 : 1.0;
    case 'G': return 0.05;
    case 'S': return v.I && v.G ? 0.01 : 1.0;
    case 'M': return v.S ? 0.01 : 1.0;
    default: throw new Error(name);
  }
}

// One tuple, choosing each variable after its parents: with r uniform in [0, 1), the value is 0
// when r < P(V = 0 | parents) and 1 otherwise. `onDraw` sees every choice (for the animation).
export function sampleTuple(random = Math.random, onDraw) {
  const v = {};

  VARIABLES.forEach(name => {
    const p0 = probabilityOfZero(name, v);
    const r = random();

    v[name] = r < p0 ? 0 : 1;

    if (onDraw) {
      onDraw({ name, p0, r, value: v[name], parents: PARENTS[name].map(p => [p, v[p]]) });
    }
  });

  return v;
}

export function jointProbability(v) {
  return VARIABLES.reduce((product, name) => {
    const p0 = probabilityOfZero(name, v);

    return product * (v[name] ? 1 - p0 : p0);
  }, 1);
}

// The 64 elementary events.
export function allEvents() {
  return Array.from({ length: 64 }, (x, bits) => Object.fromEntries(
    VARIABLES.map((name, i) => [name, (bits >> (5 - i)) & 1])));
}

// An event is a partial assignment such as { B: 0, R: 0, M: 0 }.
export function matches(v, event) {
  return Object.entries(event).every(([name, value]) => v[name] === value);
}

// Brute force, as on the page: sum the joint probabilities of the elementary events in the event.
export function probability(event) {
  return allEvents().filter(v => matches(v, event)).reduce((sum, v) => sum + jointProbability(v), 0);
}

export const QUERIES = [
  {
    id: 'good-day',
    label: 'P(B, R, I, G, S, M): a good day',
    query: { B: 1, R: 1, I: 1, G: 1, S: 1, M: 1 },
    evidence: {},
  },
  {
    id: 'joint',
    label: 'P(¬B, ¬R, ¬M)',
    query: { B: 0, R: 0, M: 0 },
    evidence: {},
  },
  {
    id: 'battery',
    label: 'P(¬B | ¬R, ¬M): is the battery dead?',
    query: { B: 0 },
    evidence: { R: 0, M: 0 },
  },
];

export function exactValue({ query, evidence }) {
  return probability({ ...evidence, ...query }) / probability(evidence);
}
