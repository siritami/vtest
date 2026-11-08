// Auto-hiding page chrome: the header (logo + account controls) and the nav bar slide away
// while scrolling down and come back on the first upward scroll — the same reveal behaviour
// the floating "stop continuous scroll" button uses.
//
// Both bars are `position: sticky` (see layout.css), so they normally sit on top of the
// content. Hiding them translates the pair up by their combined height rather than
// display:none, which keeps the scroll position stable (no reflow of the page above).
//
// The offset is published as --header-h (the nav's sticky top) and --chrome-h (the pair's
// total height) so anything that has to clear the bars — scroll-padding-top, the floating stop
// button — positions against the real height.

import { closeHeaderMenus } from './headerMenus.js';

// Same threshold as ui/infiniteScroll.js: a jittery trackpad or a rubber-banding momentum
// scroll must not flicker the bars.
const REVEAL_THRESHOLD = 8;

// Ignore bounces at the very top of the page — iOS/macOS rubber-band reports a negative or
// tiny scrollY that would otherwise read as "scrolled up" and show the bars mid-gesture.
const TOP_SLACK = 4;

let header = null;
let nav = null;
let lastY = 0;
let hidden = false;
let sizeObserver = null;
// Timestamp until which scroll deltas are ignored (see onScroll).
let suppressUntil = 0;
// False while the page is still settling after opening on a fragment; the first genuine user
// scroll re-arms it (see the gesture listeners in wireChromeAutoHide).
let armed = true;

// Programmatic scrolls fire `scroll` synchronously-ish; ignoring deltas for a moment after the
// jump keeps a permalink landing from hiding the bars.
function suppressBriefly() {
  suppressUntil = performance.now() + 250;
  setHidden(false);
  lastY = window.scrollY;
}

// Measured whenever either bar changes size (boot, resize, font swap, async render).
function measure() {
  if (!header) return;
  // getBoundingClientRect, not offsetHeight: offsetHeight rounds to an integer, so a 44.5px
  // header reported 45 and the nav parked half a pixel low — leaving a 0.5px seam where the
  // page background showed through between two bars that share the same colour. The exact
  // fractional height is kept (trimmed to 3dp to avoid float noise like 44.399999px); a
  // fractional `top` is perfectly valid and keeps the two edges flush.
  const exact = (el) => Math.round(el.getBoundingClientRect().height * 1000) / 1000;
  const headerH = exact(header);
  const navH = nav ? exact(nav) : 0;
  const root = document.documentElement.style;
  // --header-h parks the sticky nav flush against the header; --chrome-h is the pair's total
  // height (what the hide transform and scroll-padding-top position against).
  root.setProperty('--header-h', `${headerH}px`);
  root.setProperty('--chrome-h', `${Math.round((headerH + navH) * 1000) / 1000}px`);
}

function setHidden(next) {
  if (!header || hidden === next) return;
  hidden = next;
  // A dropdown menu anchored inside the header would stay floating over the content once its
  // bar is gone, so close it as the bar leaves.
  if (next) closeHeaderMenus();
  document.documentElement.classList.toggle('chrome-hidden', next);
  for (const bar of [header, nav]) bar?.setAttribute('aria-hidden', next ? 'true' : 'false');
}

function onScroll() {
  if (!header) return;
  const y = window.scrollY;
  // Not armed yet: the page just opened on a fragment and is still positioning itself.
  if (!armed) {
    lastY = y;
    return;
  }
  // Never hide the bars at the top of the page: there is nothing above to scroll back to, and
  // the logo is the way home.
  if (y <= TOP_SLACK) {
    setHidden(false);
    lastY = y;
    return;
  }
  // A programmatic jump (anchor, post permalink, returning from a form) produces one big
  // downward delta. Treating that as "the reader scrolled down" would hide the bars the
  // instant the page jumped, which is the opposite of helpful — so re-seed the reference
  // point instead of reacting to it.
  if (suppressUntil > performance.now()) {
    lastY = y;
    return;
  }
  const delta = y - lastY;
  if (Math.abs(delta) < REVEAL_THRESHOLD) return;
  setHidden(delta > 0);
  lastY = y;
}

export function wireChromeAutoHide() {
  header = document.querySelector('.p-header');
  nav = document.querySelector('.p-nav');
  if (!header) return;

  measure();
  lastY = window.scrollY;
  setHidden(false);
  // A deep link (or a browser restore) can open the page already scrolled past the bars; the
  // first scroll event would then read as "scrolled down" and hide them immediately. While the
  // page is opening on a fragment, ignore deltas until the reader actually scrolls, so they
  // see the navigation they arrived for.
  if (location.hash) armed = false;
  else suppressBriefly();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });

  // The nav renders its shortcuts and the header renders the account block asynchronously, and
  // a font swap changes both heights — re-measure instead of trusting the boot value.
  if (typeof ResizeObserver === 'function') {
    sizeObserver = new ResizeObserver(measure);
    sizeObserver.observe(header);
    if (nav) sizeObserver.observe(nav);
  }

  // A jump to an anchor (or a restored scroll position) can land mid-page; keep the bars
  // visible so the reader does not start with no navigation.
    window.addEventListener('hashchange', suppressBriefly);

    // A real gesture re-arms direction tracking after a fragment-load settling period. Wheel and
    // touchmove are the gestures that scroll; a bare `scroll` also covers keyboard paging.
    const arm = () => {
      armed = true;
      lastY = window.scrollY;
      window.removeEventListener('wheel', arm);
      window.removeEventListener('touchmove', arm);
    };
    window.addEventListener('wheel', arm, { passive: true, once: true });
    window.addEventListener('touchmove', arm, { passive: true, once: true });
}

  // Programmatic scrolls the app performs itself (post permalink focus, inline-edit reveal,
  // pager arm) should not be mistaken for the reader scrolling down. Views call this right
  // before their own scrollIntoView().
  export function suppressChromeAutoHide() {
    suppressBriefly();
  }

export function teardownChromeAutoHide() {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', measure);
  sizeObserver?.disconnect();
  sizeObserver = null;
  armed = true;
  setHidden(false);
  header = null;
  nav = null;
}