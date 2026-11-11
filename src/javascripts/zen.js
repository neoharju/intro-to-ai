// Zen mode: the course material without the navigation bar, the page header, the lecture and deadline
// boxes and the footer, for reading without distractions. The reading progress stays as a thin line at
// the top of the window. It is switched with the lotus button in the navigation bar or the Z key, and
// left with the button in the corner, Z or Esc. theme.js restores it before the page is drawn; the
// choice is remembered in localStorage when the browser allows it.
import { prefersReducedMotion, readingAnchor } from './utils';

const KEY = 'introai-zen';
const root = document.documentElement;

function isOn() {
  return root.getAttribute('data-zen') === 'on';
}

function remember(on) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch (error) {
    // The mode lasts until the page is left.
  }
}

function icon(name) {
  const node = document.createElement('i');

  node.className = `fa ${name}`;
  node.setAttribute('aria-hidden', 'true');

  return node;
}

export default function mountZen() {
  // The button is in the navigation bar of every page (src/partials/navbar.html).
  const toggle = document.querySelector('.navbar__buttons .zen-toggle');

  if (!toggle) {
    return;
  }

  const exit = document.createElement('button');

  exit.type = 'button';
  exit.className = 'zen-exit';
  exit.title = 'Leave zen mode (Z or Esc)';
  exit.append(icon('fa-compress'), document.createTextNode('Leave zen mode'));

  const toast = document.createElement('div');

  toast.className = 'zen-toast';
  toast.setAttribute('role', 'status');

  document.body.append(exit, toast);

  let toastTimer = 0;

  function set(on, { focus = false } = {}) {
    if (on === isOn()) {
      return;
    }

    const anchor = readingAnchor();

    if (on) {
      root.setAttribute('data-zen', 'on');
    } else {
      root.removeAttribute('data-zen');
    }

    remember(on);
    sync();

    if (anchor) {
      window.scrollBy({ top: anchor.node.getBoundingClientRect().top - anchor.top, behavior: 'auto' });
    }

    window.clearTimeout(toastTimer);
    toast.textContent = on ? 'Zen mode: press Z or Esc to leave' : 'Zen mode off';
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), prefersReducedMotion() ? 3500 : 2500);

    if (focus) {
      (on ? exit : toggle).focus({ preventScroll: true });
    }
  }

  function sync() {
    toggle.setAttribute('aria-pressed', String(isOn()));
  }

  toggle.addEventListener('click', () => set(true, { focus: true }));
  exit.addEventListener('click', () => set(false, { focus: true }));

  document.addEventListener('keydown', event => {
    const target = event.target;

    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented
      || (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) {
      return;
    }

    if (event.key === 'z' || event.key === 'Z') {
      event.preventDefault();
      set(!isOn());
    } else if (event.key === 'Escape' && isOn() && !document.querySelector('.dropdown-menu.show, .table-of-contents--visible')) {
      set(false);
    }
  });

  sync();
}
