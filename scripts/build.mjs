// Builds javascripts/main.js, the interactive figures of each week (javascripts/week1.js, ...), the
// formula typesetting (javascripts/math.js), the practice quiz (javascripts/quiz.js), the colour theme
// (javascripts/theme.js, loaded in the <head>), stylesheets/main.css and fonts/vendor/* from src/.
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

const options = {
  absWorkingDir: root,
  entryPoints: {
    'javascripts/main': 'src/javascripts/main.js',
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(week => [`javascripts/week${week}`, `src/javascripts/weeks/week${week}.js`])),
    'javascripts/math': 'src/javascripts/math.js',
    'javascripts/quiz': 'src/javascripts/quiz.js',
    'javascripts/theme': 'src/javascripts/theme.js',
    'stylesheets/main': 'src/stylesheets/main.scss',
  },
  outdir: '.',
  bundle: true,
  minify: true,
  format: 'iife',
  // Browsers from 2020-2021 onwards (esbuild cannot down-level destructuring for Safari < 15)
  target: ['chrome80', 'edge80', 'firefox78', 'safari15', 'ios15'],
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  assetNames: 'fonts/vendor/[name]-[hash]',
  // The MOOC logo font is a static file that is already in /fonts/mooc.
  external: ['../fonts/mooc/*'],
  plugins: [sassPlugin, katexFontsPlugin],
  logLevel: 'info',
};

await rm(path.join(root, 'fonts', 'vendor'), { recursive: true, force: true });

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
