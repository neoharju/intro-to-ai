// Loads every page of the site in Chromium and fails if a reader would meet a problem:
//
//   - an error in the console, an uncaught exception, a missing file or a request that the
//     Content-Security-Policy blocked;
//   - a formula that KaTeX could not typeset (shown in red) or that was not typeset at all;
//   - two elements with the same id, or a link to a page, a file or an anchor (#id, ../week4/#id) that is
//     not there;
//   - a page wider than a phone (390 px), with the simplified English off and on, and a displayed formula that
//     needs scrolling sideways, on a phone or on a desktop (src/javascripts/math-fit.js keeps them in the column);
//   - a page that the router (src/javascripts/router.js) does not show as a page load would: every page is
//     visited in turn from the first one without leaving the document, and must then have its title, its
//     header, its figures and formulas, no duplicate ids and no errors, under the same navigation bar and
//     header animation.
//
// The pages are served as GitHub Pages serves them: as files, without the headers of docker/nginx.conf, so
// the policy that applies is the <meta> in each page.
//
//   npx playwright install chromium     once, for the browser
//   npm run check
//   npm run check -- --root=_site       the site with the formulas typeset in advance (npm run prerender)
//
// CHROMIUM_PATH=/path/to/chromium npm run check runs another Chromium instead.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(await readFile(path.join(repo, 'src', 'site.json'), 'utf8'));
// The directory that is served: the repository, or with --root=DIR another copy of the site.
const rootArgument = process.argv.find(arg => arg.startsWith('--root='));
const root = rootArgument ? path.resolve(rootArgument.slice('--root='.length)) : repo;
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
};

// The file that a path of the site names (a directory: its index.html), or null.
async function fileOf(urlPath) {
  let file;

  try {
    file = path.join(root, decodeURIComponent(urlPath));
  } catch (error) {
    return null;
  }

  if (file !== root && !file.startsWith(root + path.sep)) {
    return null;
  }

  try {
    if ((await stat(file)).isDirectory()) {
      file = path.join(file, 'index.html');
    }

    return (await stat(file)).isFile() ? file : null;
  } catch (error) {
    return null;
  }
}

const server = http.createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const file = await fileOf(pathname);

  if (!file) {
    response.writeHead(404).end();
  } else if (!pathname.endsWith('/') && file.endsWith(`${path.sep}index.html`) && !pathname.endsWith('index.html')) {
    // GitHub Pages redirects /week1 to /week1/, so that the relative links of the page work.
    response.writeHead(301, { Location: `${pathname}/` }).end();
  } else {
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  }
});

await new Promise(resolve => {
  server.listen(0, '127.0.0.1', resolve);
});

const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// The problems of a page, each with the views in which it was seen.
function report() {
  const problems = new Map();

  return {
    problems,
    add(text, view) {
      problems.set(text, (problems.get(text) || new Set()).add(view));
    },
  };
}

// Opens a page and collects the errors that it logs.
async function open(page, { viewport, simple = false }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const problems = [];

  await context.addInitScript(on => {
    try {
      window.localStorage.setItem('introai-simple', on ? 'on' : 'off');
    } catch (error) {
      // No storage: the page starts in its default mode.
    }
  }, simple);

  const tab = await context.newPage();

  tab.on('pageerror', error => problems.push(`uncaught exception: ${error.message}`));
  tab.on('console', message => {
    if (message.type() === 'error') {
      // For a file that did not load, the location is the file.
      const { url } = message.location();

      problems.push(`console error: ${message.text()}${url ? ` (${url.replace(base, '')})` : ''}`);
    }
  });

  await tab.goto(base + page, { waitUntil: 'networkidle' });

  if (simple) {
    await tab.waitForFunction(() => document.documentElement.hasAttribute('data-simple'), null, { timeout: 10000 })
      .catch(() => problems.push('the simplified English did not turn on'));
  }

  // The interactive figures further down are built when the browser is idle.
  await tab.waitForFunction(() => !document.querySelector('figure.viz[data-viz]:not(.is-ready)'), null, { timeout: 10000 })
    .catch(() => problems.push('an interactive figure was not built'));
  await tab.waitForTimeout(300);

  return { context, tab, problems };
}

