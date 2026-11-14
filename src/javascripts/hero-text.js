// The text of the page header in motion (_hero.scss). When the router changes page, the header changes in place
// instead of fading out and in: the letters of the title roll over into those of the new title, from left to
// right; the numbers (the week, the reading time, the exercises, the done ones) roll like the digits of a counter,
// up or down; and the words that stay ("of 7", "exercises", "done") and the icons stay where they are. On the
// first page of a visit the header comes in the same way, after the network of hero.js has burst out (the intro).
//
// The new text is in the page at once, in its final place, so nothing moves when the animation ends: while it
// runs, the text is transparent and the animation draws each letter over it, in a little window where the browser
// has put that letter (the letters of the old text where they were). Only transforms and opacity are animated,
// on the compositor, so the animation stays smooth while the router puts the rest of the page in.
import { prefersReducedMotion } from './utils';

// The letters that a letter rolls through: narrow ones for a narrow letter, so that they fit its window.
const GLYPHS = 'ABCDEFGHKMNPRSTUVXYZ0234568#%&*+=<>?';
const NARROW = '1Iijlt|!:/()[]';
const OUT = 'cubic-bezier(.55, 0, .8, .3)';
const IN = 'cubic-bezier(.2, .9, .3, 1.06)';
const MOVE = 'cubic-bezier(.2, .8, .2, 1)';
const EMPTY = { text: '', letters: [] };
// The animations that are drawing an element's text: element -> how to end them.
const running = new WeakMap();

const glyph = (narrow = false) => {
  const set = narrow ? NARROW : GLYPHS;

  return set[Math.floor(Math.random() * set.length)];
};

// The text of an element that can roll: its one text node with letters in it (an icon beside it is fine).
function textNodeOf(element) {
  const texts = [...element.childNodes].filter(node => node.nodeType === 3 && node.data.trim());

  return texts.length === 1 && [...element.children].every(child => child.matches('.fa, .fa-regular, .hero-fx')) ? texts[0] : null;
}

// Every letter of a text node, with the box where the browser has drawn it (none for spaces).
function lettersOf(node) {
  const range = document.createRange();
  const letters = [];
  let offset = 0;

  for (const char of node.data) {
    let rect = null;

    if (char.trim()) {
      range.setStart(node, offset);
      range.setEnd(node, offset + char.length);

      const box = range.getClientRects()[0];

      rect = box && box.width ? { left: box.left, top: box.top, width: box.width, height: box.height } : null;
    }

    letters.push({ char, rect });
    offset += char.length;
  }

  return letters;
}

// Ends the animation of an element's text at once.
function stop(element) {
  const done = running.get(element);

  if (done) {
    running.delete(element);
    done();
    element.classList.remove('is-morphing');
  }
}

// An element's text and its letters, as they are drawn now; null if it cannot roll.
function snapshot(element) {
  stop(element);

  const node = textNodeOf(element);

  return node ? { text: node.data, letters: lettersOf(node) } : null;
}

// The words and numbers of a text: [{ kind, text, letters }], without the spaces.
function tokensOf(letters) {
  const tokens = [];

  letters.forEach(letter => {
    const kind = !letter.char.trim() ? '' : /\d/.test(letter.char) ? 'number' : 'word';
    const last = tokens[tokens.length - 1];

    if (last && last.kind === kind) {
      last.letters.push(letter);
    } else {
      tokens.push({ kind, letters: [letter] });
    }
  });

  return tokens.filter(token => token.kind).map(token => ({ ...token, text: token.letters.map(letter => letter.char).join('') }));
}

// A window over a letter's box (`rect`, relative to `base`), with a strip of lines in it, top to bottom.
function cell(layer, base, rect, lines) {
  const box = document.createElement('span');
  const strip = document.createElement('span');

  box.className = 'hero-fx__cell';
  box.style.cssText = `left:${rect.left - base.left}px;top:${rect.top - base.top}px;width:${rect.width}px;`
    + `height:${rect.height}px;--h:${rect.height}px`;
  strip.className = 'hero-fx__strip';
  lines.forEach(({ text, ghost }) => {
    const line = document.createElement('span');

    line.textContent = text;

    if (ghost) {
      line.className = 'is-ghost';
    }

    strip.append(line);
  });
  box.append(strip);
  layer.append(box);

  return { box, strip, height: rect.height };
}

