import { kebabCase } from 'lodash-es';
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

function span(className, text) {
  const node = document.createElement('span');

  node.className = className;
  node.textContent = text;

  return node;
}

// "Exercise 1.2:" before the headings of the exercises (an exercise may have sub-headings, <h2>).
export function numberHeadings(headings, label) {
  let indices = [];

  headings.forEach(heading => {
    const hIndex = parseInt(heading.nodeName.substring(1)) - 1;

    if (indices.length - 1 > hIndex) {
      indices = indices.slice(0, hIndex + 1);
    }

    if (indices[hIndex] === undefined) {
      indices[hIndex] = 0;
    }

    indices[hIndex]++;

    heading.insertAdjacentHTML('afterbegin', `
          <small class="text-muted">
            ${label(indices)}
          </small>
        `);
  });
}

class Exercises {
  mount() {
    this.exerciseNodes = [...document.querySelectorAll('.exercise')];
    this.exerciseListNode = document.getElementById('exercise-list');

    if (this.exerciseListNode) {
      this.exerciseListNode.addEventListener('click', event => {
        const link = event.target.closest('.exercise-list__link');

        if (link) {
          scrollToId(`${link.getAttribute('href').substring(1)}-root`);
        }
      });
    }

    this.addIds();
    // One entry per exercise heading (<h1>), in the order of the page.
    this.exerciseNames = [...document.querySelectorAll('.exercise h1')]
      .map(heading => heading.closest('.exercise'))
      .map(node => ({ name: node.getAttribute('data-name'), points: node.getAttribute('data-points'), href: node.getAttribute('data-href') }));
    numberHeadings([...document.querySelectorAll('.exercise h1, .exercise h2')], indices => `Exercise ${indices.join('.')}:`);
    this.renderExercisesList();
  }

  addIds() {
    this.exerciseNodes.forEach(exerciseNode => {
      const headingNode = exerciseNode.querySelector('.exercise__heading');
      const headingText = headingNode ? headingNode.textContent : '';
      // The anchor comes from anchors.js, which the search uses too.
      const id = exerciseNode.getAttribute('data-anchor') || `exercise-${kebabCase(headingText)}`;
      const { name, points } = splitPoints(headingText);

      exerciseNode.setAttribute('data-name', name);

      if (points) {
        exerciseNode.setAttribute('data-points', points);
      }

      exerciseNode.setAttribute('data-href', `#${id}`);
      exerciseNode.id = `${id}-root`;
      exerciseNode.querySelectorAll('.collapse').forEach(node => { node.id = id; });
      exerciseNode.querySelectorAll('.exercise__toggle').forEach(node => node.setAttribute('href', `#${id}`));

      if (points && headingNode) {
        headingNode.replaceChildren(document.createTextNode(`${name} `), span('points-pill', points));
      }
    });
  }

  // Built with DOM nodes rather than an HTML string: the names come from heading text.
  renderExercisesList() {
    if (!this.exerciseListNode) {
      return;
    }

    this.exerciseListNode.replaceChildren(...this.exerciseNames.map((exercise, index) => {
      const label = `Exercise ${index + 1}: ${exercise.name}${exercise.points ? ` (${exercise.points})` : ''}`;
      const link = document.createElement('a');

      link.setAttribute('data-bs-toggle', 'collapse');
      link.className = 'exercise-list__link';
      link.setAttribute('href', exercise.href);
      link.setAttribute('aria-label', label);
      link.append(span('exercise-list__number', String(index + 1)), span('exercise-list__name', exercise.name));

      if (exercise.points) {
        link.append(span('points-pill', exercise.points));
      }

      return link;
    }));
  }
}

export default Exercises;
