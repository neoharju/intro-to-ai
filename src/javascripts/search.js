// Search of the course material, at the right of the navigation bar (Ctrl+K, ⌘K or /): the button, the
// dialog and the keys. The index and the matching are in search-index.js.
import { reveal } from './anchors';
import { MAX_RESULTS, loadIndex, match, norm, snippet, terms } from './search-index';

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text) {
    node.textContent = text;
  }

  return node;
}

// The text with every occurrence of the terms in <mark>.
function highlighted(text, words) {
  const ntext = norm(text);
  const marks = [];

  words.forEach(word => {
    for (let i = ntext.indexOf(word); i >= 0; i = ntext.indexOf(word, i + word.length)) {
      marks.push([i, i + word.length]);
    }
  });

  marks.sort((a, b) => a[0] - b[0]);

  const fragment = document.createDocumentFragment();
  let pos = 0;

  marks.forEach(([start, end]) => {
    if (start < pos) {
      return;
    }

    fragment.append(text.slice(pos, start), el('mark', '', text.slice(start, end)));
    pos = end;
  });

  fragment.append(text.slice(pos));

  return fragment;
}

// --- The dialog --------------------------------------------------------------------------------------------

function isTyping(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function samePage(url) {
  const target = new URL(url, window.location.href);
  const here = new URL(window.location.href);

  return target.origin === here.origin && target.pathname.replace(/index\.html$/, '') === here.pathname.replace(/index\.html$/, '');
}

export default function mountSearch() {
  const buttons = document.querySelector('.navbar__buttons');
  const dialog = el('dialog', 'search');

  // Without <dialog> (very old browsers) there is no search button.
  if (!buttons || typeof dialog.showModal !== 'function') {
    return;
  }

  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcut = mac ? '⌘ K' : 'Ctrl K';

  // The button in the navigation bar.
  const button = el('button', 'btn btn-secondary search-btn');
  const icon = el('i', 'fa fa-search');
  const kbd = el('kbd', 'search-btn__kbd', shortcut);

  button.type = 'button';
  button.setAttribute('aria-label', `Search the material (${mac ? '⌘K' : 'Ctrl+K'})`);
  button.setAttribute('aria-keyshortcuts', 'Control+K Meta+K /');
  button.title = `Search the material (${mac ? '⌘K' : 'Ctrl+K'} or /)`;
  icon.setAttribute('aria-hidden', 'true');
  kbd.setAttribute('aria-hidden', 'true');
  button.append(icon, el('span', 'search-btn__label', 'Search'), kbd);
  buttons.prepend(button);

  // The dialog.
  const field = el('div', 'search__field');
  const fieldIcon = el('i', 'fa fa-search');
  const input = el('input', 'search__input');
  const close = el('button', 'search__close');
  const list = el('ul', 'search__results');
  const count = el('span', 'search__count');
  const foot = el('div', 'search__foot');
  const panel = el('div', 'search__panel');

  dialog.setAttribute('aria-label', 'Search the material');
  fieldIcon.setAttribute('aria-hidden', 'true');
  input.type = 'search';
  input.placeholder = 'Search the material, e.g. gradient descent';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search term');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'search-results');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the search');
  close.append(el('kbd', '', 'Esc'));
  list.id = 'search-results';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Search results');
  foot.setAttribute('aria-hidden', 'true');

  const hint = (keys, label) => {
    const span = el('span');

    keys.forEach(key => span.append(el('kbd', '', key)));
    span.append(` ${label}`);

    return span;
  };

  foot.append(hint(['↑', '↓'], 'select'), hint(['↵'], 'open'), count);
  field.append(fieldIcon, input, close);
  panel.append(field, list, foot);
  dialog.append(panel);
  document.body.append(dialog);

  let results = [];
  let selected = -1;
  let timer = 0;
  let indexReady = false;

  function select(i) {
    const items = [...list.querySelectorAll('.search__result')];

    if (!items.length) {
      selected = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }

    selected = (i + items.length) % items.length;
    items.forEach((item, j) => item.setAttribute('aria-selected', String(j === selected)));
    input.setAttribute('aria-activedescendant', items[selected].id);
    items[selected].scrollIntoView({ block: 'nearest' });
  }

  function message(text) {
    const item = el('li', 'search__empty', text);

    list.replaceChildren(item);
    count.textContent = '';
    results = [];
    select(-1);
  }

  function render(words, query, partial) {
    if (!results.length) {
      message(`No results for “${query}”`);
      return;
    }

    list.replaceChildren(...results.map((result, i) => {
      const { entry } = result;
      const item = el('li', 'search__result');
      const link = el('a');
      const title = el('span', 'search__title');
      const where = el('span', 'search__where', entry.kind === 'exercise' ? `${entry.page} · Exercise` : entry.page);

      item.id = `search-result-${i}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      link.href = entry.url;
      link.tabIndex = -1;
      title.append(highlighted(entry.title, words));
      link.append(title, where);

      if (entry.text) {
        const text = el('span', 'search__snippet');

        text.append(highlighted(snippet(entry.text, result.first), words));
        link.append(text);
      }

      item.append(link);

      return item;
    }));

    count.textContent = `${results.length === 1 ? '1 result' : `${results.length}${results.length === MAX_RESULTS ? '+' : ''} results`}${partial ? ' with all but one word' : ''}`;
    select(0);
  }

  function run() {
    const query = input.value.trim();
    const words = terms(query);

    if (!words.length) {
      list.replaceChildren();
      count.textContent = '';
      results = [];
      select(-1);
      return;
    }

    if (!indexReady) {
      message('Loading the material…');
    }

    loadIndex().then(index => {
      indexReady = true;

      // A newer query may have run meanwhile.
      if (input.value.trim() !== query) {
        return;
      }

      const found = match(index, words);

      results = found.results;
      render(words, query, found.partial);
    });
  }

  function open() {
    if (!dialog.open) {
      dialog.showModal();
    }

    input.focus();
    input.select();
    loadIndex();
    run();
  }

  function shut() {
    if (dialog.open) {
      dialog.close();
    }
  }

  function go(result) {
    const { entry } = result;

    shut();

    if (samePage(entry.url) && entry.id) {
      if (window.location.hash !== `#${entry.id}`) {
        window.history.pushState(null, '', `#${entry.id}`);
      }

      reveal(entry.id);
    } else {
      window.location.href = entry.url;
    }
  }

  button.addEventListener('click', open);
  close.addEventListener('click', shut);

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 60);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      shut();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      select(selected + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      select(selected - 1);
    } else if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      go(results[selected]);
    }
  });

  list.addEventListener('mousemove', e => {
    const item = e.target.closest('.search__result');
    const i = item ? [...list.children].indexOf(item) : -1;

    if (i >= 0 && i !== selected) {
      select(i);
    }
  });

  list.addEventListener('click', e => {
    const item = e.target.closest('.search__result');
    const i = item ? [...list.children].indexOf(item) : -1;

    // A plain click: go there here. A click with Ctrl, ⌘ or Shift opens the link as the browser does.
    if (i >= 0 && results[i] && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      go(results[i]);
    }
  });

  // A click on the backdrop closes the dialog.
  dialog.addEventListener('click', e => {
    if (e.target === dialog) {
      shut();
    }
  });

  document.addEventListener('keydown', e => {
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();

      if (dialog.open) {
        shut();
      } else {
        open();
      }
    } else if (e.key === '/' && !dialog.open && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
      e.preventDefault();
      open();
    }
  });
}
