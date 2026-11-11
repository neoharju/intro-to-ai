// Keeps the parts that every page shares in one place. The pages stay plain HTML that GitHub Pages serves
// as they are; this script rewrites, in place:
//
//   - the regions between <!-- shared:NAME --> and <!-- /shared:NAME --> (head, navbar, footer, end) from
//     src/partials/NAME.html, with the values of the page in src/site.json (title, scripts, simplified
//     English), the path back to the site root and the Content-Security-Policy of docker/nginx.conf;
//   - every <time data-date="KEY">, in the pages and in src/simple/weekN.txt, from src/schedule.json, so
//     that a date of the course is written once;
//   - the list <ul class="page-hero__meta"> in the header of a week: the reading time, the number of
//     exercises, counted from the page, and how many of them are done (none here: progress.js fills in the
//     reader's number), so that they are there when the page is first drawn;
//   - the first view of the practice quiz (quiz/index.html: the decks of the weeks, as quiz.js shows them before
//     any question is answered), so that the page does not grow when quiz.js shows them;
//   - the list of exercises at the top of a week (<div id="exercise-list">), from the headings of its
//     exercises, so that the box does not grow when exercises.js fills it in (it then replaces the links with
//     ones to the anchors of the exercises, anchors.js);
//
// and it writes pages.json, which the router (src/javascripts/router.js) shows a page from at once while the
// page itself loads: for every page, its title, its header and the top of its material (everything before its
// first section heading: the lecture and deadline boxes, the list of exercises, the learning objectives).
//
//   npm run sync              rewrites the pages
//   npm run sync -- --check   only reports the pages that are out of date (for CI); exits with 1 if any
//
// To add a page: add it to src/site.json (and to "nav" for a link in the navigation bar), give it the four
// regions (copy them from a page that has them), and run npm run sync.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const REGIONS = ['head', 'navbar', 'footer', 'end'];

const read = file => readFile(path.join(root, file), 'utf8');
const site = JSON.parse(await read('src/site.json'));
const schedule = JSON.parse(await read('src/schedule.json'));
const quizWeeks = JSON.parse(await read('src/javascripts/quiz/questions.json'));
const partials = Object.fromEntries(await Promise.all(REGIONS.map(async name => [name, await read(`src/partials/${name}.html`)])));

// The Content-Security-Policy that docker/nginx.conf sends, for a <meta> in the head of every page: GitHub
// Pages cannot send headers. Browsers ignore frame-ancestors, report-uri and sandbox in a <meta> (and warn
// about them), so they are left out.
function metaPolicy(conf) {
  const header = conf.match(/add_header\s+Content-Security-Policy\s+"([^"]+)"/);

  if (!header) {
    throw new Error('docker/nginx.conf: no Content-Security-Policy header');
  }

  return header[1]
    .split(';')
    .map(directive => directive.trim())
    .filter(directive => directive && !/^(?:frame-ancestors|report-uri|sandbox)\b/.test(directive))
    .join('; ');
}

const policy = metaPolicy(await read('docker/nginx.conf'));

// The text font of every page (Inter, Latin, upright), preloaded in the <head> so that it is there when the
// page is first drawn: otherwise the text is drawn in a fallback font first and moves when Inter arrives.
// Its name has a hash of its content (scripts/build.mjs, which runs before this script in npm run build).
const textFont = (await readdir(path.join(root, 'fonts', 'vendor'))).find(file => /^inter-latin-wght-normal-\w+\.woff2$/.test(file));

