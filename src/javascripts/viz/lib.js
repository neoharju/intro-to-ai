// Shared helpers for the interactive figures (javascripts/weekN.js): DOM building, form controls,
// a high-DPI canvas that follows the width of its container, the colours, a seeded random number
// generator, an animation loop that only runs while its figure is on screen, and a small line chart
// with a hover/keyboard read-out.

// Categorical slots (validated for colour-vision deficiencies, up to three classes in one plot), the
// neutrals, the colours of roles (walls, mud, highlights), and the ends of a sequential blue ramp. The
// values are the light theme's; readColors() replaces them with the CSS tokens of the current theme
// (see _tokens.scss and _themes.scss) when the page loads and whenever the theme changes.
export const COLORS = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  violet: '#6250d6',
  red: '#e34948',
  ink: '#0f172a',
  text: '#1e293b',
  muted: '#64748b',
  faint: '#94a3b8',
  grid: '#e2e8f0',
  axis: '#cbd5e1',
  surface: '#ffffff',
  surface2: '#f8fafc',
  surface3: '#f1f5f9',
  neutral: '#f0efec',
  amber: '#b45309',
  amberSoft: '#fffbeb',
  amberLine: '#fde68a',
  primarySoft: '#eff4ff',
  wall: '#334155',
  mud: '#eadfcf',
  mudHatch: '#cdb999',
  quiet: '#dfe5ee',
  rampStart: '#f1f6fe',
  rampEnd: '#0d366b',
};

const TOKENS = {
  blue: '--viz-blue',
  orange: '--viz-orange',
  aqua: '--viz-aqua',
  yellow: '--viz-yellow',
  violet: '--viz-violet',
  red: '--viz-red',
  ink: '--ink',
  text: '--text',
  muted: '--muted',
  faint: '--faint',
  grid: '--line',
  axis: '--line-strong',
  surface: '--surface',
  surface2: '--surface-2',
  surface3: '--surface-3',
  neutral: '--viz-neutral',
  amber: '--viz-amber',
  amberSoft: '--amber-soft',
  amberLine: '--amber-line',
  primarySoft: '--primary-soft',
  wall: '--viz-wall',
  mud: '--viz-mud',
  mudHatch: '--viz-mud-hatch',
  quiet: '--viz-quiet',
  rampStart: '--viz-ramp-start',
  rampEnd: '--viz-ramp-end',
};

const LIGHT = { ...COLORS };

export const CLASS_COLORS = [COLORS.blue, COLORS.orange, COLORS.aqua];

// The light theme's ramp, tuned by eye; the dark themes go straight from a dark start to a bright blue.
// Labels on ramp colours choose their own colour with textOn().
const BLUE_RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

