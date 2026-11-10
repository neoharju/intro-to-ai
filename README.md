# Introduction to Artificial Intelligence: personal copy

This is my personal copy of the course material for **Introduction to AI**, a course at the Department of
Computer Science, University of Helsinki. I am only modifying it for my own use. It is not the official
course.

Served at: <https://neoharju.github.io/intro-to-ai/>

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

The course staff's own updates are included up to commit `7947a94` of the original `gh-pages` branch
(November 2026).

Compared with the original material:

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
  algorithms described in the text, in the browser; their code is in `src/javascripts/viz/`. A figure is
  built when it comes near the screen or when the browser is idle (`mountAll` in `viz/lib.js`), so it does
  not hold up the loading of the page, and its animation runs only while it is on screen.
- **Practice quiz:** `quiz/` has 20 multiple-choice questions for each week, each with an explanation.
- **Extra sections on cost and performance:** Weeks 4 and 5 end with optional sections on time and memory
  complexity (from the perceptron and dense layers to attention and the KV cache) and on performance
  engineering (arithmetic intensity and the roofline model, number formats, FlashAttention, memory-bound
  decoding).
- **Colour themes:** light and dark, following the device's setting by default.
- **Text size:** normal, large or extra large reading text, from the "Aa" menu in the navigation bar.
- **Search:** the search button at the right of the navigation bar, Ctrl+K (⌘K on a Mac) or the / key
  searches the sections and exercises of the front page and weeks 1–7, and goes to the chosen one.
- **Zen mode:** the material without the navigation bar, page header, lecture and deadline boxes and footer
  (the lotus button or the Z key; Z or Esc leaves it).

## Simplified English

Every week can have a second version of its text in simplified English (about 80% ASD-STE100 Issue 9),
for students whose first language is not English. The "Simplified English" switch in the page header
swaps it in and back, block by block (`src/javascripts/simplify.js`); formulas, code, figures and
headings stay as they are. The text is written in `src/simple/weekN.txt`, one entry per paragraph, list
item, table cell or caption, keyed by a fingerprint of the original text, and compiled into
`weekN/simple.json`. A week with a simplified version has `<meta name="introai-simple" content="simple.json">`
in its head.

```bash
npm run simple                      # compile src/simple/*.txt
npm run simple -- --extract week3   # the blocks of a page and their fingerprints, to write from
npm run simple -- --check           # stale entries, and lost formulas, links, code or numbers
```