if (!textFont) {
  throw new Error('fonts/vendor has no inter-latin-wght-normal-*.woff2: run node scripts/build.mjs first');
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// The path from a page back to the site root: '' for index.html, '../' for week3/index.html.
function rootOf(page) {
  return '../'.repeat(page.split('/').length - 1);
}

function navItems(page, prefix) {
  const here = page.replace(/index\.html$/, '');

  return site.nav.map(item => {
    const active = item.path === here;
    const href = active ? './' : `${prefix}${item.path}` || './';

    return [
      `          <li class="nav-item${active ? ' active' : ''}">`,
      `            <a href="${href}" class="nav-link"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`,
      '          </li>',
    ].join('\n');
  }).join('\n');
}

// The same links in the menu that replaces them on small screens.
function mobileNavItems(page, prefix) {
  const here = page.replace(/index\.html$/, '');

  return site.nav.map(item => {
    const active = item.path === here;
    const href = active ? './' : `${prefix}${item.path}` || './';

    return `              <a class="dropdown-item" href="${href}"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
  }).join('\n');
}

const CLASSIC_SCRIPTS = new Set(['katex.js', 'highlight.js']);

function render(name, page, config) {
  const prefix = rootOf(page);
  const values = {
    siteTitle: escapeHtml(site.title),
    title: escapeHtml(config.title),
    root: prefix,
    csp: escapeHtml(policy),
    textFont: `fonts/vendor/${textFont}`,
    simpleMeta: config.simple ? '  <meta name="introai-simple" content="simple.json">' : '',
    // The formulas' stylesheet, on the pages that typeset formulas (math.js).
    mathStyles: config.scripts.includes('math.js') ? `  <link href="${prefix}stylesheets/math.css" rel="stylesheet" />` : '',
    navItems: navItems(page, prefix),
    // The simplified-English switch, on the pages that have a simplified version.
    simpleHidden: config.simple ? '' : ' hidden',
    mobileNavItems: mobileNavItems(page, prefix),
    // The scripts of the page are ES modules (scripts/build.mjs), but for KaTeX and highlight.js, plain scripts
    // that run before them.
    scripts: config.scripts.map(script => (CLASSIC_SCRIPTS.has(script)
      ? `  <script src="${prefix}javascripts/${script}"></script>`
      : `  <script type="module" src="${prefix}javascripts/${script}"></script>`)).join('\n'),
  };
  // A line that holds only a placeholder that is empty for this page is left out.
  return partials[name]
    .split('\n')
    .filter(line => {
      const only = line.match(/^\{\{(\w+)\}\}$/);

      return !(only && values[only[1]] === '');
    })
    .join('\n')
    .replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (!(key in values)) {
        throw new Error(`src/partials/${name}.html: unknown placeholder ${match}`);
      }

      return values[key];
    });
}

// <time data-date="kaggle-close">…</time> from src/schedule.json.
function syncDates(text, file) {
  return text.replace(/<time\b[^>]*\bdata-date="([^"]+)"[^>]*>[^<]*<\/time>/g, (match, key) => {
    const entry = schedule[key];

    if (!entry) {
      throw new Error(`${file}: <time data-date="${key}"> is not in src/schedule.json`);
    }

    return `<time datetime="${entry.date}" data-date="${key}">${escapeHtml(entry.text)}</time>`;
  });
}

function readingTime(words) {
  const minutes = Math.max(1, Math.round(words / 200));

  if (minutes < 60) {
    return `${minutes} min read`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} h ${rest} min read` : `${hours} h read`;
}

// The reading time (about 200 words a minute for technical text), the exercises and the interactive figures
// of the material, from its HTML: what textContent and querySelectorAll would give in the browser.
function syncMeta(text, page) {
  return text.replace(/^([ \t]*)<ul class="page-hero__meta"([^>]*)>[\s\S]*?<\/ul>/m, (match, indent, attributes) => {
    const open = text.indexOf('id="material"');
    const start = text.indexOf('>', open) + 1;
    const end = text.indexOf('<!-- shared:footer -->');

    if (open < 0 || end < start) {
      throw new Error(`${page}: the header has a page-hero__meta list but the page has no #material before its footer`);
    }

    // Without HTML comments: the pages keep some exercises commented out.
    const material = text.slice(start, end).replace(/<!--[\s\S]*?-->/g, ' ');
    const words = material
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&(?:nbsp|#160);/g, ' ')
      .replace(/&[#\w]+;/g, 'x')
      .split(/\s+/)
      .filter(Boolean).length;
    const exercises = (material.match(/<div class="exercise"[\s>]/g) || []).length;
    const items = [
      ['fa-regular fa-clock', readingTime(words)],
      ...(exercises ? [['fa fa-pencil', `${exercises} exercise${exercises === 1 ? '' : 's'}`]] : []),
      ...(exercises ? [['fa fa-check', `0 of ${exercises} done`, 'page-hero__progress']] : []),
    ];

    return [
      `${indent}<ul class="page-hero__meta"${attributes}>`,
      ...items.map(([icon, label, className]) => `${indent}  <li${className ? ` class="${className}"` : ''}><i class="${icon}" aria-hidden="true"></i>${label}</li>`),
      `${indent}</ul>`,
    ].join('\n');
  });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '\u2013', mdash: '\u2014', middot: '\u00b7' };

// The text of some HTML, as textContent would give it.
function textOf(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
      if (name[0] === '#') {
        return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
      }

      return ENTITIES[name.toLowerCase()] ?? match;
    });
}

// The HTML without its comments (the pages keep some exercises commented out), with the comments replaced by
// spaces of the same length, so that positions in it are positions in the HTML.
function blankComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, comment => ' '.repeat(comment.length));
}

// The material of a page: where its content starts and ends in the HTML, its classes and data- attributes.
function materialOf(text, page) {
  const open = blankComments(text).match(/<div class="([^"]*)" id="material"([^>]*)>/);
  const footer = text.indexOf('<!-- shared:footer -->');

  if (!open || footer < 0) {
    throw new Error(`${page}: no <div class="..." id="material"> before the footer`);
  }

  // The material closes just before the content wrapper: the last two </div> before the footer.
  const end = text.lastIndexOf('</div>', text.lastIndexOf('</div>', footer) - 1);
  const data = Object.fromEntries([...open[2].matchAll(/\s(data-[\w-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value || '']));

  return { start: open.index + open[0].length, end, className: open[1], data };
}

// "Towers of Hanoi (1p)" -> { name: "Towers of Hanoi", points: "1p" }, as exercises.js splits a heading.
const POINTS = /\s*\(((?:up to )?\d+(?:\.\d+)?p|no points)\)\s*$/;

function splitPoints(heading) {
  const name = heading.replace(/\s+/g, ' ').trim();
  const match = name.match(POINTS);

  return match ? { name: name.slice(0, match.index), points: match[1] } : { name, points: undefined };
}

// The list of exercises, as exercises.js renders it, but with links to the list itself (the anchors of the
// exercises are only made in the browser, anchors.js) and without data-bs-toggle (Bootstrap would fold the
// list). The links are replaced as soon as exercises.js runs.
function syncExerciseList(text, page) {
  return text.replace(/^([ \t]*)(<div class="exercise-list__content" id="exercise-list">)[\s\S]*?<\/div>/m, (match, indent, open) => {
    const { start, end } = materialOf(text, page);
    const material = blankComments(text.slice(start, end));
    const exercises = [...material.matchAll(/<div class="exercise"[\s>][\s\S]*?<h1 class="exercise__heading">([\s\S]*?)<\/h1>/g)]
      .map(([, heading]) => splitPoints(textOf(heading)));

    if (!exercises.length) {
      return `${indent}${open}</div>`;
    }

    const links = exercises.map(({ name, points }, index) => {
      const label = `Exercise ${index + 1}: ${name}${points ? ` (${points})` : ''}`;

      return `${indent}  <a class="exercise-list__link" href="#exercises" aria-label="${escapeHtml(label)}">`
        + `<span class="exercise-list__number">${index + 1}</span><span class="exercise-list__name">${escapeHtml(name)}</span>`
        + `${points ? `<span class="points-pill">${escapeHtml(points)}</span>` : ''}</a>`;
    });

    return [`${indent}${open}`, ...links, `${indent}</div>`].join('\n');
  });
}

// What pages.json holds for a page: its title, its header and the top of its material.
function shellOf(text, page, config) {
  const hero = text.match(/<header class="(page-hero[^"]*)">\s*<div class="container">([\s\S]*?)<\/div>\s*<\/header>/);

  if (!hero) {
    throw new Error(`${page}: no <header class="page-hero"> with a <div class="container">`);
  }

  const { start, end, className, data } = materialOf(text, page);
  // The first section heading of the material, outside comments; without one, the whole material.
  const heading = blankComments(text.slice(start, end)).search(/<h[1-6]\b[^>]*\bclass="(?:[^"]*\s)?material-heading[\s"]/);
  const intro = text.slice(start, heading < 0 ? end : start + heading);

  if ((intro.match(/<div\b/g) || []).length !== (intro.match(/<\/div>/g) || []).length) {
    throw new Error(`${page}: the first section heading is not directly in #material`);
  }

  // Indentation and comments are of no use in the browser.
  const compact = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*/g, '\n').trim();

  return {
    title: `${site.title} | ${config.title}`,
    hero: { className: hero[1], html: compact(hero[2]) },
    material: { className, data },
    intro: compact(intro),
  };
}

// The first view of the quiz, as showHome() in src/javascripts/quiz.js writes it with no results yet (the
// numbers of answers are filled in by quiz.js; the layout stays). Without JavaScript it is not shown (_quiz.scss).
const MIX_LENGTH = Number(((await read('src/javascripts/quiz.js')).match(/const MIX_LENGTH = (\d+);/) || [])[1]);

if (!MIX_LENGTH) {
  throw new Error('src/javascripts/quiz.js: no const MIX_LENGTH');
}

function quizHome() {
  const total = quizWeeks.reduce((sum, week) => sum + week.questions.length, 0);
  const span = (className, text) => `<span class="${className}">${escapeHtml(text)}</span>`;
  const decks = quizWeeks.map(week => `<li id="week-${week.week}"><button type="button" class="quiz-deck">`
    + span('quiz-deck__week', `Week ${week.week}`) + span('quiz-deck__title', week.title) + span('quiz-deck__tagline', week.tagline)
    + '<span class="quiz-meter" aria-hidden="true"><span style="width:0%"></span></span>'
    + span('quiz-deck__score', `${week.questions.length} questions`) + '</button></li>');

  decks.push('<li><button type="button" class="quiz-deck quiz-deck--mix">'
    + '<span class="quiz-deck__week"><i class="fa fa-random" aria-hidden="true"></i> All weeks</span>'
    + span('quiz-deck__title', 'Mixed bag') + span('quiz-deck__tagline', `${MIX_LENGTH} random questions from the whole course.`)
    + span('quiz-deck__score', `${total} questions in the pool`) + '</button></li>');

  return `<div class="quiz-home"><p class="quiz-home__total"><b>0 of ${total}</b> questions answered correctly so far</p>`
    + `<ul class="quiz-decks">${decks.join('')}</ul></div>`;
}

function syncQuiz(text) {
  return text.replace(/^([ \t]*)(<div class="quiz" id="quiz">)[\s\S]*?(<noscript>[\s\S]*?<\/noscript>)[\s\S]*?\n\1<\/div>/m,
    (match, indent, open, noscript) => `${indent}${open}\n${indent}  ${noscript}\n${indent}  ${quizHome()}\n${indent}</div>`);
}

function syncPage(text, page, config) {
  let out = text;

  REGIONS.forEach(name => {
    const start = `<!-- shared:${name} -->`;
    const end = `<!-- /shared:${name} -->`;
    const i = out.indexOf(start);
    const j = out.indexOf(end);

    if (i < 0 || j < i) {
      throw new Error(`${page}: the region <!-- shared:${name} --> is missing`);
    }

    out = `${out.slice(0, i + start.length)}\n${render(name, page, config).replace(/\n$/, '')}\n${out.slice(out.lastIndexOf('\n', j) + 1)}`;
  });

  return syncQuiz(syncExerciseList(syncMeta(syncDates(out, page), page), page));
}

const changed = [];

async function update(file, transform) {
  // A file that is not there yet (pages.json, the first time) is written.
  const before = await read(file).catch(error => {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  });
  const after = transform(before);

  if (after !== before) {
    changed.push(file);

    if (!check) {
      await writeFile(path.join(root, file), after);
    }
  }
}

const shells = {};

for (const [page, config] of Object.entries(site.pages)) {
  await update(page, text => {
    const synced = syncPage(text, page, config);

    shells[page.replace(/index\.html$/, '')] = shellOf(synced, page, config);

    return synced;
  });
}

await update('pages.json', () => `${JSON.stringify({ pages: shells })}\n`);

for (const name of (await readdir(path.join(root, 'src', 'simple'))).filter(file => file.endsWith('.txt'))) {
  await update(`src/simple/${name}`, text => syncDates(text, `src/simple/${name}`));
}

// The service worker (src/sw.js): its version is a hash of everything it may store, so that any change to the
// site makes a new one; its shell is the files that every page needs (javascripts/chunks has hashed names).
async function filesUnder(dir) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(entry => (entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`])));

  return nested.flat();
}

const chunks = (await filesUnder('javascripts/chunks')).sort();
const shell = ['stylesheets/main.css', 'stylesheets/math.css', 'javascripts/theme.js', 'javascripts/hero.js', 'javascripts/main.js',
  'javascripts/math.js', ...chunks, `fonts/vendor/${textFont}`, 'img/favicon.svg', 'pages.json'];
const versioned = [
  ...Object.keys(site.pages), 'pages.json',
  ...(await Promise.all(['javascripts', 'stylesheets', 'fonts', 'img'].map(filesUnder))).flat(),
  ...Object.keys(site.pages).map(page => page.replace(/index\.html$/, 'simple.json')),
].filter((file, index, all) => all.indexOf(file) === index).sort();
const hash = createHash('sha256');

for (const file of versioned) {
  const content = await readFile(path.join(root, file)).catch(() => null);

  if (content) {
    hash.update(`${file}\0`).update(content).update('\0');
  }
}

const worker = `// Written by scripts/sync.mjs from src/sw.js: edit that file.\n${await read('src/sw.js')}`
  .replace("'__VERSION__'", `'${hash.digest('hex').slice(0, 16)}'`)
  .replace('__SHELL__', JSON.stringify(shell));

await update('sw.js', () => worker);

if (check) {
  if (changed.length) {
    console.error(`Out of date (run npm run sync): ${changed.join(', ')}`);
    process.exit(1);
  }

  console.log('The shared parts and the dates of all pages are up to date.');
} else {
  console.log(changed.length ? `Updated ${changed.join(', ')}` : 'Nothing to update.');
}
