// The text size menu in the navigation bar: normal, large or extra large reading text. A larger size
// is a data-font-size attribute on <html>, which sets the root font size: the text, headings, formulas
// and boxes of the page follow it (they are sized in rem), while the navigation bar keeps its size.
// theme.js restores the choice before the page is drawn; it is remembered in localStorage when the
// browser allows it.
import { readingAnchor } from './utils';

const KEY = 'introai-font-size';
const OPTIONS = [
  { size: 'normal', label: 'Normal' },
  { size: 'large', label: 'Large' },
  { size: 'xlarge', label: 'Extra large' },
];
const root = document.documentElement;

function current() {
  const size = root.getAttribute('data-font-size');

  return OPTIONS.some(option => option.size === size) ? size : 'normal';
}

function el(tag, className, text) {
  const node = document.createElement(tag);

  node.className = className;

  if (text) {
    node.textContent = text;
  }

  return node;
}

export default function mountFontSizeMenu() {
  const buttons = document.querySelector('.navbar__buttons');

  if (!buttons) {
    return;
  }

  const toggle = el('button', 'btn btn-secondary font-size-menu__toggle');

  toggle.type = 'button';
  toggle.setAttribute('data-bs-toggle', 'dropdown');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Text size');
  toggle.title = 'Text size';

  const glyph = el('span', 'font-size-menu__glyph', 'Aa');

  glyph.setAttribute('aria-hidden', 'true');
  toggle.append(glyph);

  const menu = el('div', 'dropdown-menu dropdown-menu-end font-size-menu__list');

  const items = OPTIONS.map(option => {
    const item = el('button', 'dropdown-item font-size-menu__item');
    const sample = el('span', `font-size-menu__sample font-size-menu__sample--${option.size}`, 'A');
    const check = el('i', 'fa fa-check menu-check');

    item.type = 'button';
    sample.setAttribute('aria-hidden', 'true');
    check.setAttribute('aria-hidden', 'true');
    item.append(sample, document.createTextNode(option.label), check);
    item.addEventListener('click', () => set(option.size));
    menu.append(item);

    return { item, option };
  });

  const wrapper = el('div', 'dropdown font-size-menu');

  wrapper.append(toggle, menu);
  buttons.insertBefore(wrapper, buttons.querySelector('.theme-menu') || document.getElementById('table-of-contents-toggle'));

  function update() {
    items.forEach(({ item, option }) => item.setAttribute('aria-pressed', String(option.size === current())));
  }

  function set(size) {
    if (size === current()) {
      return;
    }

    // The text above the reading position grows or shrinks: stay at the same place.
    const anchor = readingAnchor();

    if (size === 'normal') {
      root.removeAttribute('data-font-size');
    } else {
      root.setAttribute('data-font-size', size);
    }

    try {
      window.localStorage.setItem(KEY, size);
    } catch (error) {
      // The size lasts until the page is left.
    }

    if (anchor) {
      window.scrollBy({ top: anchor.node.getBoundingClientRect().top - anchor.top, behavior: 'auto' });
    }

    update();
  }

  update();
}
