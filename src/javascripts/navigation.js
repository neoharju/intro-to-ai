// The links of the navigation bar, and the same links in the menu that replaces them on small screens.
//
// The bar stays from page to page (router.js), but the address of the document changes under it, and a
// relative link ("../week2/") would then lead somewhere else: so every link of the bar and of the footer is
// made absolute (from the root of the server: "/intro-to-ai/week2/") once, here. setActive marks the link of
// the page that is shown: a pill behind the links slides to it, and the button of the menu (smaller screens)
// shows its name.
import { prefersReducedMotion } from './utils';

function samePage(a, b) {
  return a.origin === b.origin && a.pathname.replace(/index\.html$/, '') === b.pathname.replace(/index\.html$/, '');
}

class Navigation {
  mount() {
    document.querySelectorAll('.header-wrapper a[href], .footer-wrapper a[href]').forEach(link => {
      const url = new URL(link.href);

      if (url.origin === window.location.origin) {
        link.setAttribute('href', url.pathname + url.search + url.hash);
      }
    });

    this.links = [...document.querySelectorAll('.navbar .nav-link')];
    this.menu = document.querySelector('#mobile-nav-dropdown .dropdown-menu');

    // The menu's links are in the page (scripts/sync.mjs), in the order of the bar's; a page without them
    // gets them now.
    const written = this.menu ? [...this.menu.querySelectorAll('.dropdown-item')] : [];

    this.items = this.links.map((link, index) => {
      if (written[index]) {
        return written[index];
      }

      const item = document.createElement('a');

      item.className = 'dropdown-item';
      item.href = link.getAttribute('href');
      item.textContent = link.textContent.trim();

      if (this.menu) {
        this.menu.append(item);
      }

      return item;
    });

    // The pill behind the active link (until it is there, the link has a pill of its own: _navbar.scss). It follows
    // the link when the links change size: another width of the window, fonts that arrive.
    this.list = document.querySelector('.navbar .navbar__links');
    this.current = document.querySelector('.navbar__current');

    if (this.list && 'ResizeObserver' in window) {
      this.indicator = document.createElement('li');
      this.indicator.className = 'navbar__indicator';
      this.indicator.setAttribute('aria-hidden', 'true');
      this.list.prepend(this.indicator);
      this.list.classList.add('has-indicator');
      new ResizeObserver(() => this.place(false)).observe(this.list);
    }

    this.setActive(window.location.href);
  }

  setActive(address) {
    const here = new URL(address, window.location.href);

    this.links.forEach((link, index) => {
      const active = samePage(new URL(link.href), here);
      const item = this.items[index];

      link.parentElement.classList.toggle('active', active);
      [link, item].forEach(node => {
        if (active) {
          node.setAttribute('aria-current', 'page');
        } else {
          node.removeAttribute('aria-current');
        }
      });

      if (active && this.current) {
        this.current.textContent = link.textContent.trim();
      }
    });

    this.place(true);
  }

  // Moves the pill to the active link, sliding from where it was (`animate`), or hides it (no active link, or the
  // links are not shown: they are in the menu below 1200 px).
  place(animate) {
    const link = this.list && this.list.querySelector('.nav-item.active > .nav-link');

    if (!this.indicator) {
      return;
    }

    if (!link || !this.list.offsetWidth) {
      this.indicator.style.opacity = '0';
      this.at = null;
      return;
    }

    const box = this.list.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    const next = { x: rect.left - box.left, width: rect.width };
    const from = this.at;
    const moving = animate && from && (from.x !== next.x || from.width !== next.width);

    this.indicator.style.opacity = '1';
    this.indicator.style.width = `${next.width}px`;
    this.indicator.style.transform = `translateX(${next.x}px)`;
    this.at = next;

    if (moving && !prefersReducedMotion() && typeof this.indicator.animate === 'function') {
      this.indicator.animate([
        { transform: `translateX(${from.x}px)`, width: `${from.width}px` },
        { transform: `translateX(${next.x}px)`, width: `${next.width}px` },
      ], { duration: 340, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    }
  }
}

export default Navigation;
