// The network of the page header, drawn for hero.js (javascripts/hero-render.js). In a worker, on the canvas that
// hero.js hands over (an OffscreenCanvas), so that it is drawn 60 times a second or more whatever the page itself
// is busy with: a change of page, a long week being set up, the first seconds of a visit. In a browser whose
// workers cannot draw, the same script runs on the page (window.IntroAIHeroRender). hero.js and this script talk
// with messages:
//
//   to here:    init { canvas, still, dark, intro, previous }, resize { width, height, ratio }, visible { visible },
//               theme { dark }, pulse (the router changes page), skip (the reader ends the intro), carry { previous }
//               (back to the page from the browser's memory)
//   from here:  ready (the first drawing), intro { at } (the intro has started, at this time since the epoch),
//               mask { on } (the CSS mask of the canvas: during the intro), state { time, width, height, nodes }
//               (from time to time, for the next page)
//
// The network lives in a field of the same size on every page (the canvas is at least 384 px high, more than any
// header: _hero.scss), of which a shorter header simply shows less, so the nodes keep their places; it is drawn
// only while the header is on screen. Two moments set it in motion: the first page of a visit opens with the
// intro, in which the network bursts out of a point of light in a spiral and connects as it settles (with the
// aurora and the scan line of _hero.scss, and the text of hero-text.js); and when the router changes page, a wave
// of light runs through it from the left, as the letters of the new title roll in.
const LINK_DISTANCE = 130;
// The nodes move a step every 1/60 s, whatever the refresh rate of the screen (a 120 Hz screen would otherwise run
// them twice as fast). The network is drawn with every frame of a screen of up to 100 Hz, and with every second
// (third, fourth) frame of a faster one: 60 to 100 times a second. A frame that comes less than GAP after the last
// drawing is skipped: 9.2 ms is halfway between the frames of a 100 Hz screen (10 ms apart) and those of a 120 Hz
// one (8.3 ms), so that a frame a little early or late never changes the choice. (A gap of 1/60 s would draw a
// 75 Hz screen at 37.5 frames a second and a 144 Hz one at 48.)
const FRAME = 1000 / 60;
const GAP = 9.2;
const INTRO = 1500;
const PULSE = 1100;
// The nodes as hero.js keeps them for the next page, at most twice a second.
const STATE_EVERY = 500;

// The lines and the nodes are drawn grouped by opacity, a path for each step of it, instead of one by one: some
// twenty strokes a frame instead of three hundred, with steps too small to see.
const STEPS = 24;
const MOST = 0.9;

const ease = t => 1 - (1 - t) ** 3;
const clamp = t => Math.min(1, Math.max(0, t));
const level = alpha => Math.min(STEPS - 1, Math.floor(alpha / MOST * STEPS));
const shade = index => ((index + 0.5) / STEPS * MOST).toFixed(3);

