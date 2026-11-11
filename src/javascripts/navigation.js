// The links of the navigation bar, and the same links in the menu that replaces them on small screens.
//
// The bar stays from page to page (router.js), but the address of the document changes under it, and a
// relative link ("../week2/") would then lead somewhere else: so every link of the bar and of the footer is
// made absolute (from the root of the server: "/intro-to-ai/week2/") once, here. setActive marks the link of
// the page that is shown.
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
    });
  }
}

export default Navigation;