`--extract` and `--check` load the pages in Chromium (see [Checks](#checks)). When the text of a page
changes, `--check` lists the entries whose original no longer exists; until they are updated, those blocks
show their original text.

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

A displayed formula that is wider than the column scrolls sideways. So does a drawn diagram (`<svg class="dg">`)
on a narrow screen: `src/javascripts/ui.js` keeps it at least 3/4 of its viewBox width in pixels, so that its
labels stay about 10 px on a phone instead of shrinking to 5 px. Both fade out on the side where there is more.

### Formulas typeset in advance

`npm run prerender` (`scripts/prerender.mjs`) builds `_site/`, the files that GitHub Pages publishes from this
branch, with every formula of the pages and of the simplified English typeset by KaTeX in advance, with the
settings of `math.js` (`src/javascripts/math-options.js`). A page then shows its formulas at once: at a 4x
slower CPU, as on a mid-range phone, `math.js` takes 12-200 ms instead of 200-770 ms per week. The typeset
formulas are the same as those typeset in the browser, and the gzipped pages grow by 0-22 KB.

`.github/workflows/pages.yml` builds `_site/` on every push and publishes it once GitHub Pages is set to
publish from the workflow: in the repository's Settings, Pages, set Source to "GitHub Actions" (once). Until
then GitHub Pages publishes the branch as it is, the formulas are typeset in the browser as before, and the
workflow only builds the site, which still fails if a formula cannot be typeset. The Check workflow also
loads the built site.

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

## Search

The search (`src/javascripts/search.js`, styles in `_search.scss`) needs no index file. The first time it
opens, it fetches the pages of the navigation bar (not the quiz, whose questions are not in its HTML) and
splits them into sections and exercises, leaving out formulas, figures and buttons, so the results always
match the pages. Every term of the query must occur in a result; titles count more than the text. A result
links to the anchor of its section or exercise. The anchors are made from the heading text
(`src/javascripts/anchors.js`), the same way in the page and in the search; a heading that has an `id` in the
HTML keeps it, so links such as `../week4/#optimization` stay valid, and the earlier addresses
(`#section-12-…`, `#exercise-3-…`) still lead to their section or exercise. An exercise opens when its
address is visited.

## The practice quiz

The questions are in `src/javascripts/quiz/questions.json`, 20 for each week. Each has the question `q`, four
`options` with the correct one first (`answer` is 0; the page shuffles the options), and an explanation
`explain`. All three may contain HTML and formulas in `<span class="math">…</span>`. Keep the options of a
question similar in length and form, so that the longest one is not a giveaway. Results are kept in the
reader's browser only (`localStorage`, key `introai-quiz-v1`). `quiz/#week-3` opens the questions of week 3.

## Glossary

`glossary/index.html` defines the main terms of the course, each with a link to the section that introduces
it (the page check verifies those links). The footer of every page and the front page link to it, and the
search indexes it like the weeks (its footer link has `data-search`). It is not in the navigation bar, which
is full. Its sections have no numbers: `data-unnumbered` on `#material` turns them off in the table of
contents and the search.

## Progress

Every exercise has a "Done" switch in its header (`src/javascripts/progress.js`). A week marks the done
exercises in its list of exercises and counts them in its page header, and the front page shows a table of
the weeks under the course schedule: the exercises marked done and the questions answered in the practice
quiz. Like the quiz results, the marks stay in the browser (`localStorage`, key `introai-progress-v1`, by
the stable anchors of the exercises); nothing is sent anywhere.

## Shared parts and dates

The head, the navigation bar, the footer and the scripts at the end of every page are written once, in
`src/partials/`, and copied into the pages by `npm run sync` (also part of `npm run build`): it rewrites the
regions between `<!-- shared:NAME -->` and `<!-- /shared:NAME -->`, with the title, the scripts and the
simplified-English setting of each page from `src/site.json`. Edit the partials or `src/site.json`, not the
regions in the pages. The pages themselves stay plain HTML, so GitHub Pages serves them as they are.

GitHub Pages cannot send security headers, so the head of every page carries the Content-Security-Policy
of `docker/nginx.conf` as a `<meta http-equiv>`: scripts, styles, fonts and requests only from the site
itself. `npm run sync` takes it from `docker/nginx.conf`, so the two cannot drift apart; `frame-ancestors`
is left out because browsers ignore it in a `<meta>`.

The dates of the course are in `src/schedule.json`. A date in a page or in `src/simple/weekN.txt` is written
as `<time data-date="lecture-5">We 11/11</time>`; `npm run sync` fills in its text and its `datetime` from the
schedule, so next year's dates change in one file. `npm run sync -- --check` only reports pages that are out
of date.

## Course folder for students

`starter/` is the course folder that students download from the front page as
`files/intro-to-ai-starter.zip`: a uv project with Python 3.12 and the course's packages locked in
`uv.lock`, a `check_setup.py` and a README. Its `pyproject.toml` lets uv take only releases that are at least
14 days old (`exclude-newer`), also for the packages that students add, and on Linux takes PyTorch from the
CPU-only index (about 200 MB instead of about 3 GB with the CUDA libraries). `npm run build` (or
`npm run starter`, `scripts/starter.mjs`) packs the files of `starter/` into the zip, uncompressed and with
fixed dates, so the same files always give the same zip; the Check workflow fails if the committed zip does
not match them.

Before a new course, update the locked versions and rebuild the zip:

```bash
cd starter
uv lock --upgrade
cd ..
npm run starter
```

## Checks

Every push and pull request runs `.github/workflows/check.yml` on GitHub Actions:

- `npm run build` and `npm run simple` must leave the repository unchanged: the committed assets, shared
  parts, dates and `weekN/simple.json` are what the sources build;
- `npm run simple -- --check`: no simplified-English entry has lost its original;
- `npm run check` (`scripts/check-pages.mjs`) loads every page in Chromium, on a desktop and at phone width
  (390 px), with the simplified English off and on. It fails on errors in the console, uncaught
  exceptions, requests that the Content-Security-Policy blocks, formulas that KaTeX cannot typeset,
  duplicate ids, links to pages, files or anchors that do not exist, and pages wider than the phone.

To run the page checks locally:

```bash
npm ci
npx playwright install chromium
npm run check
```

`CHROMIUM_PATH=/path/to/chromium npm run check` uses a Chromium that is already installed.

Every Monday, `.github/workflows/links.yml` asks every link to another site whether it still answers
(`npm run links`, `scripts/check-links.mjs`). If a link is broken (404, 410, a name that does not resolve,
an expired certificate), the open issue labelled `links` lists it, and the issue is closed when all links
work again. Sites that turn robots away (401, 403, 429) are listed but do not count as broken.

Every day, `.github/workflows/upstream.yml` compares the original course
([materiaalit/intro-to-ai](https://github.com/materiaalit/intro-to-ai), branch `gh-pages`) with the last
commit merged here, recorded in `.github/upstream-commit`. If the course has changed, the open issue
labelled `upstream` lists the new commits and the files they change. After merging them, write the newest
merged commit into `.github/upstream-commit`; the next run closes the issue.

Dependabot (`.github/dependabot.yml`) proposes weekly updates of the npm packages, the actions and the
Docker base images, each release only 14 days after it came out (most malicious releases are found and
pulled within days). The actions in the workflows are pinned to commits (with the version in a comment),
and every job gets only the permissions it needs. A fork runs scheduled workflows only after Actions are enabled in its
Actions tab, and opens issues only if Issues are on (Settings, General, Features).

## Rebuild the assets

The shared JavaScript, CSS and fonts in `javascripts/`, `stylesheets/` and `fonts/vendor/` are built from
`src/` and committed, because GitHub Pages does not run a build. After changing `src/` or the dependencies:

```bash
npm ci
npm run build
```

Then commit the changes in `javascripts/`, `stylesheets/` and `fonts/vendor/`.

