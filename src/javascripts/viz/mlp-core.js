// A network with one hidden layer for 2-D inputs:
//   h = act(W1 x + b1),  p = sigmoid(w2 · h + b2)
// trained on the mean binary cross-entropy with backpropagation and the Adam optimizer.

export const ACTIVATIONS = {
  relu: { f: z => (z > 0 ? z : 0), df: z => (z > 0 ? 1 : 0) },
  tanh: { f: Math.tanh, df: z => 1 - Math.tanh(z) ** 2 },
  sigmoid: {
    f: z => 1 / (1 + Math.exp(-z)),
    df: z => {
      const s = 1 / (1 + Math.exp(-z));
      return s * (1 - s);
    },
  },
  step: { f: z => (z > 0 ? 1 : 0), df: () => 0 },
};

const sigmoid = z => 1 / (1 + Math.exp(-z));

// Parameters as one flat array: W1 (hidden x 2), b1 (hidden), w2 (hidden), b2.
export function createNetwork(hidden, activation, random) {
  const size = hidden * 4 + 1;
  const params = new Float64Array(size);
  // Glorot-uniform limits for tanh/sigmoid, He-uniform for ReLU.
  const limit1 = activation === 'relu' ? Math.sqrt(6 / 2) : Math.sqrt(6 / (2 + hidden));
  const limit2 = Math.sqrt(6 / (hidden + 1));

  for (let j = 0; j < hidden; j++) {
    params[2 * j] = (2 * random() - 1) * limit1;
    params[2 * j + 1] = (2 * random() - 1) * limit1;
    params[3 * hidden + j] = (2 * random() - 1) * limit2;
  }

  return {
    hidden,
    activation,
    params,
    m: new Float64Array(size),
    v: new Float64Array(size),
    t: 0,
  };
}

export function forward(net, x, y, hiddenOut) {
  const { hidden, params } = net;
  const act = ACTIVATIONS[net.activation].f;
  let z = params[4 * hidden];

  for (let j = 0; j < hidden; j++) {
    const pre = params[2 * j] * x + params[2 * j + 1] * y + params[2 * hidden + j];
    const h = act(pre);

    if (hiddenOut) {
      hiddenOut[j] = pre;
    }

    z += params[3 * hidden + j] * h;
  }

  return sigmoid(z);
}

// Mean loss and its gradient with respect to all parameters.
export function lossAndGradient(net, points) {
  const { hidden, params } = net;
  const { f, df } = ACTIVATIONS[net.activation];
  const grad = new Float64Array(params.length);
  const pre = new Float64Array(hidden);
  let loss = 0;

  points.forEach(point => {
    const p = forward(net, point.x, point.y, pre);
    const eps = 1e-12;

    loss -= point.label ? Math.log(p + eps) : Math.log(1 - p + eps);

    // d loss / d z for a sigmoid output with cross-entropy is p - y.
    const delta = p - point.label;

    grad[4 * hidden] += delta;

    for (let j = 0; j < hidden; j++) {
      const h = f(pre[j]);
      const deltaHidden = delta * params[3 * hidden + j] * df(pre[j]);

      grad[3 * hidden + j] += delta * h;
      grad[2 * j] += deltaHidden * point.x;
      grad[2 * j + 1] += deltaHidden * point.y;
      grad[2 * hidden + j] += deltaHidden;
    }
  });

  const n = points.length || 1;

  for (let i = 0; i < grad.length; i++) {
    grad[i] /= n;
  }

  return { loss: loss / n, grad };
}

export function adamStep(net, grad, rate, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8) {
  net.t += 1;

  for (let i = 0; i < net.params.length; i++) {
    net.m[i] = beta1 * net.m[i] + (1 - beta1) * grad[i];
    net.v[i] = beta2 * net.v[i] + (1 - beta2) * grad[i] * grad[i];

    const mHat = net.m[i] / (1 - beta1 ** net.t);
    const vHat = net.v[i] / (1 - beta2 ** net.t);

    net.params[i] -= (rate * mHat) / (Math.sqrt(vHat) + epsilon);
  }
}

export function accuracy(net, points) {
  const correct = points.filter(point => (forward(net, point.x, point.y) >= 0.5 ? 1 : 0) === point.label).length;

  return correct / (points.length || 1);
}
