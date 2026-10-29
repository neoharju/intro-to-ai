// Scaled dot-product self-attention on two short sentences, with toy vectors chosen by hand.
// Queries and keys have d_k = 4 components, read loosely as (finance, nature, action, function word);
// values have two components, (finance, nature), so that the output can be drawn in a plane.
// A word has the same vectors in both sentences, like a static embedding: only the context differs.

export const D_K = 4;

export const WORDS = {
  the: { q: [0.5, 0.5, 0, 0], k: [0, 0, 0, 2], v: [0, 0] },
  bank: { q: [2, 2, 0, 0], k: [0.6, 0.6, 0, 0], v: [0.5, 0.5] },
  approved: { q: [1, 0, 0.5, 0], k: [1.5, 0, 1, 0], v: [0.6, 0] },
  loan: { q: [1, 0, 0.5, 0], k: [2, 0, 0, 0], v: [1, 0] },
  we: { q: [0, 0, 1, 0], k: [0, 0, 1, 0.5], v: [0, 0] },
  sat: { q: [0, 0, 0.5, 1], k: [0, 0.5, 1.5, 0], v: [0, 0.2] },
  on: { q: [0, 1, 0, 0], k: [0, 0.5, 0, 1.5], v: [0, 0.1] },
  river: { q: [0, 1, 0, 0.5], k: [0, 2, 0, 0], v: [0, 1] },
};

export const SENTENCES = [
  ['the', 'bank', 'approved', 'the', 'loan'],
  ['we', 'sat', 'on', 'the', 'river', 'bank'],
];

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

// softmax(Q K^T / sqrt(d_k)) row by row, with -Infinity for the keys after the query under a causal
// mask, and the outputs softmax(...) V.
export function attention(tokens, causal) {
  const vectors = tokens.map(token => WORDS[token]);
  const scale = 1 / Math.sqrt(D_K);

  const rows = vectors.map((query, i) => {
    const scores = vectors.map((key, j) => (causal && j > i ? -Infinity : scale * dot(query.q, key.k)));
    const max = Math.max(...scores);
    const exps = scores.map(s => (s === -Infinity ? 0 : Math.exp(s - max)));
    const total = exps.reduce((a, b) => a + b, 0);
    const weights = exps.map(e => e / total);
    const output = [0, 1].map(c => weights.reduce((sum, w, j) => sum + w * vectors[j].v[c], 0));

    return { scores, raw: vectors.map(key => dot(query.q, key.k)), weights, output };
  });

  return rows;
}
