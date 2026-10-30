# Introduction to Artificial Intelligence: personal copy

This is my personal copy of the course material for **Introduction to AI**, a course at the Department of
Computer Science, University of Helsinki. I am only modifying it for my own use. It is not the official
course.

## Credits

The course material is the work of the course staff and the contributors of the original repository.
Thank you for making it openly available.

- Original repository: <https://github.com/materiaalit/intro-to-ai/tree/gh-pages>
- Contributors: <https://github.com/materiaalit/intro-to-ai/graphs/contributors>
- Official course site: <https://materiaalit.github.io/intro-to-ai/>

## License

The original material is licensed under the
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/)
(CC BY-NC-SA 4.0), included in [LICENSE](LICENSE). My changes are shared under the same license, and this
copy is for non-commercial use only.

## What I changed

Compared with the original `gh-pages` branch (commit `b9dedeb`):

- **Front-end dependencies:** jQuery, Bootstrap, highlight.js and Font Awesome are upgraded and, like the
  Inter font and KaTeX (for the formulas), served from this repository instead of third-party CDNs. The shared
  JavaScript and CSS are built from `src/`.
- **Docker preview:** a `Dockerfile` and `compose.yaml` to preview the site locally.
- **Corrections in weeks 1–7:** factual errors and broken code examples are corrected.
- **Removed:** the original course's Google Analytics tracking, cookie banner and disabled login form,
  unused images, and the icon and font files the pages never load.
- **Design:** a new look (Inter font, a sticky top bar, a header for each week, cards for hints and
  exercises, a table of contents that highlights the current section) and interactive figures in every
  week, from search algorithms and alpha-beta pruning to attention and Q-learning. The figures run the
  algorithms described in the text, in the browser; their code is in `src/javascripts/viz/`.
- **Practice quiz:** `quiz/` has 20 multiple-choice questions for each week, each with an explanation.
- **Colour themes:** light and dark, following the device's setting by default.
- **Text size:** normal, large or extra large reading text, from the "Aa" menu in the navigation bar.
- **Zen mode:** the material without the navigation bar, page header, lecture and deadline boxes and footer
  (the lotus button or the Z key; Z or Esc leaves it).

## Preview locally

GitHub Pages publishes this branch as it is. The pages are plain HTML (`index.html`, `week1/` to `week7/`
and `quiz/`).
To preview them:

```bash
docker compose up --build
```

The site is served at <http://localhost:4567>.

## Formulas and pseudocode

Formulas are written in TeX in the pages, inline in `<span class="math">…</span>` and displayed on a line of
their own in `<div class="math">…</div>` (add `math--key` to set a key equation on a card). Pages with formulas
load `javascripts/math.js`, which typesets them with KaTeX. Pseudocode listings use
`<pre class="sh_pseudo"><code>…</code></pre>`, highlighted by the grammar in `src/javascripts/pseudocode.js`.

## Colour themes

The pages have a light and a dark theme, chosen from the menu in the navigation bar ("Match the system"
follows the device). `javascripts/theme.js`, loaded in the `<head>` of every page, applies the choice
before the page is drawn and remembers it in `localStorage`. The colours are CSS custom properties: the light
values in `src/stylesheets/_tokens.scss`, the dark ones in `src/stylesheets/_themes.scss`, so components
should use the tokens instead of fixed colours. The interactive figures take their colours from `COLORS` in
`src/javascripts/viz/lib.js`, which reads the tokens and updates them when the theme changes: canvases made
with `createCanvas` redraw by themselves, and a figure that uses derived colours (`sequential`, `diverging`)
re-renders with `onThemeChange(render)`.

Code listings are coloured with the `--code-*` tokens of each theme: bold blue keywords, teal names, orange
strings and grey italic comments. They were chosen to stay distinct with colour vision deficiencies (no
red-green or pink contrasts), so check a new colour with a colour-blindness simulator before changing them.

## Text size

The "Aa" menu (`src/javascripts/font-size-menu.js`) sets `data-font-size="large"` or `"xlarge"` on `<html>`,
which raises the root font size from 16px to 18px or 20px; `theme.js` restores it before the page is drawn.
Everything in the page is sized in `rem`, so it follows. The navigation bar (`_navbar.scss`) is sized in `px`
on purpose, so that it keeps its size and still fits on one line.

## The practice quiz

The questions are in `src/javascripts/quiz/questions.json`, 20 for each week. Each has the question `q`, four
`options` with the correct one first (`answer` is 0; the page shuffles the options), and an explanation
`explain`. All three may contain HTML and formulas in `<span class="math">…</span>`. Keep the options of a
question similar in length and form, so that the longest one is not a giveaway. Results are kept in the
reader's browser only (`localStorage`, key `introai-quiz-v1`). `quiz/#week-3` opens the questions of week 3.

## Rebuild the assets

The shared JavaScript, CSS and fonts in `javascripts/`, `stylesheets/` and `fonts/vendor/` are built from
`src/` and committed, because GitHub Pages does not run a build. After changing `src/` or the dependencies:

```bash
npm ci
npm run build
```

Then commit the changes in `javascripts/`, `stylesheets/` and `fonts/vendor/`.

