// Folding parts of a page: the bodies of the exercises and the solutions. A link with
// data-bs-toggle="collapse" and href="#id" opens and closes the element with that id (the markup of the pages,
// as with Bootstrap, which this replaces); the element has the class "collapse", and "show" while it is open.
// Every link to it has aria-expanded and aria-controls.
//
// A closed body is hidden with hidden="until-found" where the browser supports it: the browser's search in the
// page (Ctrl+F) then finds text in closed exercises and opens them (the "beforematch" event). Elsewhere it is
// simply not displayed (.collapse:not(.show) in Bootstrap's CSS).
import { prefersReducedMotion } from './utils';

const DURATION = 350;
const UNTIL_FOUND = typeof HTMLElement !== 'undefined' && 'onbeforematch' in HTMLElement.prototype;
const running = new WeakMap();
// The state that an element is in or changing to (while it closes it still has the class "show").
const wanted = new WeakMap();

if (UNTIL_FOUND) {
  // _ui.scss: a closed body is then hidden by the attribute, not by display: none.
  document.documentElement.classList.add('has-until-found');
}

function triggersOf(element) {
  return element.id ? document.querySelectorAll(`[data-bs-toggle="collapse"][href="#${CSS.escape(element.id)}"]`) : [];
}

export function isOpen(element) {
  return wanted.has(element) ? wanted.get(element) : element.classList.contains('show');
}

function syncTriggers(element, open) {
  triggersOf(element).forEach(trigger => trigger.setAttribute('aria-expanded', String(open)));
}

function syncHidden(element, open) {
  if (UNTIL_FOUND) {
    if (open) {
      element.removeAttribute('hidden');
    } else {
      element.setAttribute('hidden', 'until-found');
    }
  }
}

// Opens or closes `element`, with a short change of height unless `animate` is false or the reader prefers
// reduced motion.
export function setOpen(element, open, { animate = true } = {}) {
  const previous = running.get(element);

  if (isOpen(element) === open && !previous) {
    return;
  }

  // The height it has now (in the middle of a change, or before it).
  const from = element.getBoundingClientRect().height;

  wanted.set(element, open);

  if (previous) {
    running.delete(element);
    previous.cancel();
  }

  syncTriggers(element, open);

  if (!animate || prefersReducedMotion() || typeof element.animate !== 'function') {
    element.classList.toggle('show', open);
    syncHidden(element, open);
    return;
  }

  // Shown while it changes; closed (and hidden) once it has.
  element.classList.add('show');
  syncHidden(element, true);

  const to = open ? element.scrollHeight : 0;
  const animation = element.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }],
    { duration: DURATION, easing: 'ease' });

  running.set(element, animation);

  // Unless a newer change has replaced this one (the events of a cancelled animation come later).
  const settle = () => {
    if (running.get(element) !== animation) {
      return;
    }

    running.delete(element);
    element.classList.toggle('show', open);
    syncHidden(element, open);
  };

  animation.addEventListener('finish', settle);
  animation.addEventListener('cancel', settle);
}

// Every collapsible element of the page that its links name: the links get their aria- attributes and the
// closed bodies their hidden="until-found". For every page (main.js), after the ids have been given.
export function mountCollapses(root = document) {
  root.querySelectorAll('.collapse[id]').forEach(element => {
    triggersOf(element).forEach(trigger => trigger.setAttribute('aria-controls', element.id));
    syncTriggers(element, isOpen(element));
    syncHidden(element, isOpen(element));
    element.addEventListener('beforematch', () => setOpen(element, true, { animate: false }));
  });
}

// The links, once for the visit.
export default function mountCollapseLinks() {
  document.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-bs-toggle="collapse"]') : null;
    const href = trigger && trigger.getAttribute('href');
    const element = href && href.startsWith('#') ? document.getElementById(href.slice(1)) : null;

    if (!element) {
      return;
    }

    event.preventDefault();
    setOpen(element, !isOpen(element));
  });
}
