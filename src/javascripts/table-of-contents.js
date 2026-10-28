import { uniqueId, kebabCase } from 'lodash-es';

import { scrollToId } from './utils';

class TableOfContents {
  mount() {
    this.headingNodes = $('.material-heading');
    this.rootNode = $('#table-of-contents');
    this.listNode = $('#table-of-contents-list');
    this.layerNode = $('#table-of-contents-layer');
    this.toggleNode = $('#table-of-contents-toggle');

    this.rootNode.on('click', '.table-of-contents__link', this.onClickTableOfContentsLink.bind(this));
    this.layerNode.on('click', this.hide.bind(this));
    this.toggleNode.on('click', this.show.bind(this));

    this.addNumbers();

    this.sections.forEach(section => {
      this.constructTableOfContents(this.listNode, section);
    });
  }

  show() {
    this.layerNode.addClass('table-of-contents-layer--visible');
    this.rootNode.addClass('table-of-contents--visible');
  }

  hide() {
    this.layerNode.removeClass('table-of-contents-layer--visible');
    this.rootNode.removeClass('table-of-contents--visible');
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
