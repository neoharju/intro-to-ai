// The bottleneck figure of Week 4's extra section on end-to-end learning (endtoend.js), without the page:
// a point of the plane is squeezed into one number, z = w · x, where w = (cos φ, sin φ) is a unit vector,
// and a logistic classifier decides from z alone: p = σ(a z + b).
//
//   - The pipeline chooses φ without the labels, as the first principal component of the points (the one
//     number that keeps the most of the points: a stand-in goal), and then fits only a and b.
//   - The end-to-end model starts where the pipeline ends and trains φ, a and b together, by gradient descent on
//     the mean log-loss of the classifier: the one loss of the task reaches the first stage too.
//
// The steps are taken in the coordinates u = a w (the first stage and the weight of the classifier in one
// vector), in which the log-loss is convex, so one step size stays stable however large a grows. A step of
// the same size on φ itself is a times too large: the gradient with respect to φ grows with a, and φ would
// swing back and forth once the classifier is confident.

const sigmoid = t => 1 / (1 + Math.exp(-t));

// The points span about [-1, 1] × [-0.6, 0.6]: a long cloud along the angle TILT. The two classes differ
// across the cloud (the narrow direction, where the points vary little) or along it (the wide one).
export const X_RANGE = [-1, 1];
export const Y_RANGE = [-0.6, 0.6];
const TILT = (20 * Math.PI) / 180;
const PER_CLASS = 60;

// `random` has normal() (createRandom in lib.js).
export function makeData(random, along = 'narrow') {
  const points = [];
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);

  for (let label = 0; label < 2; label++) {
    const side = label ? 1 : -1;

    for (let i = 0; i < PER_CLASS; i++) {
      // u along the cloud, v across it.
      const u = along === 'narrow' ? 0.36 * random.normal() : side * 0.3 + 0.17 * random.normal();
      const v = along === 'narrow' ? side * 0.1 + 0.045 * random.normal() : 0.06 * random.normal();

      points.push({
        x: Math.max(-0.97, Math.min(0.97, u * cos - v * sin)),
        y: Math.max(-0.57, Math.min(0.57, u * sin + v * cos)),
        label,
      });
    }
  }

  return points;
}

// The angle of the first principal component (the direction of largest variance), in (-π/2, π/2].
export function principalAngle(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;

  points.forEach(({ x, y }) => {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  });

  // The eigenvector of the 2 × 2 covariance matrix with the larger eigenvalue.
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

export const feature = (point, phi) => point.x * Math.cos(phi) + point.y * Math.sin(phi);

// Mean log-loss of p = σ(a z + b) and its gradient with respect to u = a w (= (a cos φ, a sin φ)) and b.
export function lossAndGradient(points, { phi, a, b }) {
  const u1 = a * Math.cos(phi);
  const u2 = a * Math.sin(phi);
  let loss = 0;
  let g1 = 0;
  let g2 = 0;
  let gB = 0;

  points.forEach(({ x, y, label }) => {
    const t = u1 * x + u2 * y + b;
    const e = sigmoid(t) - label;

    // log(1 + exp(∓t)), written to avoid log(0).
    loss += label ? Math.log1p(Math.exp(-t)) : Math.log1p(Math.exp(t));
    // The chain rule takes the error back through the classifier into the first stage: dt/du = x.
    g1 += e * x;
    g2 += e * y;
    gB += e;
  });

  const n = points.length || 1;

  return { loss: loss / n, grad: { u: [g1 / n, g2 / n], b: gB / n } };
}

// One gradient descent step. The pipeline (trainPhi false) moves only its classifier: a, along its fixed w.
export function step(points, model, { rate = 1, trainPhi = true } = {}) {
  const { grad } = lossAndGradient(points, model);
  const w = [Math.cos(model.phi), Math.sin(model.phi)];
  const b = model.b - rate * grad.b;

  if (!trainPhi) {
    return { phi: model.phi, a: model.a - rate * (grad.u[0] * w[0] + grad.u[1] * w[1]), b };
  }

  const u1 = model.a * w[0] - rate * grad.u[0];
  const u2 = model.a * w[1] - rate * grad.u[1];

  return { phi: Math.atan2(u2, u1), a: Math.hypot(u1, u2), b };
}

export function accuracy(points, { phi, a, b }) {
  const correct = points.filter(point => (a * feature(point, phi) + b >= 0 ? 1 : 0) === point.label).length;

  return correct / (points.length || 1);
}

// The pipeline: the first principal component, then a classifier fitted on it (its feature never changes).
export function fitPipeline(points, steps = 400) {
  let model = { phi: principalAngle(points), a: 1, b: 0 };

  for (let i = 0; i < steps; i++) {
    model = step(points, model, { rate: 4, trainPhi: false });
  }

  return model;
}

// The end-to-end model before training: the pipeline itself, its first stage and its fitted classifier.
export function startEndToEnd(pipeline) {
  return { ...pipeline };
}

// The angle between two directions of projection, in degrees from 0 to 90 (w and -w give the same feature).
export function angleBetween(phi1, phi2) {
  const d = Math.abs(((phi1 - phi2) % Math.PI + Math.PI) % Math.PI);

  return (Math.min(d, Math.PI - d) * 180) / Math.PI;
}
