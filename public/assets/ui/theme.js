// Applies the "Giao diện" preferences from Cài đặt to the document.
//
// Three independent axes:
//   theme — light / dark / auto. `auto` follows prefers-color-scheme and keeps following it,
//           so switching the OS theme while the tab is open updates the page.
//   font  — which family the reading surface uses. Only the downloadable options pull in
//           assets/css/fonts.css, and only once chosen, so the default costs no font bytes.
//   size  — two percentages (post prose vs. everything else) published as --post-scale and
//           --ui-scale; see applyFontScale below.
//
// All three are expressed as attributes (and two custom properties) on <html> so the CSS can
// own all the actual values:
//   <html data-theme="light|dark" data-theme-mode="auto|light|dark"
//         data-font="system|roboto|be-vietnam-pro|be-vietnam"
//         data-post-size="100" data-ui-size="100">

import { getTheme, getFont, getFontScale, FONT_STACKS } from '../lib/settings.js';

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

// Font size follows the same attribute-plus-custom-property shape. The numbers are published
// as unitless multipliers in --post-scale / --ui-scale, both 1 by default, and the layout
// stylesheets multiply their px sizes by them. The inline script in index.html sets the same
// two properties before the first paint, so a non-default size never flashes the stock one.
function applyFontScale({ postSize, uiSize }) {
  const root = document.documentElement;
  root.dataset.postSize = String(postSize);
  root.dataset.uiSize = String(uiSize);
  root.style.setProperty('--post-scale', String(postSize / 100));
  root.style.setProperty('--ui-scale', String(uiSize / 100));
}

export function applyAppearance() {
  applyTheme(getTheme());
  applyFont(getFont());
  applyFontScale(getFontScale());
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