function createRenderer(post) {
  let canvas = null;
  let context = null;
  let width = 0;
  let height = 0;
  let nodes = [];
  let still = false;
  let dark = false;
  let visible = true;
  let previous = null;
  // The intro ({ start }, the time of its first frame) and the wave of a change of page ({ start }).
  let intro = null;
  let pulse = null;
  let frame = 0;
  // The time of the last drawing, and the steps not yet taken.
  let drawn = 0;
  let owed = 0;
  let stated = 0;
  let ready = false;
  let masked = false;
  // The groups of lines and nodes by opacity (draw), kept from frame to frame so that drawing allocates nothing.
  const lines = Array.from({ length: STEPS }, () => []);
  const dots = { '37, 99, 235': Array.from({ length: STEPS }, () => []), '255, 171, 14': Array.from({ length: STEPS }, () => []) };
  const nextFrame = typeof requestAnimationFrame === 'function'
    ? callback => requestAnimationFrame(callback)
    : callback => setTimeout(() => callback(performance.now()), FRAME);

  // A fixed seed, so the still picture is the same on every visit.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  function createNode(index) {
    return {
      x: random() * width,
      y: random() * height,
      vx: (random() - 0.5) * 0.18,
      vy: (random() - 0.5) * 0.18,
      radius: 1.2 + random() * 1.6,
      accent: index % 9 === 0,
    };
  }

  function step() {
    nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0 || node.x > width) {
        node.vx = -node.vx;
        node.x = Math.min(width, Math.max(0, node.x));
      }

      if (node.y < 0 || node.y > height) {
        node.vy = -node.vy;
        node.y = Math.min(height, Math.max(0, node.y));
      }
    });
  }

  // Fits the nodes to a new size of the field: they keep their places (those of the previous page, the first
  // time, moved on by the time that the change of page took; scaled only if the field itself changed, as when the
  // window is resized), and nodes are added or dropped so that the density stays the same.
  function fitNodes(oldWidth, oldHeight) {
    const count = Math.round(Math.min(96, Math.max(18, width * height / 9000)));
    let fromWidth = oldWidth;
    let fromHeight = oldHeight;
    let steps = 0;

    if (previous) {
      nodes = previous.nodes.map(([x, y, vx, vy, radius], index) => ({ x, y, vx, vy, radius, accent: index % 9 === 0 }));
      fromWidth = previous.width;
      fromHeight = previous.height;
      steps = Math.min(600, Math.max(0, Math.round((Date.now() - previous.time) / FRAME)));
      previous = null;
    }

    if (fromWidth && fromHeight && (Math.abs(fromWidth - width) > 1 || Math.abs(fromHeight - height) > 1)) {
      nodes.forEach(node => {
        node.x *= width / fromWidth;
        node.y *= height / fromHeight;
      });
    }

    nodes = nodes.slice(0, count);

    while (nodes.length < count) {
      nodes.push(createNode(nodes.length));
    }

    for (let i = 0; i < steps; i++) {
      step();
    }
  }

  function state() {
    if (nodes.length && !still) {
      post({
        type: 'state',
        time: Date.now(),
        width,
        height,
        nodes: nodes.map(node => [node.x, node.y, node.vx, node.vy, node.radius].map(value => Math.round(value * 1000) / 1000)),
      });
    }
  }

  // Where a node is drawn during the intro: on its way out of the point of light, along a spiral, the nodes near
  // the point first. `t` is the time since the intro started.
  function placed(node, t, focus, reach) {
    const dx = node.x - focus.x;
    const dy = node.y - focus.y;
    const p = ease(clamp((t - 140 - 420 * Math.hypot(dx, dy) / reach) / 900));
    const turn = (1 - p) * 1.4;
    const cos = Math.cos(turn) * p;
    const sin = Math.sin(turn) * p;

    return { x: focus.x + dx * cos - dy * sin, y: focus.y + dx * sin + dy * cos, p };
  }

  function draw(now = performance.now()) {
    // Before its first frame, the intro is at its start: nothing but the empty field.
    const t = intro && intro.start ? now - intro.start : 0;
    const focus = { x: width * 0.72, y: Math.min(height, 330) * 0.42 };
    const reach = Math.hypot(width, height);
    // The wave of a change of page: how far it has gone, and how bright it is where it passes.
    const wave = pulse ? clamp((now - pulse.start) / PULSE) : 1;
    const front = ease(wave) * width * 1.15;
    const glow = (x, y) => (wave < 1 ? Math.exp(-(((Math.hypot(x - width * 0.06, y - height * 0.45) - front) / 90) ** 2)) * (1 - wave * 0.5) : 0);
    // Where the nodes are drawn: where they are, but during the intro.
    const at = intro ? nodes.map(node => placed(node, t, focus, reach)) : nodes;
    const far = LINK_DISTANCE * LINK_DISTANCE;
    // The network fades out towards the text on the left: drawn into the opacity (a CSS mask on the canvas would
    // cost a compositing pass every frame, so it is used only during the intro, for its light and ring).
    const fade = intro ? () => 1 : x => {
      const u = x / width;

      return u >= 0.75 ? 1 : u <= 0.4 ? 0.35 * Math.max(0, u) / 0.4 : 0.35 + 0.65 * (u - 0.4) / 0.35;
    };

    if (masked !== Boolean(intro)) {
      masked = Boolean(intro);
      post({ type: 'mask', on: masked });
    }

    lines.forEach(list => { list.length = 0; });
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        // Far apart in x alone, or in the square of the distance: no line (no square root for most pairs).
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const p = intro ? Math.min(at[i].p, at[j].p) : 1;

        if (dx < LINK_DISTANCE && dx > -LINK_DISTANCE && dx * dx + dy * dy < far && p > 0) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          const mx = (at[i].x + at[j].x) / 2;
          const alpha = Math.min(MOST, (0.32 + 0.5 * glow(mx, (at[i].y + at[j].y) / 2)) * (1 - distance / LINK_DISTANCE) * p * p) * fade(mx);

          if (alpha > 0.004) {
            lines[level(alpha)].push(at[i].x, at[i].y, at[j].x, at[j].y);
          }
        }
      }
    }

    lines.forEach((list, index) => {
      if (list.length) {
        context.strokeStyle = `rgba(82, 138, 252, ${shade(index)})`;
        context.beginPath();

        for (let k = 0; k < list.length; k += 4) {
          context.moveTo(list[k], list[k + 1]);
          context.lineTo(list[k + 2], list[k + 3]);
        }

        context.stroke();
      }
    });

    if (intro) {
      // The point of light, the shockwave around it, and a streak behind every node on its way.
      const bang = clamp(t / INTRO);
      const core = context.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, 30 + 150 * bang);
      const light = Math.sin(Math.PI * clamp(t / 700)) * 0.8;

      context.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      core.addColorStop(0, `rgba(${dark ? '190, 210, 255' : '82, 138, 252'}, ${light})`);
      core.addColorStop(0.4, `rgba(124, 92, 255, ${light * 0.35})`);
      core.addColorStop(1, 'rgba(124, 92, 255, 0)');
      context.fillStyle = core;
      context.fillRect(0, 0, width, height);

      const ring = ease(clamp((t - 120) / 1100));

      if (ring > 0 && ring < 1) {
        context.lineWidth = 3 * (1 - ring) + 0.5;
        context.strokeStyle = `rgba(124, 92, 255, ${0.55 * (1 - ring)})`;
        context.beginPath();
        context.arc(focus.x, focus.y, ring * reach * 0.6, 0, Math.PI * 2);
        context.stroke();
      }

      context.lineWidth = 1.5;
      nodes.forEach((node, i) => {
        const p = at[i].p;

        if (p > 0 && p < 1) {
          const tail = placed(node, t - 45, focus, reach);

          context.strokeStyle = `rgba(82, 138, 252, ${0.7 * (1 - p)})`;
          context.beginPath();
          context.moveTo(tail.x, tail.y);
          context.lineTo(at[i].x, at[i].y);
          context.stroke();
        }
      });
      context.globalCompositeOperation = 'source-over';
    }

    // The nodes, grouped the same way: blue ones and the amber accents.
    Object.values(dots).forEach(groups => groups.forEach(list => { list.length = 0; }));
    nodes.forEach((node, i) => {
      const { x, y } = at[i];
      const p = intro ? at[i].p : 1;
      const lit = glow(x, y);
      const alpha = (node.accent ? MOST : Math.min(MOST, 0.55 + 0.45 * lit)) * fade(x);

      if (p > 0 && alpha > 0.004) {
        dots[node.accent ? '255, 171, 14' : '37, 99, 235'][level(alpha)].push(x, y, node.radius * (1 + 1.5 * lit + 1.5 * (1 - p)));
      }
    });

    Object.entries(dots).forEach(([color, groups]) => groups.forEach((list, index) => {
      if (list.length) {
        context.fillStyle = `rgba(${color}, ${shade(index)})`;
        context.beginPath();

        for (let k = 0; k < list.length; k += 3) {
          context.moveTo(list[k] + list[k + 2], list[k + 1]);
          context.arc(list[k], list[k + 1], list[k + 2], 0, Math.PI * 2);
        }

        context.fill();
      }
    }));

    if (intro && intro.start && t > INTRO) {
      intro = null;
    }

    if (pulse && wave >= 1) {
      pulse = null;
    }

    if (!ready) {
      ready = true;
      post({ type: 'ready' });
    }
  }

  function tick(time) {
    frame = 0;

    if (!visible) {
      drawn = 0;
      state();
      return;
    }

    frame = nextFrame(tick);

    // The intro starts with the first frame; the text of the header joins it as soon as the page is ready
    // (hero-text.js), so that on a slow connection the burst is what the reader watches meanwhile.
    if (intro && !intro.start) {
      intro.start = time;
      post({ type: 'intro', at: performance.timeOrigin + time });
    }

    // Not twice in less than GAP: every second frame or more of a screen faster than 100 Hz.
    if (drawn && time - drawn < GAP) {
      return;
    }

    // At most a second of steps after a long pause.
    owed = Math.min(60, owed + (drawn ? (time - drawn) / FRAME : 1));
    drawn = time;

    for (; owed >= 1; owed -= 1) {
      step();
    }

    draw(time);

    if (time - stated > STATE_EVERY) {
      stated = time;
      state();
    }
  }

  function start() {
    if (!still && !frame && width && context) {
      frame = nextFrame(tick);
    }
  }

  return function receive(message) {
    switch (message.type) {
      case 'init':
        canvas = message.canvas;
        context = canvas.getContext('2d');
        still = message.still;
        dark = message.dark;
        previous = message.previous;
        intro = message.intro ? { start: 0 } : null;
        break;
      case 'resize': {
        const oldWidth = width;
        const oldHeight = height;

        if (!(message.width >= 1 && message.height >= 1)) {
          break;
        }

        width = message.width;
        height = message.height;
        canvas.width = Math.round(width * message.ratio);
        canvas.height = Math.round(height * message.ratio);
        context.setTransform(message.ratio, 0, 0, message.ratio, 0, 0);
        fitNodes(oldWidth, oldHeight);
        draw();
        start();
        break;
      }
      case 'visible':
        visible = message.visible;
        start();
        break;
      case 'theme':
        dark = message.dark;
        break;
      case 'pulse':
        intro = null;
        pulse = { start: performance.now() };
        start();
        break;
      case 'skip':
        intro = null;
        break;
      case 'carry':
        previous = message.previous;

        if (previous && width && height) {
          fitNodes(width, height);
          draw();
        }

        break;
      default:
    }
  };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const receive = createRenderer(message => self.postMessage(message));

  self.onmessage = event => receive(event.data);
} else {
  window.IntroAIHeroRender = createRenderer;
}
