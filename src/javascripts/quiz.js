// The practice quiz (quiz/index.html): twenty questions for each week, with an explanation for every
// answer. The questions are in quiz/questions.json, where the correct option is listed first; the
// options are shuffled every time a question is shown. Results stay in this browser (localStorage),
// when the browser allows it; the quiz works without them. Formulas are typeset with
// window.IntroAI.math (javascripts/math.js, loaded before this script).
import WEEKS from './quiz/questions.json';
import { navOffset, prefersReducedMotion } from './utils';
import { el } from './viz/lib';

const STORAGE_KEY = 'introai-quiz-v1';
const MIX_LENGTH = 20;
const KEYS = ['A', 'B', 'C', 'D'];

// Every question with a stable id: "3-7" is question 7 of week 3.
const QUESTIONS = WEEKS.flatMap(week => week.questions.map((question, index) => ({
  ...question,
  id: `${week.week}-${index + 1}`,
  week: week.week,
})));

const MESSAGES = [
  [1, 'Flawless. Not even alpha-beta could prune this performance.'],
  [0.8, 'Excellent! Your posterior probability of acing the exam just went up.'],
  [0.55, 'Solid work. A few more epochs and you will converge.'],
  [0.3, 'A good start: every expert was once a novice (ask Dreyfus).'],
  [0, 'Exploration phase complete. Now exploit the explanations and try again.'],
];

function loadResults() {
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY));

    return data && typeof data.results === 'object' && data.results ? data.results : {};
  } catch (error) {
    return {};
  }
}

function saveResults(results) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ results }));
  } catch (error) {
    // Full, disabled or blocked storage (for example in a private window): results last for this visit.
  }
}