let dark = false;

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Relative luminance (WCAG) of "#rrggbb" or "rgb(r, g, b)".
function luminance(color) {
  const channels = color.startsWith('#') ? hexToRgb(color) : (color.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
  const [r, g, b] = channels.map(v => {
    const c = v / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Reads the colours of the current theme from the CSS tokens (each a six-digit hex colour).
function readColors() {
  const style = window.getComputedStyle(document.documentElement);

  Object.entries(TOKENS).forEach(([key, token]) => {
    const value = style.getPropertyValue(token).trim().toLowerCase();

    COLORS[key] = /^#[0-9a-f]{6}$/.test(value) ? value : LIGHT[key];
  });
  CLASS_COLORS.splice(0, CLASS_COLORS.length, COLORS.blue, COLORS.orange, COLORS.aqua);
  dark = luminance(COLORS.surface) < 0.2;
}

readColors();

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));

  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// t in [0, 1] -> a colour on the blue ramp (0 is the near-surface step).
export function sequential(t, from = COLORS.rampStart) {
  const x = Math.min(1, Math.max(0, t));

  if (dark) {
    return mix(from, COLORS.rampEnd, x);
  }

  if (x < 1 / BLUE_RAMP.length) {
    return mix(from, BLUE_RAMP[0], x * BLUE_RAMP.length);
  }

  const position = x * (BLUE_RAMP.length - 1);
  const index = Math.min(BLUE_RAMP.length - 2, Math.floor(position));

  return mix(BLUE_RAMP[index], BLUE_RAMP[index + 1], position - index);
}

// t in [-1, 1] -> blue (negative), neutral grey (0), red or the given warm pole (positive).
export function diverging(t, negative = COLORS.blue, positive = COLORS.red) {
  const x = Math.min(1, Math.max(-1, t));

  return x < 0 ? mix(COLORS.neutral, negative, -x) : mix(COLORS.neutral, positive, x);
}

// "#rrggbb" -> [r, g, b], for pixel-level drawing (ImageData).
export function rgbOf(hex) {
  return hexToRgb(hex);
}

// White or near-black text, whichever reads better on the given background colour.
export function textOn(color) {
  return luminance(color) > 0.25 ? '#0f172a' : '#ffffff';
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Seeded pseudo-random numbers (mulberry32), so that "random" data is the same on every visit.
export function createRandom(seed = 1) {
  let state = seed >>> 0;

  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Standard normal variate (Box-Muller).
  random.normal = () => {
    const u = 1 - random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  random.int = n => Math.floor(random() * n);

  return random;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function fmt(value, digits = 2) {
  if (value === Infinity) {
    return '+∞';
  }

  if (value === -Infinity) {
    return '−∞';
  }

  if (Number.isNaN(value)) {
    return 'NaN';
  }

  // A real minus sign; and no "-0".
  const text = (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toFixed(digits);

  return text.replace('-', '−');
}

const SUPERSCRIPT = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '−': '⁻' };

// 3.2e-215 -> "3.20 × 10⁻²¹⁵"
export function scientific(x, digits = 2) {
  if (x === 0) {
    return '0';
  }

  if (!Number.isFinite(x)) {
    return Number.isNaN(x) ? 'NaN' : x > 0 ? 'Infinity' : '−Infinity';
  }

  const [mantissa, exponent] = x.toExponential(digits).split('e');
  const power = Number(exponent);

  if (power === 0) {
    return mantissa.replace('-', '−');
  }

  return `${mantissa.replace('-', '−')} × 10${String(power).split('').map(c => SUPERSCRIPT[c]).join('')}`;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let idCounter = 0;

export function uid(prefix = 'vz') {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

// el('button', { class: 'x', onClick: fn, 'aria-label': 'y' }, 'text', childNode, ...)
// Text is always inserted as text, never parsed as HTML.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  setProps(node, props);
  append(node, children);

  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);

  setProps(node, props);
  append(node, children);

  return node;
}

function setProps(node, props) {
  Object.entries(props).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) {
      return;
    }

    if (key === 'class') {
      node.setAttribute('class', value);
    } else if (key === 'text') {
      node.textContent = value;
    } else if (/^on[A-Z]/.test(key)) {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  });
}

function append(node, children) {
  children.flat(Infinity).forEach(child => {
    if (child === undefined || child === null || child === false) {
      return;
    }

    // Catches a control object passed instead of its .node.
    if (typeof child === 'object' && !(child instanceof Node)) {
      throw new TypeError('el(): a child is an object, not a DOM node');
    }

    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}

// --- Controls ---------------------------------------------------------------------------------

export function button(label, onClick, { primary = false, title, ariaLabel } = {}) {
  return el('button', {
    type: 'button',
    class: primary ? 'vz-btn vz-btn--primary' : 'vz-btn',
    title,
    'aria-label': ariaLabel,
    onClick,
  }, label);
}

// A play/pause toggle button bound to a loop.
export function playButton(loop, { play = 'Play', pause = 'Pause' } = {}) {
  const node = button(play, () => loop.toggle(), { primary: true });

  loop.onChange(running => {
    node.textContent = running ? pause : play;
    node.setAttribute('aria-pressed', String(running));
  });
  node.setAttribute('aria-pressed', 'false');

  return node;
}

// Segmented control: options = [{ value, label }].
export function segmented(options, value, onChange, ariaLabel) {
  let current = value;
  const node = el('div', { class: 'vz-seg', role: 'group', 'aria-label': ariaLabel });
  const buttons = options.map(option => el('button', {
    type: 'button',
    'aria-pressed': String(option.value === value),
    onClick: () => set(option.value, true),
  }, option.label));

  function set(next, notify = false) {
    current = next;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === next)));

    if (notify) {
      onChange(next);
    }
  }

  node.append(...buttons);

  return { node, set, get: () => current };
}

export function slider({ label, min, max, step = 1, value, format = v => String(v), onInput, width }) {
  const id = uid('range');
  const input = el('input', { type: 'range', id, min, max, step, value });
  const output = el('output', { for: id }, format(value));
  const node = el('div', { class: 'vz-range' }, el('label', { for: id }, label), input, output);

  if (width) {
    node.style.setProperty('--vz-range-width', width);
  }

  input.addEventListener('input', () => {
    const v = Number(input.value);

    output.textContent = format(v);
    onInput(v);
  });

  return {
    node,
    input,
    get: () => Number(input.value),
    set(v) {
      input.value = v;
      output.textContent = format(Number(input.value));
    },
  };
}

export function select(options, value, onChange, ariaLabel) {
  const node = el('select', { class: 'vz-select', 'aria-label': ariaLabel },
    options.map(option => el('option', { value: option.value, selected: option.value === value }, option.label)));

  node.addEventListener('change', () => onChange(node.value));

  return node;
}

export function checkbox(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked });
  const node = el('label', { class: 'vz-check' }, input, label);

  input.addEventListener('change', () => onChange(input.checked));

  return { node, input, get: () => input.checked };
}

