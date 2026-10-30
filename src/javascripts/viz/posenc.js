import { COLORS, createCanvas, diverging, el, fmt, frame, lineChart, pointerPosition } from './lib';

const D_MODEL = 64;
const POSITIONS = 60;

// The sinusoidal encodings of the original Transformer:
//   PE(pos, 2i) = sin(pos / 10000^(2i / d_model)),  PE(pos, 2i + 1) = cos(pos / 10000^(2i / d_model))
export function positionalEncoding(pos, dim, dModel = D_MODEL) {
  const i = Math.floor(dim / 2);
  const angle = pos / 10000 ** ((2 * i) / dModel);

  return dim % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
}

export default function mountPositionalEncoding(figure) {
  const { body } = frame(figure, 'Sinusoidal positional encodings');
  let dim = 4;
  let hover = { pos: 10, dim: 4 };

  const stage = el('div', { class: 'vz-stage', style: 'background:var(--surface);padding:.4rem' });
  const view = createCanvas(stage, {
    aspect: 0.5,
    minHeight: 180,
    maxHeight: 330,
    label: 'Heat map of the positional encoding values: positions from top to bottom, dimensions from left to right; blue is −1 and red is +1.',
    onResize: () => draw(),
  });
  const readout = el('p', { class: 'vz-math', 'aria-live': 'polite', style: 'margin:.6rem 0 0' });
  const chart = lineChart(null, {
    series: [{ name: 'PE(pos, dimension)', color: COLORS.violet }],
    height: 150,
    xLabel: 'position',
    yMin: -1,
    yMax: 1,
    xFormat: v => String(v),
    label: 'Line chart of the selected dimension of the encoding against the position.',
  });
  const chartTitle = el('p', { class: 'vz-multiples__title', style: 'margin-top:.85rem' });

  body.append(stage, readout, chartTitle, chart.node);

  const pad = { left: 30, top: 18, right: 4, bottom: 4 };

  function layout() {
    const cw = (view.width - pad.left - pad.right) / D_MODEL;
    const ch = (view.height - pad.top - pad.bottom) / POSITIONS;

    return { cw, ch };
  }

  function draw() {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    const { cw, ch } = layout();

    ctx.clearRect(0, 0, width, height);

    for (let pos = 0; pos < POSITIONS; pos++) {
      for (let d = 0; d < D_MODEL; d++) {
        ctx.fillStyle = diverging(positionalEncoding(pos, d));
        ctx.fillRect(pad.left + d * cw, pad.top + pos * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }

    ctx.font = '10px "Inter Variable", system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    [0, 20, 40, 59].forEach(pos => ctx.fillText(String(pos), pad.left - 4, pad.top + (pos + 0.5) * ch));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    [0, 16, 32, 48, 63].forEach(d => ctx.fillText(String(d), pad.left + (d + 0.5) * cw, pad.top - 3));

    // The selected dimension and the hovered cell.
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(pad.left + dim * cw, pad.top, cw, POSITIONS * ch);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad.left + hover.dim * cw - 1, pad.top + hover.pos * ch - 1, cw + 2, ch + 2);

    const value = positionalEncoding(hover.pos, hover.dim);
    const i = Math.floor(hover.dim / 2);
    const fn = hover.dim % 2 === 0 ? 'sin' : 'cos';

    readout.textContent = `PE(pos = ${hover.pos}, dimension ${hover.dim}) = ${fn}(${hover.pos} / 10000^(${2 * i}/${D_MODEL})) = ${fmt(value, 3)}`;

    const wavelength = 2 * Math.PI * 10000 ** ((2 * Math.floor(dim / 2)) / D_MODEL);

    chartTitle.textContent = `Dimension ${dim} (${dim % 2 === 0 ? 'sine' : 'cosine'}), wavelength 2π · 10000^(${2 * Math.floor(dim / 2)}/${D_MODEL}) ≈ ${fmt(wavelength, 1)} positions`;

    const xs = Array.from({ length: POSITIONS }, (v, pos) => pos);

    chart.setData(xs, [xs.map(pos => positionalEncoding(pos, dim))]);
  }

  function cellAt(event) {
    const { x, y } = pointerPosition(view.canvas, event);
    const { cw, ch } = layout();
    const d = Math.floor((x - pad.left) / cw);
    const pos = Math.floor((y - pad.top) / ch);

    return d >= 0 && d < D_MODEL && pos >= 0 && pos < POSITIONS ? { pos, dim: d } : null;
  }

  view.canvas.addEventListener('pointermove', event => {
    const cell = cellAt(event);

    if (cell) {
      hover = cell;
      draw();
    }
  });

  view.canvas.addEventListener('pointerdown', event => {
    const cell = cellAt(event);

    if (cell) {
      hover = cell;
      dim = cell.dim;
      draw();
    }
  });

  view.canvas.tabIndex = 0;
  view.canvas.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const move = moves[event.key];

    if (move) {
      event.preventDefault();
      hover = {
        pos: Math.max(0, Math.min(POSITIONS - 1, hover.pos + move[0])),
        dim: Math.max(0, Math.min(D_MODEL - 1, hover.dim + move[1])),
      };
      dim = hover.dim;
      draw();
    }
  });

  draw();
}
