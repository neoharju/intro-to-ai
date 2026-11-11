import { kebabCase } from 'lodash-es';

import { navOffset, scrollToId } from './utils';

// The drawer and its button stay from page to page (router.js): mount() sets them up once, and build() makes
// the list of the current page (again for every page that the router shows).
class TableOfContents {
  mount() {
    this.rootNode = document.getElementById('table-of-contents');
    this.listNode = document.getElementById('table-of-contents-list');
    this.layerNode = document.getElementById('table-of-contents-layer');
    this.toggleNode = document.getElementById('table-of-contents-toggle');

    if (!this.rootNode || !this.listNode) {
      return;
    }

    this.closeNode = document.createElement('button');
    this.closeNode.type = 'button';
    this.closeNode.className = 'table-of-contents__close';
    this.closeNode.setAttribute('aria-label', 'Close table of contents');
    this.closeNode.textContent = '\u00d7';

    Object.entries({ role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Table of contents' })
      .forEach(([name, value]) => this.rootNode.setAttribute(name, value));
    this.rootNode.querySelector('.table-of-contents__heading').append(this.closeNode);
    this.toggleNode.setAttribute('aria-controls', 'table-of-contents');
    this.toggleNode.setAttribute('aria-expanded', 'false');

    this.rootNode.addEventListener('click', event => {
      const link = event.target.closest('.table-of-contents__link');

      if (link) {
        this.onClickTableOfContentsLink(event, link);
      }
    });
    this.layerNode.addEventListener('click', () => this.hide());
    this.closeNode.addEventListener('click', () => this.hide());
    this.toggleNode.addEventListener('click', () => this.show());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });
  }

  // The list of the current page.
  build() {
    if (!this.listNode) {
      return;
    }

    if (this.isVisible()) {
      this.hide();
    }

    this.headingNodes = [...document.querySelectorAll('.material-heading')];
    // The glossary (data-unnumbered) shows its letters and terms without section numbers.
    this.numbered = !document.querySelector('#material[data-unnumbered]');
    this.listNode.replaceChildren();
    this.addNumbers();

    this.sections.forEach(section => {
      this.constructTableOfContents(this.listNode, section);
    });
  }

  isVisible() {
    return Boolean(this.rootNode) && this.rootNode.classList.contains('table-of-contents--visible');
  }

  show() {
    this.markCurrentSection();
    this.layerNode.classList.add('table-of-contents-layer--visible');
    this.rootNode.classList.add('table-of-contents--visible');
    this.toggleNode.setAttribute('aria-expanded', 'true');
    document.body.classList.add('has-drawer');
    this.closeNode.focus();
  }

  hide() {
    const hadFocus = this.rootNode.contains(document.activeElement);

    this.layerNode.classList.remove('table-of-contents-layer--visible');
    this.rootNode.classList.remove('table-of-contents--visible');
    this.toggleNode.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('has-drawer');

    if (hadFocus) {
      this.toggleNode.focus();
    }
  }

  // Highlights the last section whose heading has scrolled past the top of the window, and scrolls
  // the list so that it is in view.
  markCurrentSection() {
    const line = navOffset() + 8;
    let current = null;

    this.headingNodes.forEach(node => {
      if (node.getBoundingClientRect().top <= line) {
        current = node;
      }
    });

    const links = [...this.listNode.querySelectorAll('.table-of-contents__link')];

    links.forEach(link => {
      link.classList.remove('is-current');
      link.removeAttribute('aria-current');
    });

    const link = current && links.find(node => node.getAttribute('href') === `#${current.id}`);

    if (link) {
      const content = this.rootNode.querySelector('.table-of-contents__content');

      link.classList.add('is-current');
      link.setAttribute('aria-current', 'location');
      content.scrollTop = link.offsetTop - content.clientHeight / 3;
    }
  }

  onClickTableOfContentsLink(event, link) {
    event.preventDefault();
    scrollToId(link.getAttribute('href').substring(1));
    this.hide();
  }

  // Builds the section tree with a stack of open sections. A heading becomes a child of the
  // nearest preceding heading of a higher level, so a page that starts with an <h2> (or skips a
  // level) still gets a valid tree instead of breaking the rest of the page initialisation.
  addNumbers() {
    const root = { level: 0, sectionString: '', children: [] };
    const stack = [root];

    this.headingNodes.forEach(node => {
      const level = parseInt(node.nodeName.substring(1));

      while (stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      const position = parent.children.length + 1;
      const sectionString = parent.sectionString ? `${parent.sectionString}.${position}` : `${position}`;
      // The ids come from anchors.js (headings that have an id in the page keep it).
      const id = node.id || kebabCase(node.textContent);

      const section = {
        level,
        sectionString,
        title: node.textContent,
        href: `#${id}`,
        children: []
      };

      node.id = id;
      parent.children.push(section);
      stack.push(section);

      if (this.numbered) {
        node.insertAdjacentHTML('afterbegin', `
          <small class="text-muted">
            ${sectionString}.
          </small>
        `);
      }
    });

    this.sections = root.children;
  }

  constructTableOfContents(parentNode, section) {
    const level = section.sectionString.split('.').length - 1;
    const linkNode = document.createElement('a');
    const newNode = document.createElement('li');

    linkNode.setAttribute('href', section.href);
    linkNode.className = `table-of-contents__link table-of-contents__link--level-${level}`;
    linkNode.textContent = this.numbered ? `${section.sectionString}. ${section.title}` : section.title;
    newNode.append(linkNode);
    parentNode.append(newNode);

    if (section.children.length > 0) {
      const newParentNode = document.createElement('ul');

      newNode.append(newParentNode);

      section.children.forEach(child => {
        this.constructTableOfContents(newParentNode, child);
      });
    }
  }
}

export default TableOfContents;