// What the page shows: formulas, ids and links (absolute URLs).
function inspect(tab) {
  return tab.evaluate(() => {
    const count = new Map();

    document.querySelectorAll('[id]').forEach(node => count.set(node.id, (count.get(node.id) || 0) + 1));

    return {
      katex: [...document.querySelectorAll('.katex-error')].map(node => node.getAttribute('title') || node.textContent),
      untypeset: [...document.querySelectorAll('.math')]
        .filter(node => !node.querySelector('.katex, .katex-error'))
        .map(node => node.textContent.trim().slice(0, 60)),
      duplicates: [...count].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n}×)`),
      ids: [...count.keys()],
      links: [...document.querySelectorAll('a[href]')].map(a => a.href),
    };
  });
}

// The page scrolls sideways at phone width: the elements that stick out (and that no scroller contains).
// Displayed formulas that are wider than their column (what is shown of them: the environment or its rows), with
// every exercise, solution and <details> open, as a reader opens them. Last of the checks of a page: it opens them.
async function wideFormulas(tab) {
  await tab.evaluate(() => {
    document.querySelectorAll('.exercise__toggle[aria-expanded="false"], .solution__toggle[aria-expanded="false"]')
      .forEach(toggle => toggle.click());
    document.querySelectorAll('details:not([open]) > summary').forEach(summary => summary.click());
  });
  // The formulas that came into view are fitted after the next layout (math-fit.js).
  await tab.waitForTimeout(800);

  return tab.evaluate(() => [...document.querySelectorAll('div.math, p.math')]
    .filter(math => math.offsetParent !== null)
    .filter(math => (math.classList.contains('is-narrow')
      ? [...math.querySelectorAll(':scope > .katex-rows > .katex-display')]
      : [...math.querySelectorAll(':scope > .katex-display')]).some(box => box.scrollWidth > box.clientWidth + 1))
    .map(math => `a formula needs scrolling sideways: ${(math.getAttribute('data-tex') || '').trim().slice(0, 60)}`));
}

function overflow(tab) {
  return tab.evaluate(() => {
    const width = document.documentElement.clientWidth;

    if (document.documentElement.scrollWidth <= width + 1) {
      return [];
    }

    const contained = node => {
      for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX !== 'visible') {
          return parent.getBoundingClientRect().right <= width + 1;
        }
      }

      return false;
    };

    // The outermost elements that stick out; of a drawing, the drawing itself.
    const wide = [...document.body.querySelectorAll('*')]
      .filter(node => !(node instanceof SVGElement && node.ownerSVGElement))
      .filter(node => node.getBoundingClientRect().right > width + 1 && !contained(node))
      .filter((node, i, all) => !all.includes(node.parentElement));

    return [`the page is ${document.documentElement.scrollWidth} px wide at ${width} px`, ...wide.slice(0, 5).map(node => {
      const name = node.tagName.toLowerCase() + (node.id ? `#${node.id}` : '');
      const classes = typeof node.className === 'string' && node.className ? `.${node.className.trim().split(/\s+/).join('.')}` : '';

      return `  sticks out: ${name}${classes} “${(node.textContent || '').trim().slice(0, 50)}”`;
    })];
  });
}

const results = new Map();
const failures = [];

for (const [page, config] of Object.entries(site.pages)) {
  const { problems, add } = report();
  const desktop = await open(page, { viewport: DESKTOP });
  const seen = await inspect(desktop.tab);

  desktop.problems.forEach(problem => add(problem, 'desktop'));
  seen.katex.forEach(error => add(`formula error: ${error}`, 'desktop'));
  seen.untypeset.forEach(tex => add(`formula not typeset: ${tex}`, 'desktop'));
  seen.duplicates.forEach(id => add(`duplicate id: ${id}`, 'desktop'));
  (await wideFormulas(desktop.tab)).forEach(line => add(line, 'desktop'));
  await desktop.context.close();

  const links = new Set(seen.links);

  for (const simple of config.simple ? [false, true] : [false]) {
    const phone = await open(page, { viewport: PHONE, simple });
    const view = simple ? 'phone, simplified English' : 'phone';

    phone.problems.forEach(problem => add(problem, view));
    (await overflow(phone.tab)).forEach(line => add(line, view));

    if (simple) {
      const simpleSeen = await inspect(phone.tab);

      simpleSeen.katex.forEach(error => add(`formula error: ${error}`, view));
      simpleSeen.untypeset.forEach(tex => add(`formula not typeset: ${tex}`, view));
      simpleSeen.links.forEach(link => links.add(link));
    }

    (await wideFormulas(phone.tab)).forEach(line => add(line, view));
    // With everything open, nothing may reach past the edge of the phone either.
    (await overflow(phone.tab)).forEach(line => add(`with every exercise open: ${line}`, view));
    await phone.context.close();
  }

  results.set(page, { ids: new Set(seen.ids), links, problems, add });
}

