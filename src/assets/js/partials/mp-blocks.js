/**
 * MARKETPLACE BLOCKS - client behaviour
 * ---------------------------------------------------------------------------
 * Two jobs, both progressive enhancements. Every block renders and is usable
 * with this file absent; it only adds affordances on top.
 *
 *   1. mpCountdown()   fills the deal-of-the-day digits
 *   2. mpTileArrows()  shows and wires the category rail arrows
 *
 * Everything is wrapped so a throw here can never take the storefront down.
 */

/* ---------------------------------------------------------------------------
 * DEAL COUNTDOWN
 *
 * The deadline is rendered server-side into data-mp-countdown as an ISO
 * string and counted down in the BROWSER. The server renders in the store's
 * timezone while the shopper may be in another, and a server-computed
 * countdown is additionally frozen at render time. Doing it client-side is
 * the only way it is correct for everyone.
 * ------------------------------------------------------------------------ */
function mpCountdown() {
  const nodes = document.querySelectorAll('[data-mp-countdown]');
  if (!nodes.length) return;

  const timers = [];

  nodes.forEach((node) => {
    const raw = node.getAttribute('data-mp-countdown');
    if (!raw) return;

    // Safari returns NaN for 'YYYY-MM-DD HH:MM' with a space separator, so the
    // template already emits a 'T'. Normalise again here in case a merchant
    // typed something else.
    const target = new Date(raw.indexOf('T') === -1 ? raw.replace(' ', 'T') : raw);
    if (isNaN(target.getTime())) return;   // bad date: leave the '--' fallback

    const out = {
      hours: node.querySelector('[data-unit="hours"]'),
      minutes: node.querySelector('[data-unit="minutes"]'),
      seconds: node.querySelector('[data-unit="seconds"]'),
    };

    const pad = (n) => (n < 10 ? '0' + n : String(n));

    const tick = () => {
      let diff = Math.floor((target.getTime() - Date.now()) / 1000);

      if (diff <= 0) {
        // Expired. Zero the digits and stop - do NOT hide the block, because
        // the merchant may still want the section visible until they remove it.
        if (out.hours) out.hours.textContent = '00';
        if (out.minutes) out.minutes.textContent = '00';
        if (out.seconds) out.seconds.textContent = '00';
        node.setAttribute('data-mp-expired', '1');
        return false;
      }

      // Hours deliberately NOT capped at 24 - a three-day deal should read
      // "72" rather than silently restarting at zero each midnight.
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;

      if (out.hours) out.hours.textContent = pad(h);
      if (out.minutes) out.minutes.textContent = pad(m);
      if (out.seconds) out.seconds.textContent = pad(s);
      return true;
    };

    if (tick()) {
      const id = window.setInterval(() => {
        if (!tick() || !document.body.contains(node)) window.clearInterval(id);
      }, 1000);
      timers.push(id);
    }
  });

  return timers;
}

/* ---------------------------------------------------------------------------
 * CATEGORY TILE ARROWS
 *
 * The rail is a scroll-snap list and is fully usable by swipe/scroll without
 * JS, so the arrows ship hidden and are only revealed when there is actually
 * something to scroll to. Revealing arrows that do nothing is worse than
 * having none.
 * ------------------------------------------------------------------------ */
function mpTileArrows() {
  document.querySelectorAll('.mp-tiles__wrap').forEach((wrap) => {
    const rail = wrap.querySelector('[data-mp-rail]');
    const prev = wrap.querySelector('.mp-tiles__arrow--prev');
    const next = wrap.querySelector('.mp-tiles__arrow--next');
    if (!rail || !prev || !next) return;

    const isRTL = document.dir === 'rtl' ||
                  document.documentElement.getAttribute('dir') === 'rtl';

    const sync = () => {
      // 2px tolerance: sub-pixel layout means scrollLeft rarely hits the
      // exact bound, which would leave an arrow enabled forever.
      const max = rail.scrollWidth - rail.clientWidth;
      const overflows = max > 2;
      // In RTL, scrollLeft is negative (or counts down) depending on engine,
      // so compare against the absolute distance travelled.
      const pos = Math.abs(rail.scrollLeft);

      prev.hidden = !overflows || pos <= 2;
      next.hidden = !overflows || pos >= max - 2;
    };

    const step = () => Math.max(rail.clientWidth * 0.8, 120);

    prev.addEventListener('click', () => {
      rail.scrollBy({ left: isRTL ? step() : -step(), behavior: 'smooth' });
    });
    next.addEventListener('click', () => {
      rail.scrollBy({ left: isRTL ? -step() : step(), behavior: 'smooth' });
    });

    rail.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });

    // Images load after markup, and each one changes scrollWidth. Re-check
    // once they have settled or the arrows are computed against a rail that
    // has not reached its final width.
    if (window.ResizeObserver) {
      new ResizeObserver(sync).observe(rail);
    } else {
      window.setTimeout(sync, 600);
    }
    sync();
  });
}

export default function initMarketplaceBlocks() {
  try {
    mpCountdown();
  } catch (e) {
    /* a broken countdown must not stop the arrows from working */
  }
  try {
    mpTileArrows();
  } catch (e) {
    /* silent: never take the storefront down for an enhancement */
  }
}
