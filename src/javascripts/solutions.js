import { kebabCase, uniqueId } from 'lodash-es';

import { numberHeadings } from './exercises';

// The model solutions (folded like the exercises, collapse.js): ids for their bodies and toggles, and
// "Solution:" before their headings.
class Solutions {
  mount() {
    document.querySelectorAll('.solution').forEach(solutionNode => {
      const headingNode = solutionNode.querySelector('.solution__heading');
      const text = headingNode ? headingNode.textContent : '';
      const id = `${uniqueId('solution-')}-${kebabCase(text)}`;

      solutionNode.setAttribute('data-name', text);
      solutionNode.setAttribute('data-href', `#${id}`);
      solutionNode.id = `${id}-root`;
      solutionNode.querySelectorAll('.collapse').forEach(node => { node.id = id; });
      solutionNode.querySelectorAll('.solution__toggle').forEach(node => node.setAttribute('href', `#${id}`));
    });

    numberHeadings([...document.querySelectorAll('.solution h1, .solution h2')], () => 'Solution:');
  }
}

export default Solutions;
