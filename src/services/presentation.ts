export interface PresentationController {
  readonly blocked: boolean;
  check(): void;
  dispose(): void;
}

/** Device presentation is transient UI state, never part of a player save. */
export function initPresentation(onBlocked: () => void): PresentationController {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) throw new Error('Mount the application before initializing device presentation.');
  const gate = document.createElement('div');
  gate.className = 'orientation-gate';
  gate.hidden = true;
  gate.innerHTML =
    '<section class="orientation-card" role="dialog" aria-modal="true" aria-labelledby="orientationTitle" tabindex="-1"><div class="orientation-icon" aria-hidden="true">▱ ↻</div><h2 id="orientationTitle">Turn your device sideways</h2><p>Infernal Defense plays in landscape. Your battle will wait for you.</p></section>';
  document.body.append(gate);
  const card = gate.firstElementChild as HTMLElement;
  const events = new AbortController();
  const portrait = window.matchMedia('(orientation: portrait)');
  let blocked = false;
  let focusBefore: HTMLElement | null = null;
  let locking = false;

  const check = () => {
    const next = navigator.maxTouchPoints > 0 && portrait.matches;
    if (next === blocked) return;
    blocked = next;
    gate.hidden = !blocked;
    // Native modal dialogs occupy the top layer, above the portrait fallback.
    if (blocked) app.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
    app.inert = blocked;
    if (blocked) {
      focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onBlocked();
      card.focus();
    } else if (focusBefore?.isConnected) {
      const resume = document.querySelector<HTMLElement>('#pauseOverlay:not([hidden]) #resumeBattle');
      (resume ?? focusBefore).focus();
    }
  };
  const lockLandscape = async () => {
    const installed =
      window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape-primary') => Promise<void>;
    };
    if (!installed || document.hidden || locking || !orientation?.lock) return;
    locking = true;
    try {
      await orientation.lock('landscape-primary');
    } catch {
      // Some platforms cannot enforce a lock. The portrait gate remains the fallback.
    } finally {
      locking = false;
      if (!events.signal.aborted) check();
    }
  };
  const foreground = () => {
    check();
    if (!document.hidden) void lockLandscape();
  };
  portrait.addEventListener('change', check, { signal: events.signal });
  window.addEventListener('resize', check, { signal: events.signal });
  window.addEventListener('pageshow', foreground, { signal: events.signal });
  document.addEventListener('visibilitychange', foreground, { signal: events.signal });
  document.addEventListener('fullscreenchange', foreground, { signal: events.signal });
  document.addEventListener(
    'keydown',
    (event) => {
      if (!blocked) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true, signal: events.signal },
  );
  check();
  void lockLandscape();
  return {
    get blocked() {
      return blocked;
    },
    check,
    dispose: () => {
      events.abort();
      app.inert = false;
      gate.remove();
    },
  };
}
