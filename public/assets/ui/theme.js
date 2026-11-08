// Applies the "Giao diện" preferences from Cài đặt to the document.
//
// Two independent axes:
//   theme — light / dark / auto. `auto` follows prefers-color-scheme and keeps following it,
//           so switching the OS theme while the tab is open updates the page.
//   font  — which family the reading surface uses. Only the downloadable options pull in
//           assets/css/fonts.css, and only once chosen, so the default costs no font bytes.
//
// Both are expressed as attributes on <html> so the CSS can own all the actual values:
//   <html data-theme="light|dark" data-theme-mode="auto|light|dark" data-font="system|roboto|be-vietnam-pro">

import { getTheme, getFont, FONT_STACKS } from '../lib/settings.js';

const FONT_HREF = '/assets/css/fonts.css';

const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolvedTheme(mode) {
  if (mode === 'dark' || mode === 'light') return mode;
  return media && media.matches ? 'dark' : 'light';
}

function applyTheme(mode) {
  const root = document.documentElement;
  const resolved = resolvedTheme(mode);
  root.dataset.themeMode = mode;
  root.dataset.theme = resolved;
  // Tells the browser which UI to paint for form controls, scrollbars and the canvas behind
  // the page, so native widgets match instead of flashing white.
  root.style.colorScheme = resolved;
}

// The font stylesheet is a single <link> that is added on first use and never removed: once
// the user has tried a vendored font, keeping the link avoids a re-download if they switch
// back and forth. The family is still switched through --font so `system` uses no download.
function ensureFontStylesheet() {
  if (document.getElementById('font-faces')) return;
  const link = document.createElement('link');
  link.id = 'font-faces';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.append(link);
}

function applyFont(font) {
  const root = document.documentElement;
  const stack = FONT_STACKS[font] ?? null;
  root.dataset.font = font;
  if (stack) {
    ensureFontStylesheet();
    root.style.setProperty('--font', stack);
  } else {
    root.style.removeProperty('--font');
  }
}

export function applyAppearance() {
  applyTheme(getTheme());
  applyFont(getFont());
}

// Called once at boot. The media listener is permanent: it only ever reads the current
// setting, so it is correct for every mode.
export function wireTheme() {
  applyAppearance();
  if (!media) return;
  const onChange = () => {
    const mode = getTheme();
    if (mode === 'auto') applyTheme(mode);
  };
  if (media.addEventListener) media.addEventListener('change', onChange);
  else if (media.addListener) media.addListener(onChange);
  // Settings changed in another tab reach us through the same event saveSettings fires.
  window.addEventListener('voz:settings', applyAppearance);
}
