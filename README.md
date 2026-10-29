# Introduction to Artificial Intelligence: personal copy

This is my personal copy of the course material for **Introduction to AI**, a course at the Department of
Computer Science, University of Helsinki. I am only modifying it for my own use. It is not the official
course.

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

Compared with the original `gh-pages` branch (commit `b9dedeb`):

- **Front-end dependencies:** jQuery, Bootstrap, highlight.js, Font Awesome and the Roboto font are upgraded
  and served from this repository instead of third-party CDNs. The shared JavaScript and CSS are built from
  `src/`.
- **Docker preview:** a `Dockerfile` and `compose.yaml` to preview the site locally.
- **Corrections in weeks 1–7:** factual errors and broken code examples are corrected.
- **Removed:** the original course's Google Analytics tracking, cookie banner and disabled login form,
  unused images, and the icon and font files the pages never load.

## Preview locally

GitHub Pages publishes this branch as it is. The pages are plain HTML (`index.html`, `week1/` to `week7/`).
To preview them:

```bash
docker compose up --build
```

The site is served at <http://localhost:4567>.

## Rebuild the assets

The shared JavaScript, CSS and fonts in `javascripts/`, `stylesheets/` and `fonts/vendor/` are built from
`src/` and committed, because GitHub Pages does not run a build. After changing `src/` or the dependencies:

```bash
npm ci
npm run build
```

Then commit the changes in `javascripts/`, `stylesheets/` and `fonts/vendor/`.