export function stat(label, initial = '–') {
  const name = el('span', {}, label);
  const value = el('b', {}, initial);
  const node = el('div', { class: 'vz-stat' }, name, value);

  return {
    node,
    set: text => { value.textContent = text; },
    setLabel: text => { name.textContent = text; },
  };
}

// items: [{ color, label }] or [{ style, label }]. A style that depends on derived colours (a ramp, a
// gradient) can be a function: it is evaluated again when the theme changes.
export function legend(items) {
  return el('ul', { class: 'vz-legend' }, items.map(item => {
    const swatch = el('i', { 'aria-hidden': 'true', style: swatchStyle(item) });

    if (typeof item.style === 'function') {
      themed.swatches.add({ swatch, item });
    }

    return el('li', {}, swatch, item.label);
  }));
}

function swatchStyle(item) {
  if (typeof item.style === 'function') {
    return item.style();
  }

  return item.style || `background:${item.color}`;
}

// --- Figure frame -----------------------------------------------------------------------------

// Builds the header and body of a figure placeholder:
//   <figure class="viz" data-viz="..."><figcaption class="viz__caption">...</figcaption></figure>
export function frame(figure, title) {
  const head = el('div', { class: 'viz__head' },
    el('span', { class: 'viz__badge' }, 'Interactive'),
    el('p', { class: 'viz__title' }, title));
  const body = el('div', { class: 'viz__body' });
  const caption = figure.querySelector('figcaption');

  figure.insertBefore(head, caption);
  figure.insertBefore(body, caption);

  return { head, body };
}

// Mounts every figure on the page that has a builder in `builders`. A figure whose builder throws
// stays hidden (see _viz.scss), so the page never shows a broken frame.
export function mountAll(builders) {
  document.querySelectorAll('figure.viz[data-viz]').forEach(figure => {
    const build = builders[figure.dataset.viz];

    if (!build) {
      return;
    }

    try {
      build(figure);
      figure.classList.add('is-ready');
    } catch (error) {
      console.error(`Interactive figure "${figure.dataset.viz}" failed:`, error);
    }
  });
}

// --- Theme changes ----------------------------------------------------------------------------

// When the reader changes the colour theme (theme.js), the figures follow without losing their state:
// the canvases are redrawn, the palette colours written into the figures' markup (SVG fills, legend
// swatches) are swapped for the new ones, and figures that use derived colours re-render.
const themed = { canvases: new Set(), swatches: new Set(), listeners: new Set() };

export function onThemeChange(listener) {
  themed.listeners.add(listener);
}

