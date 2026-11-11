// The colour theme menu in the navigation bar: match the system, light or dark. The
// choice itself is applied and remembered by theme.js (in the <head>); this only offers it. The menu is
// a dropdown (dropdown.js), like the menu of the narrow navigation bar.
const OPTIONS = [
  { choice: 'system', label: 'Match the system', icon: 'fa-desktop' },
  { choice: 'light', label: 'Light', icon: 'fa-sun' },
  { choice: 'dark', label: 'Dark', icon: 'fa-moon' },
];
export default function mountThemeMenu() {
  const theme = window.IntroAI && window.IntroAI.theme;
  const toggle = document.querySelector('.theme-menu__toggle');

  if (!theme || !toggle) {
    return;
  }

  // The menu is in the navigation bar of every page (src/partials/navbar.html); an item names its choice in
  // data-choice. The button shows the sun or the moon by CSS (_navbar.scss), from the theme in use.
  const items = [...document.querySelectorAll('.theme-menu .theme-menu__item[data-choice]')]
    .map(item => ({ item, option: OPTIONS.find(option => option.choice === item.dataset.choice) }))
    .filter(({ option }) => option);

  items.forEach(({ item, option }) => item.addEventListener('click', () => theme.set(option.choice)));

  function update() {
    items.forEach(({ item, option }) => item.setAttribute('aria-pressed', String(option.choice === theme.get())));
  }

  document.addEventListener('introai:themechange', update);
  update();
}
