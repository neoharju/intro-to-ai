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

- **Front-end dependencies:** Bootstrap (its CSS only), highlight.js and Font Awesome are upgraded and, like the
  Inter font and KaTeX (for the formulas), served from this repository instead of third-party CDNs; jQuery and
  Bootstrap's JavaScript are gone (see "Performance"). The shared JavaScript and CSS are built from `src/`.
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
for students whose first language is not English. The "Simplified English" switch in the navigation bar
(before the search, on the pages that have a simplified version) swaps it in and back, block by block (`src/javascripts/simplify.js`); formulas, code, figures and
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
load `javascripts/katex.js` (KaTeX) and `javascripts/math.js`, which typesets them, and `stylesheets/math.css`.
Pseudocode listings use `<pre class="sh_pseudo"><code>…</code></pre>`, highlighted by the grammar in
`src/javascripts/pseudocode.js`; code listings are highlighted by `javascripts/highlight.js`.

A displayed formula that is wider than the column scrolls sideways. So does a drawn diagram (`<svg class="dg">`)
on a narrow screen: `src/javascripts/ui.js` keeps it at least 3/4 of its viewBox width in pixels, so that its
labels stay about 10 px on a phone instead of shrinking to 5 px. Both fade out on the side where there is more;
`src/javascripts/scroll-fades.js` measures all of them in one batch, after the browser's own layout.

### Formulas typeset in advance

`npm run prerender` (`scripts/prerender.mjs`) builds `_site/`, the files that GitHub Pages publishes from this
branch, with every formula of the pages and of the simplified English typeset by KaTeX in advance, with the
settings of `math.js` (`src/javascripts/math-options.js`). A page then shows its formulas at once: at a 4x
slower CPU, as on a mid-range phone, `math.js` takes 12-200 ms instead of 200-770 ms per week. The typeset
formulas are the same as those typeset in the browser, and the gzipped pages grow by 0-22 KB. The code listings
are highlighted in advance too, with the same highlight.js settings (`src/javascripts/highlight-languages.js`),
and the published pages no longer load `katex.js` (77 kB compressed) and `highlight.js` (12 kB); only the
practice quiz, which typesets its questions in the browser, keeps KaTeX.

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

## Moving between pages

The site changes page without leaving the document (`src/javascripts/router.js`). The navigation bar, the
header with its animated network, the footer and the table-of-contents drawer stay; only the page changes:

1. **At once**, from `pages.json` (written by `npm run sync`, about 5 kB compressed, fetched when the browser
   is idle after the first page): the title and the line under it cross-fade in the header (0.28 s) while
   the network goes on drawing behind them, and the top of the material (the lecture and deadline boxes,
   the list of exercises, the learning objectives) replaces the old material.
2. **As soon as the page has arrived** (usually already in memory, see below): the rest of the material is put
   in below what the reader sees, in slices whose size adapts to the speed of the device, so that the
   network in the header keeps moving; the page's scripts that are not loaded yet are loaded (each only once
   per visit), and the page is set up a step a frame.

