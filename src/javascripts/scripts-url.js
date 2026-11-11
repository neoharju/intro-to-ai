// The folder of the site's scripts (javascripts/), wherever the bundler has put the code that asks: in a page's
// script (javascripts/main.js) or in a chunk that several of them share (javascripts/chunks/…).
export const SCRIPTS = new URL(/\/chunks\/[^/]*$/.test(new URL(import.meta.url).pathname) ? '../' : './', import.meta.url);
