// Keeps the parts that every page shares in one place. The pages stay plain HTML that GitHub Pages serves
// as they are; this script rewrites, in place:
//
//   - the regions between <!-- shared:NAME --> and <!-- /shared:NAME --> (head, navbar, footer, end) from
//     src/partials/NAME.html, with the values of the page in src/site.json (title, scripts, simplified
//     English), the path back to the site root and the Content-Security-Policy of docker/nginx.conf;
//   - every <time data-date="KEY">, in the pages and in src/simple/weekN.txt, from src/schedule.json, so
//     that a date of the course is written once;
//   - the list <ul class="page-hero__meta"> in the header of a week: the reading time and the numbers of
//     exercises and interactive figures, counted from the page, so that they are there when the page is
//     first drawn.
//
//   npm run sync              rewrites the pages
//   npm run sync -- --check   only reports the pages that are out of date (for CI); exits with 1 if any
//
// To add a page: add it to src/site.json (and to "nav" for a link in the navigation bar), give it the four
// regions (copy them from a page that has them), and run npm run sync.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const REGIONS = ['head', 'navbar', 'footer', 'end'];

const read = file => readFile(path.join(root, file), 'utf8');
const site = JSON.parse(await read('src/site.json'));
const schedule = JSON.parse(await read('src/schedule.json'));
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

function render(name, page, config) {
  const prefix = rootOf(page);
  const values = {
    siteTitle: escapeHtml(site.title),
    title: escapeHtml(config.title),
    root: prefix,
    csp: escapeHtml(policy),
    simpleMeta: config.simple ? '  <meta name="introai-simple" content="simple.json">' : '',
    navItems: navItems(page, prefix),
    scripts: config.scripts.map(script => `  <script src="${prefix}javascripts/${script}"></script>`).join('\n'),
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
    const figures = (material.match(/\sclass="viz(?:\s[^"]*)?"/g) || []).length;
    const items = [
      ['fa-regular fa-clock', readingTime(words)],
      ...(exercises ? [['fa fa-pencil', `${exercises} exercise${exercises === 1 ? '' : 's'}`]] : []),
      ...(figures ? [['fa fa-play-circle', `${figures} interactive figure${figures === 1 ? '' : 's'}`]] : []),
    ];

    return [
      `${indent}<ul class="page-hero__meta"${attributes}>`,
      ...items.map(([icon, label]) => `${indent}  <li><i class="${icon}" aria-hidden="true"></i>${label}</li>`),
      `${indent}</ul>`,
    ].join('\n');
  });
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

  return syncMeta(syncDates(out, page), page);
}

const changed = [];

async function update(file, transform) {
  const before = await read(file);
  const after = transform(before);

  if (after !== before) {
    changed.push(file);

    if (!check) {
      await writeFile(path.join(root, file), after);
    }
  }
}

for (const [page, config] of Object.entries(site.pages)) {
  await update(page, text => syncPage(text, page, config));
}

for (const name of (await readdir(path.join(root, 'src', 'simple'))).filter(file => file.endsWith('.txt'))) {
  await update(`src/simple/${name}`, text => syncDates(text, `src/simple/${name}`));
}

if (check) {
  if (changed.length) {
    console.error(`Out of date (run npm run sync): ${changed.join(', ')}`);
    process.exit(1);
  }

  console.log('The shared parts and the dates of all pages are up to date.');
} else {
  console.log(changed.length ? `Updated ${changed.join(', ')}` : 'Nothing to update.');
}
