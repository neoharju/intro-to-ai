// The colour theme menu in the navigation bar: match the system, light, dark or Tokyo Night. The
// choice itself is applied and remembered by theme.js (in the <head>); this only offers it. The menu is
// a Bootstrap dropdown, like the menu of the narrow navigation bar.
const OPTIONS = [
  { choice: 'system', label: 'Match the system', icon: 'fa-desktop' },
  { choice: 'light', label: 'Light', icon: 'fa-sun' },
  { choice: 'dark', label: 'Dark', icon: 'fa-moon' },
  { choice: 'tokyo-night', label: 'Tokyo Night', icon: 'fa-palette' },
];
const THEME_ICONS = { light: 'fa-sun', dark: 'fa-moon', 'tokyo-night': 'fa-palette' };

function icon(name) {
  const node = document.createElement('i');

  node.className = `fa ${name}`;
  node.setAttribute('aria-hidden', 'true');

  return node;
}

export default function mountThemeMenu() {
  const theme = window.IntroAI && window.IntroAI.theme;
  const buttons = document.querySelector('.navbar__buttons');

  if (!theme || !buttons) {
    return;
  }

  const toggle = document.createElement('button');

  toggle.type = 'button';
  toggle.className = 'btn btn-secondary theme-menu__toggle';
  toggle.setAttribute('data-bs-toggle', 'dropdown');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Colour theme');
  toggle.title = 'Colour theme';

  const menu = document.createElement('div');

  menu.className = 'dropdown-menu dropdown-menu-end theme-menu__list';

  const items = OPTIONS.map(option => {
    const item = document.createElement('button');

    item.type = 'button';
    item.className = 'dropdown-item theme-menu__item';
    item.append(icon(option.icon), document.createTextNode(option.label), icon('fa-check theme-menu__check'));
    item.addEventListener('click', () => theme.set(option.choice));
    menu.append(item);

    return { item, option };
  });

  const wrapper = document.createElement('div');

  wrapper.className = 'dropdown theme-menu';
  wrapper.append(toggle, menu);
  buttons.insertBefore(wrapper, document.getElementById('table-of-contents-toggle') || null);

  function update() {
    toggle.replaceChildren(icon(THEME_ICONS[theme.resolved()] || 'fa-sun'));
    items.forEach(({ item, option }) => item.setAttribute('aria-pressed', String(option.choice === theme.get())));
  }

  document.addEventListener('introai:themechange', update);
  update();
}
