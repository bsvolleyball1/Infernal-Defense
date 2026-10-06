import type { GameEvent, SimulationEngine } from '../game/types';

export interface RuntimeOptions {
  engine: SimulationEngine;
  isVisible: () => boolean;
  onEvents: (events: GameEvent[]) => void;
  onRender: () => void;
  onSave: () => void;
  onBackground: () => void;
}

/** Only foreground time enters the simulation. Browser lifecycle stays here. */
export function startRuntime(options: RuntimeOptions): () => void {
  const { engine } = options;
  const step = 1000 / 60;
  let previous = performance.now();
  let lastAutosave = previous;
  let accumulator = 0;
  let raf = 0;
  const resetClock = () => { previous = performance.now(); accumulator = 0; };
  function frame(now: number): void {
    const elapsed = Math.max(0, Math.min(250, now - previous)); previous = now;
    if (options.isVisible() && !document.hidden && engine.state.phase === 'battle' && !engine.state.paused) {
      accumulator += elapsed;
      const events: GameEvent[] = [];
      while (accumulator >= step) { events.push(...engine.step(step)); accumulator -= step; }
      options.onEvents(events);
      if (now - lastAutosave >= 2000) { options.onSave(); lastAutosave = now; }
    } else { accumulator = 0; lastAutosave = now; }
    if (options.isVisible() && !document.hidden) options.onRender();
    raf = requestAnimationFrame(frame);
  }
  function background(): void {
    engine.dispatch({ type: 'pause' });
    options.onSave(); options.onBackground(); resetClock();
    if (options.isVisible()) options.onRender();
  }
  function visibility(): void {
    if (document.hidden) background();
    else { resetClock(); if (options.isVisible()) options.onRender(); }
  }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', background);
  window.addEventListener('pageshow', resetClock);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', background);
    window.removeEventListener('pageshow', resetClock);
  };
}