function shuffle(items) {
  const array = items.slice();

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

// The questions are part of the site, not user input, so their HTML (formulas, code) is inserted as is.
function html(tag, props, markup) {
  const node = el(tag, props);

  node.innerHTML = markup;

  return node;
}

function typeset(node) {
  if (window.IntroAI && window.IntroAI.math) {
    window.IntroAI.math.typeset(node);
  }
}

function weekOf(number) {
  return WEEKS.find(week => week.week === number);
}

export default function mountQuiz(root) {
  const results = loadResults();
  let run = null;

  // --- The list of weeks --------------------------------------------------------------------------

  function showHome() {
    run = null;

    const correct = ids => ids.filter(id => results[id] === true).length;
    const total = correct(QUESTIONS.map(q => q.id));

    const decks = WEEKS.map(week => {
      const ids = week.questions.map((q, index) => `${week.week}-${index + 1}`);
      const score = correct(ids);
      const answered = ids.filter(id => id in results).length;

      return el('li', {},
        el('button', { type: 'button', class: 'quiz-deck', onClick: () => startWeek(week.week) },
          el('span', { class: 'quiz-deck__week', text: `Week ${week.week}` }),
          el('span', { class: 'quiz-deck__title', text: week.title }),
          el('span', { class: 'quiz-deck__tagline', text: week.tagline }),
          el('span', { class: 'quiz-meter', 'aria-hidden': 'true' },
            el('span', { style: `width:${(100 * score) / ids.length}%` })),
          el('span', { class: 'quiz-deck__score', text: answered ? `${score} of ${ids.length} correct` : `${ids.length} questions` })));
    });

    decks.push(el('li', {},
      el('button', { type: 'button', class: 'quiz-deck quiz-deck--mix', onClick: startMix },
        el('span', { class: 'quiz-deck__week' }, el('i', { class: 'fa fa-random', 'aria-hidden': 'true' }), ' All weeks'),
        el('span', { class: 'quiz-deck__title', text: 'Mixed bag' }),
        el('span', { class: 'quiz-deck__tagline', text: `${MIX_LENGTH} random questions from the whole course.` }),
        el('span', { class: 'quiz-deck__score', text: `${QUESTIONS.length} questions in the pool` }))));

    const reset = el('button', {
      type: 'button',
      class: 'quiz-link',
      onClick: () => {
        if (window.confirm('Forget your quiz results in this browser?')) {
          Object.keys(results).forEach(id => delete results[id]);
          saveResults(results);
          showHome();
        }
      },
    }, 'Reset my results');

    root.replaceChildren(el('div', { class: 'quiz-home' },
      el('p', { class: 'quiz-home__total' },
        el('b', { text: `${total} of ${QUESTIONS.length}` }), ' questions answered correctly so far',
        Object.keys(results).length ? [' · ', reset] : null),
      el('ul', { class: 'quiz-decks' }, decks)));
  }

  // --- A run through a list of questions ------------------------------------------------------------

  function start(ids, label, week) {
    run = { ids, label, week, position: 0, score: 0, streak: 0, bestStreak: 0, missed: [] };
    showQuestion();
  }

  function startWeek(number) {
    const week = weekOf(number);

    start(week.questions.map((q, index) => `${number}-${index + 1}`), `Week ${number} · ${week.title}`, number);
  }

  function startMix() {
    start(shuffle(QUESTIONS.map(q => q.id)).slice(0, MIX_LENGTH), 'Mixed bag · all weeks', null);
  }

  function showQuestion() {
    const question = QUESTIONS.find(q => q.id === run.ids[run.position]);
    const number = run.position + 1;
    const headingId = `quiz-q-${question.id}`;
    let answered = false;

    const feedback = el('div', { class: 'quiz-feedback', 'aria-live': 'polite' });
    const next = el('button', {
      type: 'button',
      class: 'quiz-next',
      hidden: true,
      onClick: () => {
        run.position += 1;

        if (run.position < run.ids.length) {
          showQuestion();
        } else {
          showResults();
        }
      },
    }, number < run.ids.length ? 'Next question' : 'See my score', el('i', { class: 'fa fa-arrow-right', 'aria-hidden': 'true' }));

    // The options in a new random order; each remembers its index in the JSON (0 is correct).
    const order = shuffle(question.options.map((text, index) => ({ text, index })));
    const options = order.map((option, position) => {
      const node = el('button', { type: 'button', class: 'quiz-option', onClick: () => answer(position) },
        el('span', { class: 'quiz-option__key', 'aria-hidden': 'true', text: KEYS[position] }),
        html('span', { class: 'quiz-option__text' }, option.text));

      return node;
    });

    function answer(position) {
      if (answered) {
        return;
      }

      answered = true;
      const correct = order[position].index === question.answer;
      const right = order.findIndex(option => option.index === question.answer);

      options.forEach((node, i) => {
        node.disabled = true;
        node.classList.toggle('is-correct', i === right);
        node.classList.toggle('is-wrong', i === position && !correct);
        node.setAttribute('aria-pressed', String(i === position));
      });

      results[question.id] = correct;
      saveResults(results);

      if (correct) {
        run.score += 1;
        run.streak += 1;
        run.bestStreak = Math.max(run.bestStreak, run.streak);
      } else {
        run.streak = 0;
        run.missed.push(question.id);
      }

      feedback.className = `quiz-feedback ${correct ? 'is-correct' : 'is-wrong'}`;
      feedback.replaceChildren(
        el('p', { class: 'quiz-feedback__verdict' },
          el('i', { class: `fa ${correct ? 'fa-check' : 'fa-times'}`, 'aria-hidden': 'true' }),
          correct ? 'Correct!' : `Not quite: the answer is ${KEYS[right]}.`),
        html('p', { class: 'quiz-feedback__explain' }, question.explain));
      typeset(feedback);
      updateMeta();
      meter.firstChild.style.width = `${(100 * number) / run.ids.length}%`;
      meter.setAttribute('aria-valuenow', String(number));

      next.hidden = false;
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    const meta = el('div', { class: 'quiz-run__meta' });

    function updateMeta() {
      // replaceChildren() would print a null as text, so the streak is added only when there is one.
      meta.replaceChildren(
        el('span', { text: `Question ${number} of ${run.ids.length}` }),
        el('span', { text: `Score ${run.score}` }));

      if (run.streak >= 3) {
        meta.append(el('span', { class: 'quiz-streak' }, el('i', { class: 'fa fa-fire', 'aria-hidden': 'true' }), `${run.streak} in a row`));
      }
    }

    updateMeta();

    const heading = html('h2', { class: 'quiz-card__question', id: headingId, tabindex: '-1' }, question.q);
    const card = el('div', { class: 'quiz-card' },
      run.week === null ? el('p', { class: 'quiz-card__week', text: `Week ${question.week} · ${weekOf(question.week).title}` }) : null,
      heading,
      el('div', { class: 'quiz-options', role: 'group', 'aria-labelledby': headingId }, options),
      feedback,
      el('div', { class: 'quiz-actions' }, next));

    // The share of the run answered so far; it moves on when this question is answered.
    const meter = el('div', {
      class: 'quiz-meter quiz-meter--run',
      role: 'progressbar',
      'aria-label': 'Questions answered',
      'aria-valuemin': '0',
      'aria-valuemax': String(run.ids.length),
      'aria-valuenow': String(run.position),
    }, el('span', { style: `width:${(100 * run.position) / run.ids.length}%` }));

    root.replaceChildren(el('div', { class: 'quiz-run' }, header(), meter, meta, card));

    typeset(card);
    heading.focus({ preventScroll: true });
    revealTop();
    run.answer = answer;
    run.next = () => !next.hidden && next.click();
  }

  function header() {
    return el('div', { class: 'quiz-run__head' },
      el('button', { type: 'button', class: 'quiz-link', onClick: showHome }, '← All weeks'),
      el('span', { class: 'quiz-run__label', text: run.label }));
  }

  function showResults() {
    const total = run.ids.length;
    const ratio = run.score / total;
    const message = MESSAGES.find(([threshold]) => ratio >= threshold)[1];
    const missed = run.missed.slice();
    const nextWeek = run.week && run.week < WEEKS.length ? run.week + 1 : null;
    const actions = [];

    if (missed.length && missed.length < total) {
      actions.push(el('button', {
        type: 'button',
        class: 'quiz-next',
        onClick: () => start(missed, `${run.label} · the ones you missed`, run.week),
      }, el('i', { class: 'fa fa-repeat', 'aria-hidden': 'true' }), `Retry the ${missed.length} you missed`));
    }

    actions.push(el('button', {
      type: 'button',
      class: missed.length ? 'quiz-button' : 'quiz-next',
      onClick: () => (run.week ? startWeek(run.week) : startMix()),
    }, run.week ? 'Start this week again' : 'Another mixed bag'));

    if (nextWeek) {
      actions.push(el('button', { type: 'button', class: 'quiz-button', onClick: () => startWeek(nextWeek) },
        `Next: Week ${nextWeek}`, el('i', { class: 'fa fa-arrow-right', 'aria-hidden': 'true' })));
    }

    actions.push(el('button', { type: 'button', class: 'quiz-button', onClick: showHome }, 'All weeks'));

    const score = el('p', { class: 'quiz-results__score', tabindex: '-1' },
      ratio === 1 ? el('i', { class: 'fa fa-trophy', 'aria-hidden': 'true' }) : null,
      el('b', { text: String(run.score) }), ` / ${total}`);

    root.replaceChildren(el('div', { class: 'quiz-run' },
      header(),
      el('div', { class: `quiz-results${ratio === 1 ? ' is-perfect' : ''}` },
        score,
        el('p', { class: 'quiz-results__message', text: message }),
        run.bestStreak >= 3 ? el('p', { class: 'quiz-results__streak' },
          el('i', { class: 'fa fa-fire', 'aria-hidden': 'true' }), `Best streak: ${run.bestStreak} in a row`) : null,
        el('div', { class: 'quiz-results__actions' }, actions))));

    run = { ...run, answer: null, next: null };
    score.focus({ preventScroll: true });
    revealTop();
  }

  // After a click near the bottom of a long card, the next view starts at its top, below the navigation bar.
  function revealTop() {
    const top = root.getBoundingClientRect().top - navOffset();

    if (top < 0 || top > window.innerHeight / 2) {
      window.scrollTo({ top: window.scrollY + top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  // Keys 1-4 or A-D answer, Enter or N moves on, while a question is on screen.
  document.addEventListener('keydown', event => {
    const target = event.target;

    if (!run || !run.answer || event.altKey || event.ctrlKey || event.metaKey
      || (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) {
      return;
    }

    const key = event.key.toUpperCase();
    const position = /^[1-4]$/.test(key) ? Number(key) - 1 : KEYS.indexOf(key);

    if (position >= 0 && position < KEYS.length) {
      event.preventDefault();
      run.answer(position);
    } else if ((key === 'ENTER' && !(target && target.tagName === 'BUTTON')) || key === 'N') {
      event.preventDefault();
      run.next();
    }
  });

  // quiz/#week-3 opens week 3 directly, also from a link on this page.
  function route() {
    const match = /^#week-([1-7])$/.exec(window.location.hash);

    if (match) {
      startWeek(Number(match[1]));
    } else if (!run) {
      showHome();
    }
  }

  window.addEventListener('hashchange', route);
  route();
}

const root = document.getElementById('quiz');

if (root) {
  mountQuiz(root);
}
