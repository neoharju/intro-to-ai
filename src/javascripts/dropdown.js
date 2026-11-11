// The menus of the navigation bar (the pages on a small screen, the colour theme, the text size): a button with
// data-bs-toggle="dropdown" opens the .dropdown-menu next to it. This replaces Bootstrap's dropdown (and the
// Popper library it needs) with the same classes, so Bootstrap's CSS still draws them: "show" on the button
// and the menu while it is open, and data-bs-popper="static" on the menu, which places it under its button
// (as Bootstrap does in a navigation bar).
//
// As with Bootstrap: a click on the button opens or closes the menu; a click elsewhere, on an item, or the focus
// leaving the menu closes it; the arrow keys open it and move between its items; Escape closes it and returns
// to the button.
const TOGGLE = '[data-bs-toggle="dropdown"]';

function menuOf(toggle) {
  return toggle.parentElement ? toggle.parentElement.querySelector(':scope > .dropdown-menu') : null;
}

function items(menu) {
  return [...menu.querySelectorAll('.dropdown-item:not(.disabled):not(:disabled)')].filter(item => item.offsetParent !== null);
}

function isOpen(toggle) {
  return toggle.classList.contains('show');
}

function close(toggle, { focus = false } = {}) {
  const menu = menuOf(toggle);

  if (!menu || !isOpen(toggle)) {
    return;
  }

  toggle.classList.remove('show');
  menu.classList.remove('show');
  toggle.setAttribute('aria-expanded', 'false');

  if (focus) {
    toggle.focus();
  }
}

function closeAll(except = null) {
  document.querySelectorAll(`${TOGGLE}.show`).forEach(toggle => {
    if (toggle !== except) {
      close(toggle);
    }
  });
}

function open(toggle) {
  const menu = menuOf(toggle);

  if (!menu) {
    return;
  }

  closeAll(toggle);
  menu.setAttribute('data-bs-popper', 'static');
  toggle.classList.add('show');
  menu.classList.add('show');
  toggle.setAttribute('aria-expanded', 'true');
}

export default function mountDropdowns() {
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const toggle = target && target.closest(TOGGLE);

    if (toggle) {
      event.preventDefault();

      if (isOpen(toggle)) {
        close(toggle);
      } else {
        open(toggle);
      }

      return;
    }

    // A click inside an open menu that is not on an item (its padding) keeps it open.
    const menu = target && target.closest('.dropdown-menu.show');

    if (!menu || target.closest('.dropdown-item')) {
      closeAll();
    }
  });

  document.addEventListener('keydown', event => {
    const target = event.target instanceof Element ? event.target : null;
    const toggle = target && (target.closest(TOGGLE) || (target.closest('.dropdown-menu') && target.closest('.dropdown-menu').parentElement.querySelector(`:scope > ${TOGGLE}`)));

    if (!toggle || !['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key) || (event.key === 'Escape' && !isOpen(toggle))) {
      return;
    }

    event.preventDefault();

    if (event.key === 'Escape') {
      // preventDefault above: zen mode (zen.js) then keeps its Escape for itself.
      close(toggle, { focus: true });
      return;
    }

    if (!isOpen(toggle)) {
      open(toggle);
    }

    const list = items(menuOf(toggle));
    const index = list.indexOf(target);

    if (!list.length) {
      return;
    }

    if (index < 0) {
      // From the button: the first item, or the last with the up arrow.
      list[event.key === 'ArrowDown' ? 0 : list.length - 1].focus();
    } else {
      list[Math.min(list.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))].focus();
    }
  });

  // The focus leaves an open menu (Tab): it closes.
  document.addEventListener('focusin', event => {
    document.querySelectorAll(`${TOGGLE}.show`).forEach(toggle => {
      if (!toggle.parentElement.contains(event.target)) {
        close(toggle);
      }
    });
  });
}