function recolor(root, swaps) {
  const swap = value => value.replace(/#([0-9a-f]{6})([0-9a-f]{2})?(?![0-9a-f])/gi, (match, hex, alpha) => {
    const next = swaps.get(`#${hex.toLowerCase()}`);

    return next ? next + (alpha || '') : match;
  });

  [root, ...root.querySelectorAll('[style], [fill], [stroke]')].forEach(node => {
    ['style', 'fill', 'stroke'].forEach(name => {
      const value = node.getAttribute(name);

      if (value && value.includes('#')) {
        const next = swap(value);

        if (next !== value) {
          node.setAttribute(name, next);
        }
      }
    });
  });
}

document.addEventListener('introai:themechange', () => {
  const previous = { ...COLORS };

  readColors();

  const swaps = new Map(Object.keys(COLORS).filter(key => previous[key] !== COLORS[key]).map(key => [previous[key], COLORS[key]]));

  if (!swaps.size) {
    return;
  }

  document.querySelectorAll('figure.viz').forEach(figure => recolor(figure, swaps));
  themed.swatches.forEach(({ swatch, item }) => swatch.setAttribute('style', item.style()));
  themed.canvases.forEach(({ view, onResize }) => {
    if (view.width) {
      onResize(view);
    }
  });
  themed.listeners.forEach(listener => listener());
});

// --- Canvas -----------------------------------------------------------------------------------

// A canvas that fills the width of `parent` and keeps a height of width * aspect (clamped). Drawing
// uses CSS pixels; the backing store is scaled for sharp lines on high-DPI screens.
export function createCanvas(parent, { aspect = 0.5, minHeight = 180, maxHeight = 560, onResize, label } = {}) {
  const canvas = el('canvas', { role: 'img', 'aria-label': label });
  const ctx = canvas.getContext('2d');
  const view = { canvas, ctx, width: 0, height: 0 };

  parent.append(canvas);

  if (onResize) {
    themed.canvases.add({ view, onResize });
  }

  // The first sizing does not call onResize: the caller has not received `view` yet.
  const resize = (notify = true) => {
    const width = Math.floor(parent.clientWidth);

    if (!width || width === view.width) {
      return;
    }

    const height = Math.round(clamp(width * aspect, minHeight, maxHeight));
    const ratio = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.width = width;
    view.height = height;

    if (onResize && notify) {
      onResize(view);
    }
  };

  view.resize = resize;

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => resize()).observe(parent);
  } else {
    window.addEventListener('resize', () => resize());
  }

  resize(false);

  return view;
}

export function pointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect();

  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// --- Animation --------------------------------------------------------------------------------

// requestAnimationFrame loop that runs only while `figure` is on screen and the tab is visible.
// tick(dt) gets the elapsed milliseconds since the previous frame (capped) and may return false to
// stop the loop.
export function createLoop(figure, tick) {
  let running = false;
  let visible = true;
  let frameId = 0;
  let last = 0;
  const listeners = [];

  const notify = () => listeners.forEach(listener => listener(running));

  const frameFn = time => {
    frameId = 0;

    if (!running || !visible || document.hidden) {
      last = 0;
      return;
    }

    const dt = last ? Math.min(64, time - last) : 16;
    last = time;

    if (tick(dt) === false) {
      stop();
      return;
    }

    frameId = window.requestAnimationFrame(frameFn);
  };

  const schedule = () => {
    if (running && visible && !document.hidden && !frameId) {
      frameId = window.requestAnimationFrame(frameFn);
    }
  };

  function start() {
    if (!running) {
      running = true;
      last = 0;
      schedule();
      notify();
    }
  }

  function stop() {
    if (running) {
      running = false;
      notify();
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      schedule();
    }, { rootMargin: '100px' }).observe(figure);
  }

  document.addEventListener('visibilitychange', schedule);

  return {
    start,
    stop,
    toggle: () => (running ? stop() : start()),
    isRunning: () => running,
    onChange: listener => listeners.push(listener),
  };
}

// --- Line chart -------------------------------------------------------------------------------

