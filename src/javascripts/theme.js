// Applies the reader's colour theme before the page is drawn: this script is loaded in the <head> of
// every page, so a page never flashes light before turning dark. The choice is "system", "light" or
// "dark"; "system" follows the light or dark mode of the device. It is remembered in
// localStorage when the browser allows it. The menu in the navigation bar (theme-menu.js) changes it
// through window.IntroAI.theme, and every change is announced with an "introai:themechange" event,
// which the interactive figures use to redraw themselves.
const KEY = 'introai-theme';
const CHOICES = ['system', 'light', 'dark'];
const root = document.documentElement;
const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let choice = 'system';

try {
  const saved = window.localStorage.getItem(KEY);

  if (CHOICES.includes(saved)) {
    choice = saved;
  } else if (saved === 'tokyo-night') {
    // The Tokyo Night theme was removed; its readers get the dark theme.
    choice = 'dark';
  }
} catch (error) {
  // Blocked storage: follow the system.
}

function resolved() {
  if (choice !== 'system') {
    return choice;
  }

  return media && media.matches ? 'dark' : 'light';
}

function apply() {
  const theme = resolved();

  root.setAttribute('data-theme', theme);
  // Bootstrap's components follow data-bs-theme.
  root.setAttribute('data-bs-theme', theme === 'light' ? 'light' : 'dark');
  document.dispatchEvent(new CustomEvent('introai:themechange', { detail: { theme, choice } }));
}

function set(next) {
  if (!CHOICES.includes(next)) {
    return;
  }

  choice = next;

  try {
    window.localStorage.setItem(KEY, next);
  } catch (error) {
    // The choice lasts until the page is left.
  }

  apply();
}

if (media) {
  const follow = () => {
    if (choice === 'system') {
      apply();
    }
  };

  if (media.addEventListener) {
    media.addEventListener('change', follow);
  } else {
    media.addListener(follow);
  }
}

// Zen mode (zen.js) and the text size (font-size-menu.js) are restored here too, so that a page never
// shows its navigation bar for a moment in zen mode, nor jumps from the normal to a larger text size.
try {
  if (window.localStorage.getItem('introai-zen') === 'on') {
    root.setAttribute('data-zen', 'on');
  }

  const size = window.localStorage.getItem('introai-font-size');

  if (size === 'large' || size === 'xlarge') {
    root.setAttribute('data-font-size', size);
  }
} catch (error) {
  // Blocked storage: nothing to restore.
}

window.IntroAI = Object.assign(window.IntroAI || {}, {
  theme: { choices: CHOICES, get: () => choice, resolved, set },
});

apply();
