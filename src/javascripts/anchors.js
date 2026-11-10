// Stable anchors for the sections and the exercises of a page, made from their text: the same heading
// gets the same anchor on every visit, and a link from another page (a search result, for example) can
// name a section before that page has run its scripts. The search computes the anchors of the pages it
// reads with this same function, so the two always agree.
import Collapse from 'bootstrap/js/src/collapse.js';
import { kebabCase } from 'lodash-es';

import { navOffset, prepareJump, scrollToId } from './utils';

function claim(base, taken) {
  let id = base;

  for (let n = 2; taken.has(id); n++) {
    id = `${base}-${n}`;
  }

  taken.add(id);

  return id;
}

// { sections: [{ node, id }], exercises: [{ node, id }] } in the order of the page. A heading that has an
// id in the page keeps it: other pages link to such ids (../week4/#optimization). Only the ids written in
// the page count as taken, so a page parsed from its HTML gets the same anchors as the page in the browser.
export function anchors(doc) {
  const taken = new Set([...doc.querySelectorAll('[id]')].map(node => node.id));

  const sections = [...doc.querySelectorAll('.material-heading')].map(node => ({
    node,
    id: node.id || claim(kebabCase(node.textContent) || 'section', taken),
  }));

  const exercises = [...doc.querySelectorAll('.exercise')].map(node => {
    const heading = node.querySelector('.exercise__heading');

    return { node, id: claim(`exercise-${kebabCase(heading ? heading.textContent : '') || 'item'}`, taken) };
  });

  return { sections, exercises };
}

// Gives the sections their ids and the exercises theirs (read by exercises.js). Runs before the other
// modules, while the page still has only the ids of its HTML.
export function applyAnchors(doc = document) {
  const { sections, exercises } = anchors(doc);

  sections.forEach(({ node, id }) => {
    node.id = id;
  });

  exercises.forEach(({ node, id }) => {
    node.setAttribute('data-anchor', id);
  });
}

// Goes to the section or the exercise with this id; an exercise is opened first. The addresses that the
// pages had before (#section-12-attention-layer, #exercise-3-towers-of-hanoi-1-p) still lead there.
export function reveal(id, instant = false) {
  let target = document.getElementById(id);

  if (!target) {
    const old = id.match(/^(section|exercise)-\d+-(.+?)(?:-root)?$/);

    if (old) {
      target = document.getElementById(old[1] === 'section' ? old[2] : `exercise-${old[2]}`);
    }
  }

  if (!target) {
    return false;
  }

  const exercise = target.closest('.exercise');

  if (exercise) {
    const body = exercise.querySelector('.collapse');

    if (body && !body.classList.contains('show')) {
      Collapse.getOrCreateInstance(body, { toggle: false }).show();
    }

    target = exercise;
  }

  if (instant) {
    prepareJump(target);
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navOffset(), behavior: 'auto' });
  } else {
    // The same short animation as the links of the table of contents.
    scrollToId(target.id);
  }

  return true;
}

// The browser looks for the target of the address (#...) while the page loads, before the scripts have
// given the sections and the exercises their ids: go there now. Fonts that load later can move the
// target, so once more when the page has loaded, unless the reader has scrolled meanwhile.
export function revealHash() {
  let id = '';

  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch (error) {
    return;
  }

  if (!id || !reveal(id, true) || document.readyState === 'complete') {
    return;
  }

  const y = window.scrollY;

  window.addEventListener('load', () => {
    if (Math.abs(window.scrollY - y) < 2) {
      reveal(id, true);
    }
  }, { once: true });
}
