// Performance budgets: the compressed size of every script and stylesheet that the pages load, and of what a
// week needs on its first visit, must stay under the limits below (about 20 % above their sizes when the
// limits were set). A change that goes over them fails the Check workflow, so that the site does not grow
// slower a little at a time; raise a limit on purpose, in this file, when the growth is worth it.
//
// With --root=_site (the site the Pages workflow publishes, npm run prerender), it also checks that its pages
// do not load KaTeX or highlight.js: their formulas and code are typeset and highlighted in advance.
//
//   npm run budgets
//   npm run budgets -- --root=_site
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootArgument = process.argv.find(arg => arg.startsWith('--root='));
const root = rootArgument ? path.resolve(rootArgument.slice('--root='.length)) : repo;
const site = JSON.parse(await readFile(path.join(repo, 'src', 'site.json'), 'utf8'));
const KB = 1024;

// gzip, level 9: what GitHub Pages sends is about this size.
const BUDGETS = {
  'javascripts/theme.js': 1 * KB,
  // Raised from 2.5 kB: the intro of the first page of a visit and the wave of a change of page (1 kB more).
  'javascripts/hero.js': 3 * KB,
  'javascripts/main.js': 22 * KB,
  // Raised from 1 kB: it keeps displayed formulas inside the column (math-fit.js, breakable text).
  'javascripts/math.js': 2 * KB,
  'javascripts/quiz.js': 30 * KB,
  'javascripts/highlight.js': 15 * KB,
  'javascripts/katex.js': 90 * KB,
  'stylesheets/main.css': 33 * KB,
  'stylesheets/math.css': 5 * KB,
  'pages.json': 7 * KB,
  'sw.js': 3.5 * KB,
};
const WEEK = 13 * KB;
const CHUNKS = 12 * KB;
// Everything a week loads the first time (theme.js, hero.js, the stylesheets and the modules with their
// chunks; not KaTeX and highlight.js, which the published site does without). Raised from 75 kB: the header's
// rolling text and the intro of the first page of a visit (hero-text.js, hero.js, _hero.scss: 4.6 kB).
const FIRST_VISIT = 80 * KB;

const problems = [];
const sizes = new Map();

async function gzipped(file) {
  if (!sizes.has(file)) {
    sizes.set(file, gzipSync(await readFile(path.join(root, file)), { level: 9 }).length);
  }

  return sizes.get(file);
}

function over(file, size, limit) {
  if (size > limit) {
    problems.push(`${file}: ${(size / KB).toFixed(1)} kB, over its budget of ${(limit / KB).toFixed(1)} kB`);
  }
}

for (const [file, limit] of Object.entries(BUDGETS)) {
  over(file, await gzipped(file), limit);
}

const chunks = (await readdir(path.join(root, 'javascripts', 'chunks'))).map(name => `javascripts/chunks/${name}`);
let chunkTotal = 0;

for (const chunk of chunks) {
  chunkTotal += await gzipped(chunk);
}

over('javascripts/chunks/*', chunkTotal, CHUNKS);

for (const week of [1, 2, 3, 4, 5, 6, 7]) {
  over(`javascripts/week${week}.js`, await gzipped(`javascripts/week${week}.js`), WEEK);
}

for (const [page, config] of Object.entries(site.pages).filter(([page]) => /^week\d/.test(page))) {
  const files = ['javascripts/theme.js', 'javascripts/hero.js', 'stylesheets/main.css', 'stylesheets/math.css', ...chunks,
    ...config.scripts.filter(script => !['katex.js', 'highlight.js'].includes(script)).map(script => `javascripts/${script}`)];
  let total = 0;

  for (const file of files) {
    total += await gzipped(file);
  }

  over(`${page} (scripts and styles of a first visit)`, total, FIRST_VISIT);
}

// The published site: formulas and listings done in advance.
if (rootArgument) {
  for (const [page, config] of Object.entries(site.pages)) {
    const html = await readFile(path.join(root, page), 'utf8');

    if (/javascripts\/highlight\.js/.test(html)) {
      problems.push(`${page} loads highlight.js, but its listings are highlighted in advance`);
    }

    if (!config.scripts.includes('quiz.js') && /javascripts\/katex\.js/.test(html)) {
      problems.push(`${page} loads katex.js, but its formulas are typeset in advance`);
    }
  }
}

if (problems.length) {
  problems.forEach(problem => console.error(`✗ ${problem}`));
  process.exit(1);
}

console.log(`Every file is within its budget (main.js ${(sizes.get('javascripts/main.js') / KB).toFixed(1)} kB, main.css `
  + `${(sizes.get('stylesheets/main.css') / KB).toFixed(1)} kB, chunks ${(chunkTotal / KB).toFixed(1)} kB, compressed).`);
