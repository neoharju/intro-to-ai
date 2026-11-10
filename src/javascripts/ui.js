import watchFades from './scroll-fades';
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
  // The first time in the next frame too: measuring now would lay out the page while it is still being
  // set up, and again after.
  schedule();
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

// A drawn diagram (svg.dg) is never narrower than 3/4 of its viewBox in px, so that its labels (13 units)
// stay about 10 px on a phone instead of shrinking to 5 px; it scrolls sideways in its box when the column
// is narrower than that. Only writes here: the boxes are measured later, all at once (scroll-fades.js).
function wrapDiagrams() {
  document.querySelectorAll('.material svg.dg').forEach(svg => {
    const width = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0;
    const wrapper = document.createElement('div');

    if (!width) {
      return;
    }

    wrapper.className = 'dg-scroll';
    svg.style.minWidth = `${Math.round(width * 0.75)}px`;
    svg.parentNode.insertBefore(wrapper, svg);
    wrapper.append(svg);
    watchFades(wrapper);
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

// Cards and figures fade in the first time they scroll into view. Only elements that start below
// the first screen are animated, and nothing is hidden when the reader prefers reduced motion. Where an
// element starts comes from the observer's first report, which follows the browser's own layout: reading
// the positions here would lay out the whole page while it is still being set up.
function mountReveal() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    return;
  }

  const placed = new WeakSet();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const node = entry.target;

      if (!placed.has(node)) {
        placed.add(node);

        // Below the first screen: hidden until it scrolls into view. Otherwise it stays as it is.
        if (!entry.isIntersecting && entry.boundingClientRect.top > window.innerHeight) {
          node.classList.add('reveal');
        } else {
          observer.unobserve(node);
        }

        return;
      }

      if (entry.isIntersecting) {
        node.classList.add('is-visible');
        observer.unobserve(node);
      }
    });
  }, { rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.material .hint, .material .viz, .material .table-wrap').forEach(node => observer.observe(node));
}

export default function mountUi() {
  wrapTables();
  wrapDiagrams();
  mountCopyButtons();
  addHeadingAnchors();
  mountScrollAids();
  mountReveal();
}
