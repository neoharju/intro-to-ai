// Builds javascripts/main.js, the interactive figures of each week (javascripts/week1.js, ...), the
// formula typesetting (javascripts/math.js, and KaTeX itself in javascripts/katex.js), the practice quiz
// (javascripts/quiz.js), the colour theme and the header animation (javascripts/theme.js and hero.js, loaded
// in the <head>), stylesheets/main.css and fonts/vendor/* from src/.
// The outputs are committed: GitHub Pages serves this branch as-is, without a build step.
//
//   npm run build          one-off build
//   npm run build -- --watch
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as sass from 'sass';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

// Compiles SCSS with Dart Sass; esbuild then bundles the resulting CSS, including the plain
// CSS @imports of vendor stylesheets and the fonts they reference.
const sassPlugin = {
  name: 'sass',
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, args => {
      const result = sass.compile(args.path, {
        loadPaths: [path.join(root, 'node_modules')],
        quietDeps: true,
        // Bootstrap 5 is consumed through @import; it has no module-system (@use) entry point.
        silenceDeprecations: ['import'],
      });

      return {
        contents: result.css,
        loader: 'css',
        resolveDir: path.dirname(args.path),
        watchFiles: result.loadedUrls.filter(url => url.protocol === 'file:').map(url => fileURLToPath(url)),
      };
    });
  },
};

// KaTeX lists every font as woff2, woff and ttf. Every browser the site supports reads woff2, so the
// fallbacks are dropped and only the woff2 files are copied to fonts/vendor.
const katexFontsPlugin = {
  name: 'katex-fonts',
  setup(build) {
    build.onLoad({ filter: /[\\/]katex[\\/]dist[\\/]katex\.css$/ }, async args => {
      const css = await readFile(args.path, 'utf8');

      return {
        contents: css.replace(/,\s*url\([^)]+\.woff\) format\("woff"\),\s*url\([^)]+\.ttf\) format\("truetype"\)/g, ''),
        loader: 'css',
        resolveDir: path.dirname(args.path),
      };
    });
  },
};

// The scripts that every page runs before it is drawn (theme.js, hero.js) and those loaded on demand as plain
// scripts (katex.js, highlight.js) are single files; the stylesheets too.
const shared = {
  absWorkingDir: root,
  outdir: '.',
  bundle: true,
  minify: true,
  // Browsers from 2020-2021 onwards (esbuild cannot down-level destructuring for Safari < 15)
  target: ['chrome80', 'edge80', 'firefox78', 'safari15', 'ios15'],
  logLevel: 'info',
};

const classic = {
  ...shared,
  entryPoints: {
    'javascripts/katex': 'src/javascripts/katex.js',
    'javascripts/highlight': 'src/javascripts/highlight.js',
    'javascripts/theme': 'src/javascripts/theme.js',
    'javascripts/hero': 'src/javascripts/hero.js',
    'stylesheets/main': 'src/stylesheets/main.scss',
    'stylesheets/math': 'src/stylesheets/formulas.scss',
  },
  format: 'iife',
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  assetNames: 'fonts/vendor/[name]-[hash]',
  // The MOOC logo font is a static file that is already in /fonts/mooc.
  external: ['../fonts/mooc/*'],
  plugins: [sassPlugin, katexFontsPlugin],
};

// The scripts of the pages are ES modules (<script type="module">): what several of them use (the page life of
// page.js, the toolkit of the interactive figures, ...) is in javascripts/chunks/, loaded once however many
// weeks the reader opens.
const modules = {
  ...shared,
  entryPoints: {
    'javascripts/main': 'src/javascripts/main.js',
    'javascripts/math': 'src/javascripts/math.js',
    'javascripts/quiz': 'src/javascripts/quiz.js',
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(week => [`javascripts/week${week}`, `src/javascripts/weeks/week${week}.js`])),
  },
  format: 'esm',
  splitting: true,
  chunkNames: 'javascripts/chunks/[name]-[hash]',
};

await rm(path.join(root, 'fonts', 'vendor'), { recursive: true, force: true });
await rm(path.join(root, 'javascripts', 'chunks'), { recursive: true, force: true });

if (watch) {
  await Promise.all([classic, modules].map(async options => (await esbuild.context(options)).watch()));
} else {
  await Promise.all([classic, modules].map(options => esbuild.build(options)));
}