// Moves a window from where its letter was (`from`) to where it is now.
function travel(box, from, to, delay, list) {
  const dx = from.left - to.left;
  const dy = from.top - to.top;

  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    list.push(box.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: 520, delay, easing: MOVE, fill: 'both' }));
  }
}

// An old letter lifts out of its window and fades.
function rollOut(layer, base, letter, delay, list) {
  const { strip, height } = cell(layer, base, letter.rect, [{ text: letter.char }]);

  list.push(strip.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-0.9 * height}px)`, opacity: 0 }],
    { duration: 240, delay, easing: OUT, fill: 'both' }));
}

// A new letter rolls in from below, through a few random ones (narrow ones if it is narrow: `em` is the size of
// the text), and lands; a streak of light runs under it as it does, the streaks of a word joining into one line.
function rollIn(layer, base, letter, delay, list, { spins = 2, duration = 520, em = 16 } = {}) {
  const narrow = letter.rect.width < em * 0.42;
  const lines = [...Array(spins)].map(() => ({ text: glyph(narrow), ghost: true })).concat({ text: letter.char });
  const { box, strip, height } = cell(layer, base, letter.rect, lines);
  const flash = document.createElement('span');

  flash.className = 'hero-fx__flash';
  box.append(flash);
  list.push(
    strip.animate([{ transform: `translateY(${height}px)` }, { transform: `translateY(${-(lines.length - 1) * height}px)` }],
      { duration, delay, easing: IN, fill: 'both' }),
    flash.animate([{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'none', offset: 0.3 }, { opacity: 0, transform: 'none' }],
      { duration: 380, delay: delay + duration * 0.62, easing: 'ease-out', fill: 'both' }),
  );
}

// A letter that stays: it only moves, if the text around it has changed.
function stay(layer, base, from, to, delay, list) {
  const { box } = cell(layer, base, to.rect, [{ text: to.char }]);

  travel(box, from.rect, to.rect, delay, list);
}

// A number rolls to another like the digits of a counter: each digit through those between, up when the number
// grows and down when it shrinks; a digit that appears rolls in, one that goes rolls out.
function count(layer, base, a, b, delay, list) {
  const up = Number(b.text) >= Number(a.text);

  for (let k = 1; k <= Math.max(a.letters.length, b.letters.length); k++) {
    const from = a.letters[a.letters.length - k];
    const to = b.letters[b.letters.length - k];
    const wait = delay + (k - 1) * 40;

    if (!to) {
      rollOut(layer, base, from, wait, list);
    } else if (!from) {
      rollIn(layer, base, to, wait, list, { spins: 1 });
    } else if (from.char === to.char) {
      stay(layer, base, from, to, wait, list);
    } else {
      const o = Number(from.char);
      const steps = up ? (Number(to.char) - o + 10) % 10 : (o - Number(to.char) + 10) % 10;
      const digits = [...Array(steps + 1)].map((_, i) => ({ text: String((up ? o + i : o - i + 10) % 10) }));
      const lines = up ? digits : digits.reverse();
      const { box, strip, height } = cell(layer, base, to.rect, lines);
      const end = `translateY(${-(lines.length - 1) * height}px)`;

      list.push(strip.animate(up ? [{ transform: 'none' }, { transform: end }] : [{ transform: end }, { transform: 'none' }],
        { duration: 420 + 55 * steps, delay: wait, easing: 'cubic-bezier(.3, .9, .3, 1.04)', fill: 'both' }));
      travel(box, from.rect, to.rect, wait, list);
    }
  }
}

// Ends the animation when all its parts have: the drawn letters go, the text shows again.
function settle(element, layer, list) {
  const done = () => {
    layer.remove();

    if (running.get(element) === done) {
      running.delete(element);
      element.classList.remove('is-morphing');
    }
  };

  running.set(element, done);
  Promise.all(list.map(animation => animation.finished)).then(done, done);
}

// Animates the text of `element` (already the new one) from what it was (`before`, a snapshot). With
// `scramble`, every letter rolls (a title); otherwise the words and numbers are matched from the end, so that
// "30 min read" becomes "1 h 18 min read" with "min read" staying. Returns the animations.
function play(element, before, { scramble = false, delay = 0 } = {}) {
  const node = textNodeOf(element);

  if (!node || !before || (before.text === node.data && !scramble)) {
    return [];
  }

  const after = lettersOf(node);
  const base = element.getBoundingClientRect();
  const list = [];
  const layer = document.createElement('span');
  const style = getComputedStyle(element);
  const em = parseFloat(style.fontSize) || 16;

  layer.className = 'hero-fx';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.color = style.color;
  element.classList.add('is-morphing');
  element.append(layer);

  if (scramble) {
    const old = before.letters.filter(letter => letter.rect);
    const now = after.filter(letter => letter.rect);

    // The old letters lift away from left to right, and the new ones roll in after them.
    old.forEach((letter, i) => rollOut(layer, base, letter, delay + 200 * i / old.length, list));
    now.forEach((letter, i) => rollIn(layer, base, letter, delay + 120 + 420 * i / now.length, list,
      { spins: 2 + (i % 2), duration: 440 + Math.random() * 140, em }));
  } else {
    const a = tokensOf(before.letters);
    const b = tokensOf(after);
    let i = a.length - 1;
    let j = b.length - 1;

    for (; i >= 0 && j >= 0; i--, j--) {
      if (a[i].text === b[j].text) {
        a[i].letters.forEach((letter, k) => stay(layer, base, letter, b[j].letters[k], delay, list));
      } else if (a[i].kind === 'number' && b[j].kind === 'number') {
        count(layer, base, a[i], b[j], delay, list);
      } else {
        a[i].letters.forEach(letter => rollOut(layer, base, letter, delay, list));
        b[j].letters.forEach((letter, k) => rollIn(layer, base, letter, delay + 60 + 30 * k, list, { em }));
      }
    }

    a.slice(0, i + 1).forEach(token => token.letters.forEach(letter => rollOut(layer, base, letter, delay, list)));
    b.slice(0, j + 1).forEach(token => token.letters.forEach((letter, k) => rollIn(layer, base, letter, delay + 60 + 30 * k, list, { em })));
  }

  settle(element, layer, list);

  return list;
}

// Changes the text of `element` (a number under the title, as progress.js does) and rolls it there; `animate`
// false changes it at once, unless it is rolling already.
export function morphText(element, text, { animate = true } = {}) {
  const node = textNodeOf(element);

  if (!node || node.data === text) {
    return;
  }

  if (prefersReducedMotion() || (!animate && !running.has(element)) || !element.getClientRects().length) {
    stop(element);
    node.data = text;
    return;
  }

  const before = snapshot(element);

  node.data = text;
  play(element, before);
}

function enter(element, delay, list) {
  list.push(element.animate([{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
    { duration: 480, delay, easing: MOVE, fill: 'backwards' }));
}

// The parts of a header: how each rolls into the next page's. Lead and buttons (the front page) fade.
const PARTS = [
  ['.page-hero__eyebrow > b', 'text', 0],
  ['.page-hero__eyebrow > span', 'text', 40],
  ['.page-hero__title', 'title', 60],
  ['.page-hero__lead', 'block', 220],
  ['.page-hero__actions', 'block', 280],
  ['.page-hero__meta', 'meta', 160],
];

// The items of the line under the title, by their icons.
const iconsOf = meta => [...meta.children].map(item => (item.querySelector('i') || {}).className).join();

function measure(element, kind) {
  if (!element) {
    return null;
  }

  stop(element);
  element.querySelectorAll('.hero-fx').forEach(layer => layer.remove());

  return {
    element,
    rect: element.getBoundingClientRect(),
    snap: kind === 'meta' || kind === 'block' ? null : snapshot(element),
    items: kind === 'meta' ? [...element.children].map(snapshot) : null,
    icons: kind === 'meta' ? iconsOf(element) : '',
    html: element.innerHTML,
  };
}

// For the router: replaces the text of the header (`old`, a .container) with the next page's (`next`) and rolls
// it over. False if it cannot (the reader prefers reduced motion, or the header is not shown).
export function morphHero(old, next) {
  const hero = old.parentElement;

  if (prefersReducedMotion() || typeof next.animate !== 'function' || !hero || !hero.getClientRects().length) {
    return false;
  }

  const before = PARTS.map(([selector, kind]) => measure(old.querySelector(selector), kind));
  const box = hero.getBoundingClientRect();
  const leaving = document.createElement('div');
  const list = [];
  const ghosts = [];

  old.replaceWith(next);

  // A part that the next page does not have, or that cannot roll: a copy of it fades out where it was.
  const ghost = part => {
    const copy = part.element.cloneNode(true);

    copy.classList.remove('is-morphing');
    copy.style.cssText = `position:absolute;inset:auto;left:${part.rect.left - box.left}px;top:${part.rect.top - box.top}px;`
      + `width:${part.rect.width}px;margin:0;transform:none`;
    leaving.append(copy);
    ghosts.push(copy.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(4px)' }],
      { duration: 260, easing: OUT, fill: 'forwards' }));
  };

  PARTS.forEach(([selector, kind, delay], index) => {
    const was = before[index];
    const now = next.querySelector(selector);

    if (!now) {
      if (was && kind !== 'text') {
        ghost(was);
      }
    } else if (!was) {
      enter(now, delay, list);
    } else if (kind === 'title' || kind === 'text') {
      if (was.snap && textNodeOf(now)) {
        list.push(...play(now, was.snap, { scramble: kind === 'title' && was.snap.text !== textNodeOf(now).data, delay }));
      }
    } else if (kind === 'meta' && was.icons === iconsOf(now)) {
      [...now.children].forEach((item, i) => list.push(...play(item, was.items[i], { delay: delay + 60 * i })));
    } else if (was.html !== now.innerHTML) {
      ghost(was);
      enter(now, delay, list);
    }
  });

  if (ghosts.length) {
    leaving.className = 'container is-leaving';
    leaving.setAttribute('aria-hidden', 'true');
    leaving.inert = true;
    hero.append(leaving);
    Promise.all(ghosts.map(animation => animation.finished)).then(() => leaving.remove(), () => leaving.remove());
  }

  return true;
}

// The first page of a visit: the header's text comes in after the network has burst out (hero.js), the numbers
// counting up from 0. Any click, key, wheel or touch ends it at once.
export function playIntro() {
  const root = document.documentElement;

  if (!root.classList.contains('hero-intro')) {
    return;
  }

  const container = document.querySelector('.page-hero > .container');
  const started = Number(root.getAttribute('data-hero-intro')) || performance.now();
  const late = performance.now() - started;
  const end = () => root.classList.remove('hero-intro', 'hero-intro--run', 'hero-intro--go');

  // Too late for the text to come in (a slow start: it is shown by then, _hero.scss), or not at the top of the page.
  if (!container || prefersReducedMotion() || performance.now() > 1450 || window.scrollY > 40 || typeof container.animate !== 'function') {
    end();
    return;
  }

  const at = ms => Math.max(0, ms - late);
  const list = [];
  const find = selector => container.querySelector(selector);
  const eyebrow = find('.page-hero__eyebrow');
  const meta = find('.page-hero__meta');

  root.classList.add('hero-intro--run');

  if (eyebrow) {
    list.push(eyebrow.animate([{ opacity: 0, transform: 'translateY(8px) scale(.94)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
      { duration: 560, delay: at(160), easing: MOVE, fill: 'backwards' }));
  }

  [['.page-hero__eyebrow > b', 240], ['.page-hero__eyebrow > span', 320], ['.page-hero__title', 380]].forEach(([selector, ms]) => {
    const element = find(selector);

    if (element) {
      list.push(...play(element, EMPTY, { scramble: true, delay: at(ms) }));
    }
  });

  if (meta) {
    enter(meta, at(720), list);
    [...meta.children].forEach((item, i) => {
      const now = snapshot(item);

      if (now) {
        // The numbers count up from 0.
        const zero = now.letters.map(letter => ({ ...letter, char: /\d/.test(letter.char) ? '0' : letter.char }));

        list.push(...play(item, { text: zero.map(letter => letter.char).join(''), letters: zero }, { delay: at(780 + 70 * i) }));
      }
    });
  }

  [['.page-hero__lead', 760], ['.page-hero__actions', 880]].forEach(([selector, ms]) => {
    const element = find(selector);

    if (element) {
      enter(element, at(ms), list);
    }
  });

  const skip = () => list.forEach(animation => animation.finish());

  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type => window.addEventListener(type, skip, { once: true, passive: true, capture: true }));
  Promise.all(list.map(animation => animation.finished)).then(end, end);
}