The header has the same height on every page (`--hero-height` in `_hero.scss`, the height of the front
page's header at that width), and its text starts at the same place, so a new title replaces the old one
where it stands. Back and forward return to the remembered scroll position of each page, also after a
reload. Every page stays an ordinary HTML document: an address opened directly, or anything unexpected (a
failed request, a page that is not one of the site's), is an ordinary page load, and in browsers with
cross-document view transitions such a load still morphs the header (`_hero.scss`, `hero.js`).

Because pages are no longer unloaded, everything a page sets up for its own material (listeners on `window`
or `document`, observers, animation loops) ends with it: `src/javascripts/page.js` gives each page view an
`AbortSignal` (`pageSignal()`, `onPageEnd()`), and the scripts that only some pages load (`math.js`,
`quiz.js`, `weekN.js`) register how they set up a page with `definePageScript`, so that the router can set
up a page again without loading them twice. `npm run check` visits every page in turn this way.

A page of the site is fetched in advance when the reader points at a link to it for 65 ms, touches it or
moves to it with the keyboard (`src/javascripts/prefetch.js`); the router keeps it in memory, and lets the
browser fetch the scripts that page will need. Nothing is fetched in advance when the reader has asked the
browser to save data.

KaTeX itself is in `javascripts/katex.js`, apart from `math.js`: the site that the Pages workflow publishes
has its formulas typeset in advance, so `scripts/prerender.mjs` removes `katex.js` (260 kB) from every page
but the quiz. Where formulas are typeset in the browser, the router typesets each slice before it goes in.

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
exercises in its list of exercises and counts them under its title ("2 of 5 done"), and the front page shows a table of
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

`npm run sync` also writes the line under the title of each week (`<ul class="page-hero__meta">`): the
reading time (about 200 words a minute) and the number of exercises, counted from the page, without the
parts that are commented out, and how many of them are done (written as none; `progress.js` fills in the
reader's number). They are in the page itself, so they are there when it is first drawn.

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
- `npm run budgets`: every script and stylesheet is within its size budget (see "Performance");
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

## Performance

What a reader downloads and what the browser does, and how to keep it small:

- **No jQuery, no Bootstrap JavaScript.** The exercises fold open with `src/javascripts/collapse.js` (a closed
  exercise is `hidden="until-found"`, so the browser's search in the page finds text in it and opens it), and
  the menus of the navigation bar are `src/javascripts/dropdown.js`; both keep Bootstrap's classes, so its CSS
  still draws them. `main.js` went from 196 kB to 53 kB (69 to 18 kB compressed).
- **ES modules.** The scripts of the pages are modules (`<script type="module">`); what several of them use
  (`page.js`, the figure toolkit `viz/lib.js`, …) is in `javascripts/chunks/` and is loaded once however many
  weeks the reader opens. `katex.js` and `highlight.js` are plain scripts that the pages with formulas or code
  load before the modules (and that the published site does without).
- **Stylesheets.** `stylesheets/main.css` has only the Bootstrap parts and utility classes that the pages use
  (`src/stylesheets/_utilities.scss`: add a utility class there to use it); KaTeX's styles are in
  `stylesheets/math.css`, linked only by the pages with formulas.
- **No layout shifts.** The controls of the navigation bar, the list of exercises of a week and the decks of
  the quiz are written into the pages (`npm run sync`) instead of being added by scripts; Inter is preloaded,
  and until it arrives the text is drawn in "Inter Fallback", Arial scaled to Inter's metrics
  (`src/stylesheets/_fallback-font.scss`). Pictures below the first screen load when they come near, with
  their space kept (`aspect-ratio`); diagrams are lossless WebP and photos come in a 1200 px version.
- **Figures and header.** The decision regions of the k-NN figure are computed without allocations into one
  `ImageData` (12 times faster). The network in the header moves by time, not by frame (it ran twice as fast
  on 120 Hz screens), and is drawn 30 times a second.
- **Service worker** (`src/sw.js`, written to `sw.js` by `npm run sync`). GitHub Pages lets files be cached
  for 10 minutes only; the service worker keeps them, so that a returning reader loads nothing that has not
  changed, and the pages they have opened can be read offline. Its version is a hash of the site's content, so
  any change publishes a new one, which replaces all stored files; the open page then changes page with
  ordinary page loads. To take it away, publish a `sw.js` that deletes the caches
  (`caches.keys()` → `caches.delete`) and calls `self.registration.unregister()`.
- **Budgets.** `npm run budgets` (`scripts/check-budgets.mjs`, part of the Check workflow) fails when a script
  or stylesheet grows over its compressed size limit, or what a week loads on a first visit goes over 75 kB.
  Raise a limit there, on purpose, when the growth is worth it.

Tried and left out, measured: KaTeX's MathML-only output (four times smaller formulas, but browsers draw
aligned equations and limits badly without a math font) and `content-visibility: auto` on the material (30-40 %
less layout, but positions remembered for back, forward and reload no longer land on the same text).

## Rebuild the assets

The shared JavaScript, CSS and fonts in `javascripts/`, `stylesheets/` and `fonts/vendor/` are built from
`src/` and committed, because GitHub Pages does not run a build. After changing `src/` or the dependencies:

```bash
npm ci
npm run build
```

Then commit the changes in `javascripts/`, `stylesheets/` and `fonts/vendor/`.

