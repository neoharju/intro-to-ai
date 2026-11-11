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

export default function mountFontSizeMenu() {
  // The menu is in the navigation bar of every page (src/partials/navbar.html); an item names its size in
  // data-size.
  const items = [...document.querySelectorAll('.font-size-menu .font-size-menu__item[data-size]')]
    .map(item => ({ item, option: OPTIONS.find(option => option.size === item.dataset.size) }))
    .filter(({ option }) => option);

  items.forEach(({ item, option }) => item.addEventListener('click', () => set(option.size)));

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
