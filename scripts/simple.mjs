// The simplified English version of the weeks (see src/javascripts/simplify.js).
//
//   npm run simple                       compiles src/simple/weekN.txt into weekN/simple.json
//   npm run simple -- --extract week3    prints the blocks of a page with their fingerprints, to write from
//   npm run simple -- --check            compares every simplified block with its original on the page
//
// A file src/simple/weekN.txt holds one entry per block that has a simplified version:
//
//   == 1a2b3c4d
//   The simplified HTML of the block. It can take several lines.
//
// "1a2b3c4d" is the fingerprint of the block's original text (from --extract). Lines starting with
// "#" are comments. --extract and --check load the pages in a browser and need Playwright
// (npm install --no-save playwright); compiling needs nothing.
import { createServer } from 'node:http';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = path.join(root, 'src', 'simple');

export function parse(text, file = 'input') {
  const entries = {};
  let current = null;

  text.split('\n').forEach((line, index) => {
    const head = line.match(/^== ([0-9a-f]{8})\s*$/);

    if (head) {
      if (head[1] in entries) {
        throw new Error(`${file}:${index + 1}: ${head[1]} appears twice`);
      }

      current = head[1];
      entries[current] = [];
    } else if (line.startsWith('#') && current === null) {
      // A comment before the first entry.
    } else if (current !== null) {
      entries[current].push(line);
    } else if (line.trim()) {
      throw new Error(`${file}:${index + 1}: text before the first "== fingerprint" line`);
    }
  });

  return Object.fromEntries(Object.entries(entries).map(([fp, lines]) => [fp, lines.join('\n').replace(/\s+/g, ' ').trim()]));
}

async function weekFiles() {
  return (await readdir(sources)).filter(name => /^week\d+\.txt$/.test(name)).sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
}

async function compile() {
  for (const name of await weekFiles()) {
    const week = name.replace('.txt', '');
    const blocks = parse(await readFile(path.join(sources, name), 'utf8'), name);
    const file = path.join(root, week, 'simple.json');

    await writeFile(file, `${JSON.stringify({ version: 1, blocks }, null, 1)}\n`);
    console.log(`${week}/simple.json: ${Object.keys(blocks).length} blocks`);
  }
}

// A static server for the site, and a browser that loads a page without typesetting its formulas.
async function withPages(run) {
  const require = createRequire(import.meta.url);
  let playwright;

  try {
    playwright = require('playwright');
  } catch (error) {
    throw new Error('--extract and --check need Playwright: npm install --no-save playwright');
  }

  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
  const server = createServer(async (request, response) => {
    let file = path.join(root, decodeURIComponent(new URL(request.url, 'http://x').pathname));

    if (file.endsWith('/')) {
      file += 'index.html';
    }

    try {
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(await readFile(file));
    } catch (error) {
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  const browser = await playwright.chromium.launch();

  try {
    await run(async week => {
      const page = await browser.newPage();

      await page.route('**/javascripts/math.js', route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/${week}/`, { waitUntil: 'load' });

      const result = await page.evaluate(() => window.IntroAI.simple.extract());

      await page.close();

      return result;
    });
  } finally {
    await browser.close();
    server.close();
  }
}

async function extract(week) {
  await withPages(async load => {
    const { blocks, missed } = await load(week);
    const seen = new Set();

    blocks.forEach(block => {
      if (!seen.has(block.fp)) {
        seen.add(block.fp);
        console.log(`== ${block.fp}  <${block.tag}>\n${block.html}\n`);
      }
    });

    if (missed.length) {
      console.log(`# Text in no block (not simplified):\n${missed.map(text => `#   ${text}`).join('\n')}`);
    }
  });
}

const count = (text, pattern) => (text.match(pattern) || []).length;
const plain = html => html.replace(/<span class="math">.*?<\/span>/g, ' ').replace(/<[^>]+>/g, ' ');
const numbers = html => new Set(plain(html).match(/\d+(?:[.,]\d+)?/g) || []);

// A simplified block keeps the formulas, links, code and numbers of its original.
export function compare(original, simple) {
  const problems = [];

  for (const [what, pattern] of [['formulas', /class="math/g], ['links', /<a\s/g], ['code', /<code/g]]) {
    if (count(original, pattern) !== count(simple, pattern)) {
      problems.push(`${what}: ${count(original, pattern)} in the original, ${count(simple, pattern)} simplified`);
    }
  }

  const hrefs = html => [...html.matchAll(/href="([^"]*)"/g)].map(match => match[1]).sort().join(' ');

  if (hrefs(original) !== hrefs(simple)) {
    problems.push('the links point elsewhere');
  }

  const kept = numbers(simple);
  const lost = [...numbers(original)].filter(number => !kept.has(number));

  if (lost.length) {
    problems.push(`numbers missing: ${lost.join(', ')}`);
  }

  return problems;
}

async function check() {
  let problems = 0;

  await withPages(async load => {
    for (const name of await weekFiles()) {
      const week = name.replace('.txt', '');
      const entries = parse(await readFile(path.join(sources, name), 'utf8'), name);
      const { blocks } = await load(week);
      const originals = Object.fromEntries(blocks.map(block => [block.fp, block.html]));
      const stale = Object.keys(entries).filter(fp => !(fp in originals));

      stale.forEach(fp => {
        problems++;
        console.log(`${week} ${fp}: no block with this original text (did the original change?)`);
      });

      Object.entries(entries).filter(([fp]) => fp in originals).forEach(([fp, simple]) => {
        compare(originals[fp], simple).forEach(problem => {
          problems++;
          console.log(`${week} ${fp}: ${problem}`);
        });
      });

      const total = new Set(blocks.map(block => block.fp)).size;
      const done = Object.keys(entries).filter(fp => fp in originals).length;

      console.log(`${week}: ${done} of ${total} blocks have a simplified version`);
    }
  });

  if (problems) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args[0] === '--extract') {
    await extract(args[1]);
  } else if (args[0] === '--check') {
    await check();
  } else {
    await compile();
  }
}
