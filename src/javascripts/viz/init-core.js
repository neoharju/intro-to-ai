// The weight-initialization figure of Week 4 (init.js), without the page: the tiny network of the numerical
// backward pass, with three hidden ReLU units instead of one,
//
//   z_j = w_j x + b_j,   h_j = ReLU(z_j),   ŷ = v_1 h_1 + v_2 h_2 + v_3 h_3 + c,
//
// trained by full-batch gradient descent on the mean of ½(ŷ − y)² over five points of y = |x|. One hidden
// unit can bend the line only once, so |x| needs at least two units that differ.
//
// Three starts:
//   - zero: every parameter is 0. Then h_j = ReLU(0) = 0 and v_j = 0, so ∂L/∂v_j (which has the factor h_j)
//     and ∂L/∂w_j, ∂L/∂b_j (which have the factor v_j) are exactly 0: only the output bias c learns.
//   - equal: every parameter is 0.5. The three units compute the same thing, get the same gradients and stay
//     copies of each other: the network bends only once.
//   - random: He initialization, weights from a normal distribution with standard deviation √(2 / n_in)
//     (n_in = 1 for w, 3 for v), biases 0.

export const UNITS = 3;
export const POINTS = [-2, -1, 0, 1, 2].map(x => ({ x, y: Math.abs(x) }));

// The gradient of ReLU at exactly 0 is taken as 0, as in PyTorch.
const relu = z => (z > 0 ? z : 0);
const reluSlope = z => (z > 0 ? 1 : 0);

// `random` has normal() (createRandom in lib.js); only the random start uses it.
export function createNetwork(start, random) {
  const net = { w: new Float64Array(UNITS), b: new Float64Array(UNITS), v: new Float64Array(UNITS), c: 0 };

  if (start === 'equal') {
    net.w.fill(0.5);
    net.b.fill(0.5);
    net.v.fill(0.5);
    net.c = 0.5;
  } else if (start === 'random') {
    for (let j = 0; j < UNITS; j++) {
      net.w[j] = Math.sqrt(2 / 1) * random.normal();
      net.v[j] = Math.sqrt(2 / UNITS) * random.normal();
    }
  }

  return net;
}

// ŷ for the input x; with `parts`, also each unit's share v_j h_j of it.
export function predict(net, x, parts) {
  let out = net.c;

  for (let j = 0; j < UNITS; j++) {
    const share = net.v[j] * relu(net.w[j] * x + net.b[j]);

    if (parts) {
      parts[j] = share;
    }

    out += share;
  }

  return out;
}

// The mean loss over the points and its gradient with respect to every parameter, by backpropagation.
export function lossAndGradient(net, points = POINTS) {
  const grad = { w: new Float64Array(UNITS), b: new Float64Array(UNITS), v: new Float64Array(UNITS), c: 0 };
  let loss = 0;

  points.forEach(({ x, y }) => {
    const error = predict(net, x) - y;

    loss += 0.5 * error * error;
    grad.c += error;

    for (let j = 0; j < UNITS; j++) {
      const z = net.w[j] * x + net.b[j];
      // The error reaches unit j through its output weight v_j.
      const back = error * net.v[j] * reluSlope(z);

      grad.v[j] += error * relu(z);
      grad.w[j] += back * x;
      grad.b[j] += back;
    }
  });

  const n = points.length;

  ['w', 'b', 'v'].forEach(key => grad[key].forEach((value, j) => { grad[key][j] = value / n; }));
  grad.c /= n;

  return { loss: loss / n, grad };
}

// One gradient descent step, in place: θ ← θ − η ∂L/∂θ for every parameter at once.
export function step(net, rate, points = POINTS) {
  const { grad } = lossAndGradient(net, points);

  for (let j = 0; j < UNITS; j++) {
    net.w[j] -= rate * grad.w[j];
    net.b[j] -= rate * grad.b[j];
    net.v[j] -= rate * grad.v[j];
  }

  net.c -= rate * grad.c;

  return grad;
}

// True when the hidden units are exact copies of each other (the same w, b and v).
export function identicalUnits(net) {
  for (let j = 1; j < UNITS; j++) {
    if (net.w[j] !== net.w[0] || net.b[j] !== net.b[0] || net.v[j] !== net.v[0]) {
      return false;
    }
  }

  return true;
}
