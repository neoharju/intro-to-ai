import { uniqueId, kebabCase } from 'lodash-es';

import { navOffset, scrollToId } from './utils';

class TableOfContents {
  mount() {
    this.headingNodes = $('.material-heading');
    this.rootNode = $('#table-of-contents');
    this.listNode = $('#table-of-contents-list');
    this.layerNode = $('#table-of-contents-layer');
    this.toggleNode = $('#table-of-contents-toggle');

    this.closeNode = $('<button type="button" class="table-of-contents__close" aria-label="Close table of contents">&times;</button>');

    this.rootNode.attr({ role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Table of contents' });
    this.rootNode.find('.table-of-contents__heading').append(this.closeNode);
    this.toggleNode.attr({ 'aria-controls': 'table-of-contents', 'aria-expanded': 'false' });

    this.rootNode.on('click', '.table-of-contents__link', this.onClickTableOfContentsLink.bind(this));
    this.layerNode.on('click', this.hide.bind(this));
    this.closeNode.on('click', this.hide.bind(this));
    this.toggleNode.on('click', this.show.bind(this));
    $(document).on('keydown', e => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });

    this.addNumbers();

    this.sections.forEach(section => {
      this.constructTableOfContents(this.listNode, section);
    });
  }

  isVisible() {
    return this.rootNode.hasClass('table-of-contents--visible');
  }

  show() {
    this.markCurrentSection();
    this.layerNode.addClass('table-of-contents-layer--visible');
    this.rootNode.addClass('table-of-contents--visible');
    this.toggleNode.attr('aria-expanded', 'true');
    $('body').addClass('has-drawer');
    this.closeNode.trigger('focus');
  }

  hide() {
    const hadFocus = this.rootNode[0].contains(document.activeElement);

    this.layerNode.removeClass('table-of-contents-layer--visible');
    this.rootNode.removeClass('table-of-contents--visible');
    this.toggleNode.attr('aria-expanded', 'false');
    $('body').removeClass('has-drawer');

    if (hadFocus) {
      this.toggleNode.trigger('focus');
    }
  }

  // Highlights the last section whose heading has scrolled past the top of the window, and scrolls
  // the list so that it is in view.
  markCurrentSection() {
    const line = navOffset() + 8;
    let current = null;

    this.headingNodes.each((index, node) => {
      if (node.getBoundingClientRect().top <= line) {
        current = node;
      }
    });

    const links = this.listNode.find('.table-of-contents__link');

    links.removeClass('is-current').removeAttr('aria-current');

    if (current) {
      const link = links.filter((index, node) => node.getAttribute('href') === `#${current.id}`);

      link.addClass('is-current').attr('aria-current', 'location');

      if (link[0]) {
        const content = this.rootNode.find('.table-of-contents__content')[0];

        content.scrollTop = link[0].offsetTop - content.clientHeight / 3;
      }
    }
  }

  onClickTableOfContentsLink(e) {
    e.preventDefault();

    const id = e.currentTarget.getAttribute('href').substring(1);

    scrollToId(id);

    this.hide();
  }

  // Builds the section tree with a stack of open sections. A heading becomes a child of the
  // nearest preceding heading of a higher level, so a page that starts with an <h2> (or skips a
  // level) still gets a valid tree instead of breaking the rest of the page initialisation.
  addNumbers() {
    const root = { level: 0, sectionString: '', children: [] };
    const stack = [root];

    this.headingNodes.each((index, node) => {
      const headingNode = $(node);
      const level = parseInt(node.nodeName.substring(1));

      while (stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      const position = parent.children.length + 1;
      const sectionString = parent.sectionString ? `${parent.sectionString}.${position}` : `${position}`;
      const id = `${uniqueId('section-')}-${kebabCase(headingNode.text())}`;

      const section = {
        level,
        sectionString,
        title: headingNode.text(),
        href: `#${id}`,
        children: []
      };

      headingNode.attr('id', id);
      parent.children.push(section);
      stack.push(section);

      headingNode.prepend(`
        <small class="text-muted">
          ${sectionString}.
        </small>
      `);
    });

    this.sections = root.children;
  }

  constructTableOfContents(parentNode, section) {
    const level = section.sectionString.split('.').length - 1;

    const linkNode = $('<a></a>')
      .attr('href', section.href)
      .addClass(`table-of-contents__link table-of-contents__link--level-${level}`)
      .text(`${section.sectionString}. ${section.title}`);

    const newNode = $('<li></li>').append(linkNode);

    parentNode.append(newNode);

    if (section.children.length > 0) {
      const newParentNode = $('<ul></ul>');

      newNode.append(newParentNode);

      section.children.forEach(child => {
        this.constructTableOfContents(newParentNode, child);
      });
    }
  }
}

export default TableOfContents;
