// Checks the links of the pages to other sites (npm run links; every week in .github/workflows/links.yml).
// Every address is asked once: HEAD first, then GET if the answer is not a success (some servers do not
// answer HEAD), with a timeout and one retry, and at most two requests at a time to one site.
//
//   broken    404, 410 and the other client errors; a name that does not resolve; a refused connection;
//             an expired certificate or one for another name
//   unknown   401, 403, 429 and 999 (the site turns robots away; a reader's browser usually gets the
//             page), server errors and timeouts that the retry did not fix, other network errors
//
// Exits with 1 if a link is broken. --report=FILE also writes the broken and unknown links as Markdown
// (the text of the issue that the workflow opens), only if a link is broken.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportFile = (process.argv.find(arg => arg.startsWith('--report=')) || '').slice('--report='.length);
const site = JSON.parse(await readFile(path.join(root, 'src', 'site.json'), 'utf8'));

const TIMEOUT = 20000;
const PER_SITE = 2;
const WORKERS = 8;
const ROBOTS = new Set([401, 403, 429, 999]);
const BROKEN_ERRORS = new Set(['ENOTFOUND', 'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID']);
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en',
};

const sleep = ms => new Promise(resolve => {
  setTimeout(resolve, ms);
});

// The pages and the simplified English: address (without #fragment) → the files that link to it.
async function collect() {
  const files = [
    ...Object.keys(site.pages),
    ...(await readdir(path.join(root, 'src', 'simple'))).filter(name => name.endsWith('.txt')).map(name => `src/simple/${name}`),
  ];
  const links = new Map();

  for (const file of files) {
    const text = await readFile(path.join(root, file), 'utf8');

    for (const [, href] of text.matchAll(/\bhref="(https?:\/\/[^"]+)"/g)) {
      const url = href.replace(/&amp;/g, '&').replace(/#.*$/, '');
      const where = file.replace(/\/index\.html$/, '').replace(/^src\/simple\/(week\d)\.txt$/, '$1 (simplified)');

      links.set(url, (links.get(url) || new Set()).add(where));
    }
  }

  return links;
}

async function request(url, method) {
  const response = await fetch(url, { method, headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT) });

  // Only the status is needed.
  await response.body?.cancel().catch(() => {});

  return response.status;
}

async function check(url) {
  let result;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) {
      await sleep(5000);
    }

    try {
      let status = await request(url, 'HEAD');

      if (status >= 400) {
        status = await request(url, 'GET');
      }

      if (status < 400) {
        return { kind: 'ok', detail: String(status) };
      }

      if (ROBOTS.has(status)) {
        return { kind: 'unknown', detail: String(status) };
      }

      result = { kind: status < 500 ? 'broken' : 'unknown', detail: String(status) };

      if (status < 500) {
        return result;
      }
    } catch (error) {
      const code = error.name === 'TimeoutError' ? 'TimeoutError' : error.cause?.code || error.cause?.name || error.name;

      result = {
        kind: BROKEN_ERRORS.has(code) ? 'broken' : 'unknown',
        detail: code === 'TimeoutError' ? `no answer in ${TIMEOUT / 1000} s` : code,
      };
    }
  }

  return result;
}

const links = await collect();
const queue = [...links.keys()];
const busy = new Map();
const results = new Map();

async function worker() {
  while (queue.length) {
    const i = queue.findIndex(url => (busy.get(new URL(url).host) || 0) < PER_SITE);

    if (i < 0) {
      await sleep(100);
      continue;
    }

    const [url] = queue.splice(i, 1);
    const { host } = new URL(url);

    busy.set(host, (busy.get(host) || 0) + 1);

    try {
      results.set(url, await check(url));
    } finally {
      busy.set(host, busy.get(host) - 1);
    }
  }
}

await Promise.all(Array.from({ length: WORKERS }, worker));

const of = kind => [...results].filter(([, result]) => result.kind === kind).sort(([a], [b]) => a.localeCompare(b));
const broken = of('broken');
const unknown = of('unknown');
const sites = new Set([...links.keys()].map(url => new URL(url).host)).size;

console.log(`${links.size} links to ${sites} sites: ${links.size - broken.length - unknown.length} work, ${broken.length} broken, ${unknown.length} unknown.`);

[['Broken', broken], ['Unknown', unknown]].forEach(([title, list]) => {
  if (list.length) {
    console.log(`\n${title}:`);
    list.forEach(([url, result]) => console.log(`  ${result.detail.padEnd(16)} ${url}  (${[...links.get(url)].join(', ')})`));
  }
});

if (reportFile && broken.length) {
  const run = process.env.GITHUB_RUN_ID
    ? ` ([run](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}))`
    : '';
  const table = list => [
    '| Link | Answer | In |',
    '| --- | --- | --- |',
    ...list.map(([url, result]) => `| <${url}> | ${result.detail} | ${[...links.get(url)].join(', ')} |`),
  ].join('\n');

  await writeFile(reportFile, [
    `The link check of ${new Date().toISOString().slice(0, 10)}${run} found ${broken.length} broken ${broken.length === 1 ? 'link' : 'links'} `
      + `among ${links.size} links to ${sites} sites. This issue is updated by every check and closed when all links work.`,
    '',
    '### Broken',
    '',
    table(broken),
    ...(unknown.length ? [
      '',
      '### Unknown',
      '',
      'These sites turned the check away or did not answer. A browser usually gets the page; check by hand if a link stays here.',
      '',
      table(unknown),
    ] : []),
    '',
  ].join('\n'));
}

if (broken.length) {
  process.exitCode = 1;
}
