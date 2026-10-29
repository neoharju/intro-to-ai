import { ACTIVATIONS } from './mlp-core';
import { COLORS, createCanvas, dot, el, fmt, frame, legend, pointerPosition } from './lib';

// One small plot per function, each with the function and its derivative, and a shared z.
const FUNCTIONS = [
  { id: 'step', name: 'Step', range: [-0.25, 1.25], ticks: [0, 1] },
  { id: 'sigmoid', name: 'Sigmoid', range: [-0.25, 1.25], ticks: [0, 0.25, 1] },
  { id: 'tanh', name: 'tanh', range: [-1.25, 1.25], ticks: [-1, 0, 1] },
  { id: 'relu', name: 'ReLU', range: [-0.5, 3.25], ticks: [0, 1, 2, 3] },
];

const Z_RANGE = [-3, 3];
const SERIES = [
  { key: 'f', label: 'f(z)', color: COLORS.blue },
  { key: 'df', label: 'derivative f′(z)', color: COLORS.orange },
];

export default function mountActivations(figure) {
  const { body } = frame(figure, 'Activation functions and their derivatives');
  let z = 1;

  const grid = el('div', { class: 'vz-multiples' });
  const readout = el('div', { class: 'vz-table-wrap' });
  const panels = FUNCTIONS.map(fn => {
    const holder = el('div', { class: 'vz-stage', style: 'background:#fff;padding:.4rem .4rem .1rem' });
    const title = el('p', { class: 'vz-multiples__title' }, fn.name);
    const panel = el('div', {}, title, holder);

    grid.append(panel);

    const view = createCanvas(holder, {
      aspect: 0.8,
      minHeight: 120,
      maxHeight: 200,
      label: `${fn.name} and its derivative for z from −3 to 3.`,
      onResize: () => drawPanel(fn, view),
    });

    return { fn, view };
  });

  body.append(
    legend(SERIES.map(s => ({ color: s.color, label: s.label }))),
    grid,
    readout,
    el('p', { class: 'vz-note' }, 'Point at a plot, or select one and use the arrow keys, to move z in all four.')
  );

  const pad = { left: 26, right: 6, top: 6, bottom: 18 };

  function drawPanel(fn, view) {
    const { ctx, width, height } = view;

    if (!width) {
      return;
    }

    const [lo, hi] = fn.range;
    const sx = v => pad.left + ((v - Z_RANGE[0]) / (Z_RANGE[1] - Z_RANGE[0])) * (width - pad.left - pad.right);
    const sy = v => pad.top + (1 - (v - lo) / (hi - lo)) * (height - pad.top - pad.bottom);
    const activation = ACTIVATIONS[fn.id];

    ctx.clearRect(0, 0, width, height);
    ctx.font = '10px "Inter Variable", system-ui, sans-serif';

    fn.ticks.forEach(t => {
      const y = Math.round(sy(t)) + 0.5;

      ctx.strokeStyle = t === 0 ? COLORS.axis : COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(t), pad.left - 4, y);
    });

    [-3, 0, 3].forEach(t => {
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = t === -3 ? 'left' : t === 3 ? 'right' : 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(t), sx(t), height - pad.bottom + 4);
    });

    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(Math.round(sx(0)) + 0.5, pad.top);
    ctx.lineTo(Math.round(sx(0)) + 0.5, height - pad.bottom);
    ctx.stroke();

    // The derivative first, so the function is drawn on top of it.
    [...SERIES].reverse().forEach(series => {
      const value = series.key === 'f' ? activation.f : activation.df;
      let previous = null;

      ctx.strokeStyle = series.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i <= 240; i++) {
        const v = Z_RANGE[0] + (i / 240) * (Z_RANGE[1] - Z_RANGE[0]);
        const y = value(v);
        const px = sx(v);
        const py = sy(Math.max(lo, Math.min(hi, y)));

        // Step and ReLU' jump at 0: leave a gap instead of a vertical line.
        if (i === 0 || (previous !== null && Math.abs(y - previous) > 0.5)) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }

        previous = y;
      }

      ctx.stroke();
    });

    const x = Math.round(sx(z)) + 0.5;

    ctx.strokeStyle = COLORS.faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();

    SERIES.forEach(series => {
      const y = (series.key === 'f' ? activation.f : activation.df)(z);

      if (y >= lo && y <= hi) {
        dot(ctx, sx(z), sy(y), 3.5, series.color);
      }
    });

    view.zFromPixel = px => Z_RANGE[0] + ((px - pad.left) / (width - pad.left - pad.right)) * (Z_RANGE[1] - Z_RANGE[0]);
  }

  function drawAll() {
    panels.forEach(({ fn, view }) => drawPanel(fn, view));

    readout.replaceChildren(el('table', { class: 'vz-table' },
      el('thead', {}, el('tr', {}, el('th', {}, `z = ${fmt(z, 2)}`), ...FUNCTIONS.map(fn => el('th', {}, fn.name)))),
      el('tbody', {},
        el('tr', {}, el('td', {}, 'f(z)'), ...FUNCTIONS.map(fn => el('td', {}, fmt(ACTIVATIONS[fn.id].f(z), 3)))),
        el('tr', {}, el('td', {}, 'f′(z)'), ...FUNCTIONS.map(fn => el('td', {}, fmt(ACTIVATIONS[fn.id].df(z), 3)))))));
  }

  panels.forEach(({ view }) => {
    const move = event => {
      if (!view.zFromPixel) {
        return;
      }

      const { x } = pointerPosition(view.canvas, event);

      z = Math.max(Z_RANGE[0], Math.min(Z_RANGE[1], view.zFromPixel(x)));
      drawAll();
    };

    view.canvas.addEventListener('pointermove', move);
    view.canvas.addEventListener('pointerdown', move);
    view.canvas.tabIndex = 0;
    view.canvas.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        z = Math.max(Z_RANGE[0], Math.min(Z_RANGE[1], z + (event.key === 'ArrowLeft' ? -0.1 : 0.1)));
        drawAll();
      }
    });
  });

  drawAll();
}
