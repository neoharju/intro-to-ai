// Progress through the course, kept only in this browser (localStorage), like the quiz results:
//
//   - a week puts a "Done" switch in the header of every exercise, marks the done exercises in its list of
//     exercises and says in its page header how many are done;
//   - the front page shows a table of the weeks: the exercises marked done (for the weeks where the reader
//     has marked any) and the questions answered in the practice quiz.
//
// Nothing is sent anywhere. Stored as { weeks: { week3: { total: 12, done: ['exercise-…', …] } } }, by the
// stable anchors of the exercises (anchors.js), so a mark stays with its exercise when others are added.
const KEY = 'introai-progress-v1';
const QUIZ_KEY = 'introai-quiz-v1';

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || {};
  } catch (error) {
    return {};
  }
}

function load() {
  const data = read(KEY);

  return data.weeks && typeof data.weeks === 'object' ? data : { weeks: {} };
}

function save(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (error) {
    // Full, disabled or blocked storage (a private window, for example): the marks last for this visit.
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text) {
    node.textContent = text;
  }

  return node;
}

function icon(name) {
  const node = el('i', `fa ${name}`);

  node.setAttribute('aria-hidden', 'true');

  return node;
}

// --- A week ------------------------------------------------------------------------------------------------

function mountWeek(week) {
  const exercises = [...document.querySelectorAll('#material .exercise[data-anchor]')];

  if (!exercises.length) {
    return;
  }

  const data = load();
  const ids = exercises.map(node => node.getAttribute('data-anchor'));
  // Marks of exercises that no longer exist are dropped.
  const done = new Set(((data.weeks[week] || {}).done || []).filter(id => ids.includes(id)));
  const meta = document.querySelector('.page-hero__meta');
  const summary = el('li', 'page-hero__progress');

  if (meta) {
    meta.append(summary);
  }

  function render() {
    exercises.forEach(node => {
      const id = node.getAttribute('data-anchor');
      const on = done.has(id);
      const link = document.querySelector(`.exercise-list__link[href="#${CSS.escape(id)}"]`);

      node.classList.toggle('is-done', on);
      node.querySelector('.exercise__done').setAttribute('aria-pressed', String(on));

      if (link) {
        link.classList.toggle('is-done', on);
        link.setAttribute('aria-label', link.getAttribute('aria-label').replace(/, done$/, '') + (on ? ', done' : ''));
      }
    });

    summary.replaceChildren(icon('fa-check'), document.createTextNode(`${done.size} of ${ids.length} done`));
    summary.classList.toggle('is-complete', done.size === ids.length);
  }

  exercises.forEach(node => {
    const id = node.getAttribute('data-anchor');
    const header = node.querySelector('.exercise__header');
    const name = node.getAttribute('data-name') || '';
    const button = el('button', 'exercise__done');

    button.type = 'button';
    button.title = 'Mark this exercise as done (saved in this browser only)';
    button.setAttribute('aria-label', `Done: ${name}`);
    button.append(icon('fa-check'), el('span', 'exercise__done-label', 'Done'));
    button.addEventListener('click', () => {
      if (done.has(id)) {
        done.delete(id);
      } else {
        done.add(id);
      }

      data.weeks[week] = { total: ids.length, done: ids.filter(other => done.has(other)) };
      save(data);
      render();
    });

    if (header) {
      header.append(button);
    }
  });

  render();
}

// --- The front page ----------------------------------------------------------------------------------------

function mountOverview(container) {
  // The weeks, from the navigation bar.
  const weeks = [...document.querySelectorAll('.navbar .nav-link')]
    .map(link => ({ label: link.textContent.trim(), match: link.getAttribute('href').match(/^(week([1-7]))\/$/) }))
    .filter(week => week.match)
    .map(({ label, match }) => ({ label, key: match[1], number: match[2] }));

  function render() {
    const data = load();
    const quiz = read(QUIZ_KEY).results || {};
    const table = el('table', 'table progress-overview__table');
    const head = el('tr');
    const body = el('tbody');
    let marked = 0;

    ['Week', 'Exercises done', 'Practice quiz'].forEach(title => {
      const cell = el('th', '', title);

      cell.scope = 'col';
      head.append(cell);
    });
    table.append(el('thead'), body);
    table.firstChild.append(head);

    weeks.forEach(({ label, key, number }) => {
      const row = el('tr');
      const week = el('td');
      const exercises = el('td');
      const answers = Object.keys(quiz).filter(id => id.startsWith(`${number}-`));
      const correct = answers.filter(id => quiz[id] === true).length;
      const entry = data.weeks[key];
      const link = el('a', '', label);
      const quizLink = el('a', '', answers.length ? `${answers.length} answered, ${correct} correct` : 'not started');

      link.href = `${key}/`;
      week.append(link);

      if (entry && entry.total) {
        const bar = el('span', 'progress-overview__bar');
        const fill = el('span');

        marked += entry.done.length;
        fill.style.width = `${Math.round((100 * entry.done.length) / entry.total)}%`;
        bar.append(fill);
        exercises.append(document.createTextNode(`${entry.done.length} of ${entry.total}`), bar);
      } else {
        exercises.append(el('span', 'progress-overview__none', 'none marked'));
      }

      quizLink.href = `quiz/#week-${number}`;
      row.append(week, exercises, el('td'));
      row.lastChild.append(quizLink);
      body.append(row);
    });

    const wrap = el('div', 'table-wrap');
    const reset = el('button', 'btn btn-secondary progress-overview__reset', 'Clear the exercise marks');

    wrap.append(table);
    reset.type = 'button';
    reset.hidden = !marked;
    reset.addEventListener('click', () => {
      // eslint-disable-next-line no-alert
      if (window.confirm('Clear the done marks of every exercise in this browser? The quiz results stay.')) {
        save({ weeks: {} });
        render();
      }
    });

    container.replaceChildren(
      el('h3', 'progress-overview__title', 'Your progress'),
      el('p', 'progress-overview__note', 'Mark an exercise as done with the Done switch in its header. The marks and the '
        + 'quiz results stay in this browser only: nothing is sent anywhere.'),
      wrap,
      reset,
    );
  }

  render();

  // Marks made in another tab.
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === QUIZ_KEY || event.key === null) {
      render();
    }
  });
}

export default function mountProgress() {
  const week = window.location.pathname.match(/\/(week[1-7])\/(?:index\.html)?$/);
  const overview = document.getElementById('progress-overview');

  if (week) {
    mountWeek(week[1]);
  }

  if (overview) {
    mountOverview(overview);
  }
}
