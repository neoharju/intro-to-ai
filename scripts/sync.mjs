// Keeps the parts that every page shares in one place. The pages stay plain HTML that GitHub Pages serves
// as they are; this script rewrites, in place:
//
//   - the regions between <!-- shared:NAME --> and <!-- /shared:NAME --> (head, navbar, footer, end) from
//     src/partials/NAME.html, with the values of the page in src/site.json (title, scripts, simplified
//     English), the path back to the site root and the Content-Security-Policy of docker/nginx.conf;
//   - every <time data-date="KEY">, in the pages and in src/simple/weekN.txt, from src/schedule.json, so
//     that a date of the course is written once.
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

  return syncDates(out, page);
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
