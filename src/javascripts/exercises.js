import { uniqueId, kebabCase, chunk } from 'lodash-es';
import { scrollToId } from './utils';

class Exercises {
  mount() {
    $('#exercise-list').on('click', '.exercise-list__link', this.onClickExerciseLink.bind(this));

    this.headingNodes = $('.exercise h1, .exercise h2');
    this.exerciseNodes = $('.exercise');
    this.exerciseListNode = $('#exercise-list');

    this.addIds();
    this.addNumbers();
    this.renderExecisesList();
  }

  addIds() {
    this.exerciseNodes.each(function() {
      const exerciseNode = $(this);
      const collapseNode = exerciseNode.find('.collapse');
      const toggleNode = exerciseNode.find('.exercise__toggle');
      const headingNode = exerciseNode.find('.exercise__heading');

      const id = `${uniqueId('exercise-')}-${kebabCase(headingNode.text())}`;

      exerciseNode.attr('data-name', headingNode.text());
      exerciseNode.attr('data-href', `#${id}`);
      exerciseNode.attr('id', `${id}-root`);
      collapseNode.attr('id', id);
      toggleNode.attr('href', `#${id}`);
    });
  }

  addNumbers() {
    let indices = [];
    const exerciseNames = [];

    this.headingNodes.each(function() {
      const headingNode = $(this);
      const hIndex = parseInt(this.nodeName.substring(1)) - 1;

      if(hIndex === 0) {
        const exerciseNode = headingNode.closest('.exercise');

        exerciseNames.push({
          name: exerciseNode.attr('data-name'),
          href: exerciseNode.attr('data-href')
        });
      }

      if (indices.length - 1 > hIndex) {
        indices = indices.slice(0, hIndex + 1 );
      }

      if (indices[hIndex] == undefined) {
        indices[hIndex] = 0;
      }

      indices[hIndex]++;

      headingNode.prepend(`
        <small class="text-muted">
          Exercise ${indices.join('.')}:
        </small>
      `);
    });

    this.exerciseNames = exerciseNames;
  }

  onClickExerciseLink(e) {
    const id = `${e.currentTarget.getAttribute('href').substring(1)}-root`;

    scrollToId(id);
  }

  // Built with DOM nodes rather than an HTML string: the names come from heading text.
  renderExecisesList() {
    const rows = chunk(this.exerciseNames, 3).map((exercises, rowIndex) => {
      const rowNode = $('<div class="row"></div>');

      exercises.forEach((exercise, index) => {
        const linkNode = $('<a data-bs-toggle="collapse" class="exercise-list__link"></a>')
          .attr('href', exercise.href)
          .text(`Exercise ${rowIndex * 3 + index + 1}: ${exercise.name}`);

        rowNode.append($('<div class="exercise-list__item col-12 col-md-6 col-lg-4"></div>').append(linkNode));
      });

      return rowNode;
    });

    this.exerciseListNode.empty().append(rows);
  }
}

export default Exercises;
