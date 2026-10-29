import { uniqueId, kebabCase } from 'lodash-es';
import { scrollToId } from './utils';

// "Towers of Hanoi (1p)" -> { name: "Towers of Hanoi", points: "1p" }. Also matches "(up to 5p)" and
// "(no points)"; headings without points keep their full text as the name.
const POINTS = /\s*\(((?:up to )?\d+(?:\.\d+)?p|no points)\)\s*$/;

function splitPoints(heading) {
  const text = heading.replace(/\s+/g, ' ').trim();
  const match = text.match(POINTS);

  return match
    ? { name: text.slice(0, match.index), points: match[1] }
    : { name: text, points: undefined };
}

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
      const { name, points } = splitPoints(headingNode.text());

      exerciseNode.attr('data-name', name);
      exerciseNode.attr('data-points', points);
      exerciseNode.attr('data-href', `#${id}`);
      exerciseNode.attr('id', `${id}-root`);
      collapseNode.attr('id', id);
      toggleNode.attr('href', `#${id}`);

      if (points) {
        headingNode.empty().append(
          document.createTextNode(`${name} `),
          $('<span class="points-pill"></span>').text(points)
        );
      }
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
          points: exerciseNode.attr('data-points'),
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
    const links = this.exerciseNames.map((exercise, index) => {
      const label = `Exercise ${index + 1}: ${exercise.name}${exercise.points ? ` (${exercise.points})` : ''}`;
      const linkNode = $('<a data-bs-toggle="collapse" class="exercise-list__link"></a>')
        .attr('href', exercise.href)
        .attr('aria-label', label)
        .append(
          $('<span class="exercise-list__number"></span>').text(index + 1),
          $('<span class="exercise-list__name"></span>').text(exercise.name)
        );

      if (exercise.points) {
        linkNode.append($('<span class="points-pill"></span>').text(exercise.points));
      }

      return linkNode;
    });

    this.exerciseListNode.empty().append(links);
  }
}

export default Exercises;
