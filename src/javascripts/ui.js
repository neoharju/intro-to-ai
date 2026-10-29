import { prefersReducedMotion } from './utils';

function onScrollFrame(callback) {
  let pending = false;

  const run = () => {
    pending = false;
    callback();
  };

  const schedule = () => {
    if (!pending) {
      pending = true;
      window.requestAnimationFrame(run);
    }
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  run();
}

// Reading progress along the bottom edge of the navigation bar, and a back-to-top button that
// appears once the reader is more than a screen down the page.
function mountScrollAids() {
  const navbar = document.querySelector('.header-wrapper .navbar');
  const track = document.createElement('div');
  const fill = document.createElement('span');
  const backToTop = document.createElement('button');

  track.className = 'read-progress';
  track.setAttribute('aria-hidden', 'true');
  track.append(fill);

  if (navbar) {
    navbar.append(track);
  }

  backToTop.type = 'button';
  backToTop.className = 'back-to-top';
  backToTop.setAttribute('aria-label', 'Back to top');
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
  document.body.append(backToTop);

  onScrollFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;

    fill.style.transform = `scaleX(${progress})`;
    backToTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 1.2);
  });
}

// The text of a code block without the line numbers of pseudocode listings (replaced by spaces, so
// that the indentation of the lines stays aligned).
function codeText(code) {
  const copy = code.cloneNode(true);

  copy.querySelectorAll('.hljs-line-number').forEach(number => {
    number.replaceWith(' '.repeat(number.textContent.length));
  });

  return copy.textContent;
}

// A copy button on code blocks. The Clipboard API needs a secure context (https or localhost).
function mountCopyButtons() {
  if (!navigator.clipboard || !window.isSecureContext) {
    return;
  }

  document.querySelectorAll('.material pre > code').forEach(code => {
    const pre = code.parentNode;
    const wrapper = document.createElement('div');
    const button = document.createElement('button');
    let timer = 0;

    wrapper.className = 'code-block';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.append(pre);

    button.type = 'button';
    button.className = 'code-block__copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(codeText(code)).then(
        () => {
          button.textContent = 'Copied';
          button.classList.add('is-done');
        },
        () => {
          button.textContent = 'Not copied';
        }
      );

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('is-done');
      }, 1600);
    });

    wrapper.append(button);
  });
}

// Wide tables scroll sideways inside their frame instead of widening the page on small screens.
function wrapTables() {
  document.querySelectorAll('.material table.table').forEach(table => {
    const wrapper = document.createElement('div');

    wrapper.className = 'table-wrap';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.append(table);
  });
}

// A "#" permalink after each numbered section heading (the ids come from table-of-contents.js).
// It is hidden from assistive technology: the table of contents already offers the same links.
function addHeadingAnchors() {
  document.querySelectorAll('.material-heading[id]').forEach(heading => {
    const anchor = document.createElement('a');

    anchor.className = 'heading-anchor';
    anchor.href = `#${heading.id}`;
    anchor.textContent = '#';
    anchor.tabIndex = -1;
    anchor.setAttribute('aria-hidden', 'true');
    heading.append(anchor);
  });
}

function formatMinutes(minutes) {
  if (minutes < 60) {
    return `${minutes} min read`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} h ${rest} min read` : `${hours} h read`;
}

function metaItem(iconClass, text) {
  const item = document.createElement('li');
  const icon = document.createElement('i');

  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');
  item.append(icon, document.createTextNode(text));

  return item;
}

// Reading time (about 200 words a minute for technical text), exercises and interactive figures.
function fillPageMeta() {
  const meta = document.querySelector('.page-hero__meta');
  const material = document.getElementById('material');

  if (!meta || !material) {
    return;
  }

  const words = material.textContent.split(/\s+/).filter(Boolean).length;
  const exercises = material.querySelectorAll('.exercise').length;
  const figures = material.querySelectorAll('.viz').length;

  meta.append(metaItem('fa-regular fa-clock', formatMinutes(Math.max(1, Math.round(words / 200)))));

  if (exercises) {
    meta.append(metaItem('fa fa-pencil', `${exercises} exercise${exercises === 1 ? '' : 's'}`));
  }

  if (figures) {
    meta.append(metaItem('fa fa-play-circle', `${figures} interactive figure${figures === 1 ? '' : 's'}`));
  }
}

// Cards and figures fade in the first time they scroll into view. Only elements that start below
// the first screen are animated, and nothing is hidden when the reader prefers reduced motion.
function mountReveal() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    return;
  }

  const candidates = document.querySelectorAll('.material .hint, .material .viz, .material .table-wrap');
  const fold = window.innerHeight;
  const below = Array.from(candidates).filter(node => node.getBoundingClientRect().top > fold);

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -6% 0px' });

  below.forEach(node => {
    node.classList.add('reveal');
    observer.observe(node);
  });
}

export default function mountUi() {
  wrapTables();
  mountCopyButtons();
  addHeadingAnchors();
  fillPageMeta();
  mountScrollAids();
  mountReveal();
}