// A line chart on a canvas with solid hairline gridlines, an optional horizontal reference line,
// optional shaded horizontal bands and a crosshair read-out that follows the pointer or the arrow keys.
// series: [{ name, color }]; setData(xs, ys[]) where ys[k][i] belongs to series k at xs[i].
// bands: [{ from, to, label, color }], ranges of y to shade.
export function lineChart(parent, {
  series, height = 180, xLabel = '', yMin, yMax, yFormat = v => fmt(v, 2), xFormat = v => String(v),
  reference, bands = [], label, integer = false,
}) {
  const stage = el('div', { class: 'vz-stage vz-chart', style: 'position:relative' });
  const tip = el('div', { class: 'vz-tip', 'aria-hidden': 'true' });

  if (parent) {
    parent.append(stage);
  }

  let xs = [];
  let ys = series.map(() => []);
  let hover = -1;
  const pad = { left: 46, right: 14, top: 12, bottom: 30 };

  const view = createCanvas(stage, {
    aspect: height / 600,
    minHeight: height,
    maxHeight: height,
    label,
    onResize: () => draw(),
  });

  stage.append(tip);
  view.canvas.tabIndex = 0;

  function bounds() {
    let lo = yMin;
    let hi = yMax;

    if (lo === undefined || hi === undefined) {
      const values = ys.flat().filter(Number.isFinite);
      const dataLo = values.length ? Math.min(...values) : 0;
      const dataHi = values.length ? Math.max(...values) : 1;

      lo = lo === undefined ? dataLo : lo;
      hi = hi === undefined ? dataHi : hi;
    }

    if (hi - lo < 1e-9) {
      hi = lo + (integer ? 4 : 1);
    }

    return [lo, hi];
  }

  function niceTicks(lo, hi, count = 4) {
    const span = hi - lo;
    const rough = span / count;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const nice = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => span / s <= count + 0.5);
    const step = integer ? Math.max(1, Math.round(nice)) : nice;
    const ticks = [];

    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      ticks.push(Math.abs(v) < 1e-12 ? 0 : v);
    }

    return ticks;
  }

  function scales() {
    const [lo, hi] = bounds();
    const x0 = xs.length ? xs[0] : 0;
    const x1 = xs.length > 1 ? xs[xs.length - 1] : x0 + 1;
    const w = view.width - pad.left - pad.right;
    const h = view.height - pad.top - pad.bottom;

    return {
      lo,
      hi,
      sx: x => pad.left + ((x - x0) / (x1 - x0 || 1)) * w,
      sy: y => pad.top + (1 - (y - lo) / (hi - lo)) * h,
    };
  }

  function draw() {
    const { ctx, width, height: H } = view;
    const { lo, hi, sx, sy } = scales();

    ctx.clearRect(0, 0, width, H);
    ctx.font = '11px "Inter Variable", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    niceTicks(lo, hi).forEach(t => {
      const y = Math.round(sy(t)) + 0.5;

      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'right';
      ctx.fillText(yFormat(t), pad.left - 6, y);
    });

    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(pad.left, H - pad.bottom + 0.5);
    ctx.lineTo(width - pad.right, H - pad.bottom + 0.5);
    ctx.stroke();

    if (xs.length) {
      ctx.fillStyle = COLORS.muted;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(xFormat(xs[0]), pad.left, H - pad.bottom + 6);
      ctx.textAlign = 'right';
      ctx.fillText(xFormat(xs[xs.length - 1]), width - pad.right, H - pad.bottom + 6);
      ctx.textAlign = 'center';
      ctx.fillText(xLabel, (pad.left + width - pad.right) / 2, H - pad.bottom + 6);
    }

    bands.forEach(band => {
      const top = sy(clamp(Math.max(band.from, band.to), lo, hi));
      const bottom = sy(clamp(Math.min(band.from, band.to), lo, hi));

      if (bottom - top < 1) {
        return;
      }

      ctx.fillStyle = band.color || COLORS.yellow;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(pad.left, top, width - pad.left - pad.right, bottom - top);
      ctx.globalAlpha = 1;

      if (band.label) {
        ctx.fillStyle = COLORS.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(band.label, width - pad.right - 4, (top + bottom) / 2);
      }
    });

    if (reference && Number.isFinite(reference.value) && reference.value >= lo && reference.value <= hi) {
      const y = Math.round(sy(reference.value)) + 0.5;

      ctx.strokeStyle = COLORS.ink;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.ink;
      ctx.textBaseline = 'bottom';

      if (reference.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(reference.label, width - pad.right, y - 3);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(reference.label, pad.left + 4, y - 3);
      }
    }

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    series.forEach((s, k) => {
      const values = ys[k];

      ctx.strokeStyle = s.color;
      ctx.beginPath();

      let pen = false;

      for (let i = 0; i < xs.length; i++) {
        const v = values[i];

        if (!Number.isFinite(v)) {
          pen = false;
          continue;
        }

        const x = sx(xs[i]);
        const y = sy(clamp(v, lo, hi));

        if (pen) {
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
          pen = true;
        }
      }

      ctx.stroke();

      // End dot with a surface ring.
      const lastIndex = values.length - 1;

      if (lastIndex >= 0 && Number.isFinite(values[lastIndex])) {
        dot(ctx, sx(xs[lastIndex]), sy(clamp(values[lastIndex], lo, hi)), 4, s.color);
      }
    });

    if (hover >= 0 && hover < xs.length) {
      const x = Math.round(sx(xs[hover])) + 0.5;

      ctx.strokeStyle = COLORS.faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();

      series.forEach((s, k) => {
        const v = ys[k][hover];

        if (Number.isFinite(v)) {
          dot(ctx, sx(xs[hover]), sy(clamp(v, lo, hi)), 4, s.color);
        }
      });

      showTip(sx(xs[hover]));
    } else {
      tip.style.display = 'none';
    }
  }

  function showTip(x) {
    tip.replaceChildren(
      el('div', { class: 'vz-tip__x' }, `${xLabel ? `${xLabel} ` : ''}${xFormat(xs[hover])}`),
      ...series.map((s, k) => el('div', { class: 'vz-tip__row' },
        el('i', { style: `background:${s.color}` }),
        el('b', {}, Number.isFinite(ys[k][hover]) ? yFormat(ys[k][hover]) : '–'),
        el('span', {}, s.name)))
    );
    tip.style.display = 'block';

    const left = x + 12 + tip.offsetWidth > view.width ? x - 12 - tip.offsetWidth : x + 12;

    tip.style.left = `${left}px`;
    tip.style.top = `${pad.top}px`;
  }

  function nearest(px) {
    if (!xs.length) {
      return -1;
    }

    const { sx } = scales();
    let best = 0;

    for (let i = 1; i < xs.length; i++) {
      if (Math.abs(sx(xs[i]) - px) < Math.abs(sx(xs[best]) - px)) {
        best = i;
      }
    }

    return best;
  }

  view.canvas.addEventListener('pointermove', event => {
    hover = nearest(pointerPosition(view.canvas, event).x);
    draw();
  });

  view.canvas.addEventListener('pointerleave', () => {
    hover = -1;
    draw();
  });

  view.canvas.addEventListener('keydown', event => {
    if (!xs.length) {
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      hover = clamp((hover < 0 ? xs.length - 1 : hover) + (event.key === 'ArrowLeft' ? -1 : 1), 0, xs.length - 1);
      draw();
    }
  });

  view.canvas.addEventListener('blur', () => {
    hover = -1;
    draw();
  });

  return {
    node: stage,
    setData(nextXs, nextYs) {
      xs = nextXs;
      ys = nextYs;

      if (hover >= xs.length) {
        hover = -1;
      }

      draw();
    },
    setReference(next) {
      reference = next;
      draw();
    },
    draw,
  };
}

// A filled marker with a 2px surface ring.
export function dot(ctx, x, y, r, color, ring = COLORS.surface) {
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// Class markers: circle, square, triangle (the shape repeats the colour, so the classes stay
// distinguishable without colour).
export function marker(ctx, shape, x, y, r, color, ring = COLORS.surface) {
  const path = size => {
    ctx.beginPath();

    if (shape === 1) {
      ctx.rect(x - size * 0.9, y - size * 0.9, size * 1.8, size * 1.8);
    } else if (shape === 2) {
      ctx.moveTo(x, y - size * 1.15);
      ctx.lineTo(x + size * 1.05, y + size * 0.75);
      ctx.lineTo(x - size * 1.05, y + size * 0.75);
      ctx.closePath();
    } else {
      ctx.arc(x, y, size, 0, Math.PI * 2);
    }
  };

  path(r + 1.75);
  ctx.fillStyle = ring;
  ctx.fill();
  path(r);
  ctx.fillStyle = color;
  ctx.fill();
}