// The links, now that the ids of every page are known. An address of the old form
// (#section-12-attention-layer, #exercise-3-towers-of-hanoi) still works: anchors.js redirects it.
function hasAnchor(ids, id) {
  const old = id.match(/^(section|exercise)-\d+-(.+?)(?:-root)?$/);

  return ids.has(id) || Boolean(old && ids.has(old[1] === 'section' ? old[2] : `exercise-${old[2]}`));
}

for (const [page, result] of results) {
  for (const link of result.links) {
    const url = new URL(link);

    if (url.origin !== new URL(base).origin) {
      continue;
    }

    let id = '';

    try {
      id = decodeURIComponent(url.hash.slice(1));
    } catch (error) {
      result.add(`malformed link: ${link}`, 'desktop');
      continue;
    }

    const file = await fileOf(url.pathname);
    const target = file && path.relative(root, file).split(path.sep).join('/');
    const where = link.slice(base.length);

    if (!file) {
      result.add(`link to a missing file: ${where}`, 'desktop');
    } else if (id && results.has(target) && !hasAnchor(results.get(target).ids, id)) {
      result.add(`link to a missing anchor: ${where}`, 'desktop');
    }
  }

  console.log(`${result.problems.size ? '✗' : '✓'} ${page}`);

  // A problem seen only on a phone says so.
  result.problems.forEach((views, problem) => {
    console.log(`    ${problem}${views.has('desktop') ? '' : ` (${[...views].join('; ')})`}`);
  });

  if (result.problems.size) {
    failures.push(page);
  }
}

// Changing page without leaving the document, through every page and back to the first.
{
  const order = Object.keys(site.pages);
  const { context, tab, problems } = await open(order[0], { viewport: DESKTOP });
  let loads = 0;

  tab.on('load', () => loads++);
  await tab.evaluate(() => {
    document.querySelector('.page-hero__canvas').dataset.check = 'kept';
    document.querySelector('.navbar').dataset.check = 'kept';
  });

  for (const page of [...order.slice(1), order[0]]) {
    const before = problems.length;
    const address = base + page.replace(/index\.html$/, '');

    await tab.evaluate(url => window.IntroAI.router.go(url), address);
    await tab.waitForFunction(url => window.location.href === url
      && !document.querySelector('#material[data-loading], .page-hero > .is-leaving, figure.viz[data-viz]:not(.is-ready)'), address, { timeout: 15000 })
      .catch(() => problems.push('the page was not shown, or a figure was not built'));

    const seen = await inspect(tab);
    const state = await tab.evaluate(() => ({
      title: document.title,
      kept: document.querySelector('.page-hero__canvas')?.dataset.check === 'kept' && document.querySelector('.navbar').dataset.check === 'kept',
      headers: document.querySelectorAll('.page-hero > .container').length,
    }));

    if (!state.title.endsWith(`| ${site.pages[page].title}`)) {
      problems.push(`the title is "${state.title}"`);
    }

    if (!state.kept || state.headers !== 1) {
      problems.push('the navigation bar or the header animation was replaced');
    }

    seen.untypeset.forEach(tex => problems.push(`formula not typeset: ${tex}`));
    seen.duplicates.forEach(id => problems.push(`duplicate id: ${id}`));

    if (loads) {
      problems.push('the browser loaded the page');
    }

    console.log(`${problems.length > before ? '✗' : '✓'} changing page to ${page}`);
    problems.slice(before).forEach(problem => console.log(`    ${problem}`));

    if (problems.length > before) {
      failures.push(`changing page to ${page}`);
    }
  }

  await context.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\nProblems: ${failures.join(', ')}.`);
  process.exit(1);
}

console.log(`\nAll ${results.size} pages load without problems.`);
