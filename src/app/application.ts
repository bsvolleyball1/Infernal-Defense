import { mountApplication } from '../ui/mount';
import { bindBattleControls } from '../ui/controls';
import { isMenuPage, renderBestiary, renderOptions, renderSaveSlots, showBattle, showMenu } from '../ui/menus';
import type { MenuPage } from '../ui/menus';
import { GameEngine, createInitialState } from '../game/engine';
import type { GameCommand, GameEvent, Level } from '../game/types';
import { SaveRepository } from '../services/storage';
import { AudioService } from '../services/audio';
import { initPwa } from '../services/pwa';
import { element, elements, setText } from '../ui/dom';
import { SvgRenderer } from '../ui/renderer';
import { startRuntime } from './runtime';

export function startApplication(): void {
  mountApplication();
  const engine = new GameEngine();
  const repository = new SaveRepository({
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
  const audio = new AudioService();
  let settings = repository.readSettings();
  audio.setSettings(settings);
  let bestiary = repository.readBestiary();
  let slot: number | null = null;
  let pendingLevel: Level | null = null;
  let gameVisible = false;
  let showResults = true;
  let toastTimer = 0;
  let saveFailure: string | null = null;

  const renderer = new SvgRenderer();

  function showMessage(text: string): void {
    // Background PWA notices must not hide an unresolved journey-save failure.
    setText('#toast', saveFailure ?? text);
    element('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => element('#toast').classList.remove('show'), 3500);
  }

  function saveJourney(report = false): boolean {
    if (slot === null) return true;
    const result = repository.saveSlot(slot, engine.snapshot());

    if (!result.ok) {
      saveFailure = result.message;
      if (result.code === 'conflict') {
        engine.dispatch({ type: 'pause' });
        if (gameVisible) renderer.render(engine.state, showResults);
      }
      showMessage(result.message);
      setText('#saveNotice', result.message);
      return false;
    }
    saveFailure = null;
    setText('#saveNotice', '');
    if (report) showMessage(`Journey saved to slot ${slot + 1}`);
    return true;
  }

  function handleEngineEvents(events: GameEvent[]): void {
    let needsSave = false;
    for (const event of events) {
      switch (event.type) {
        case 'message':
          showMessage(event.text);
          break;
        case 'sound':
          audio.play(event.dragon);
          break;
        case 'save':
          needsSave = true;
          break;
        case 'result':
          showResults = true;
          needsSave = true;
          break;
        case 'discovery': {
          bestiary = [...new Set([...bestiary, event.kind])];
          const result = repository.writeBestiary(bestiary);
          if (!result.ok) showMessage(result.message);
          needsSave = true;
          break;
        }
      }
    }
    if (needsSave) saveJourney();
  }

  function dispatchGameCommand(command: GameCommand): void {
    audio.unlock();
    handleEngineEvents(engine.dispatch(command));
    saveJourney();
    renderer.render(engine.state, showResults);
  }

  function navigateToMenu(name: MenuPage): void {
    gameVisible = false;
    showMenu(name);
    if (name === 'saves') renderSaveSlots(index => repository.readSlot(index));
    if (name === 'bestiary') renderBestiary(bestiary);
    if (name === 'options') renderOptions(settings);
    if (name === 'upgrades') setText('#bankedGold', `${engine.state.bankedGold} gold`);
  }

  function returnHome(): void {
    if (slot !== null) {
      handleEngineEvents(engine.dispatch({ type: 'pause' }));
      if (!saveJourney()) {
        renderer.render(engine.state, showResults);
        return;
      }
    }
    slot = null;
    pendingLevel = null;
    navigateToMenu('home');
  }

  function showBattleScreen(): void {
    gameVisible = true;
    showResults = true;
    showBattle();
    renderer.render(engine.state, showResults);
  }

  function newJourney(index: number): void {
    const existing = repository.readSlot(index, true);
    if (existing.status === 'error') {
      showMessage(existing.message);
      return;
    }
    if (existing.status === 'valid' && !window.confirm(`Start a new journey in Save Slot ${index + 1}? This replaces its saved progress.`)) return;
    slot = index;
    const initial = createInitialState(pendingLevel ?? 'level1');
    initial.knownMonsters = [...bestiary];
    engine.restore(initial);
    saveJourney();
    if (pendingLevel) {
      pendingLevel = null;
      showBattleScreen();
    } else navigateToMenu('levels');
  }

  function loadJourney(index: number): void {
    const read = repository.readSlot(index, true);
    if (read.status !== 'valid') {
      if (read.status === 'error') showMessage(read.message);
      return;
    }
    slot = index;
    engine.restore(read.data.state);
    if (engine.state.phase === 'battle') engine.dispatch({ type: 'pause' });
    bestiary = [...new Set([...bestiary, ...engine.state.knownMonsters])];
    const result = repository.writeBestiary(bestiary);
    if (!result.ok) showMessage(result.message);
    showBattleScreen();
    if (read.migrated) saveJourney();
    showMessage(`Save Slot ${index + 1} loaded${engine.state.phase === 'battle' ? ' · battle paused' : ''}`);
  }

  function launchLevel(level: Level): void {
    audio.unlock();
    if (slot === null) {
      pendingLevel = level;
      setText('#saveIntro', 'Choose a save slot for this new journey.');
      navigateToMenu('saves');
      return;
    }
    const unfinished = engine.state.phase === 'battle' || engine.state.phase === 'ready' && engine.state.wave > 0;
    if (unfinished && !window.confirm('Begin a new battle? This replaces the current battle in this save slot.')) return;
    const state = createInitialState(level, engine.state.bankedGold);
    state.knownMonsters = [...bestiary];
    engine.restore(state);
    pendingLevel = null;
    saveJourney();
    showBattleScreen();
  }

  bindBattleControls({
    dispatch: dispatchGameCommand,
    readState: () => engine.state,
    isVisible: () => gameVisible,
    resume: () => {
      void audio.resume();
      dispatchGameCommand({ type: 'resume' });
    },
    returnHome,
    save: () => { saveJourney(true); },
  });
  element('#sound').addEventListener('click', () => {
    settings = { ...settings, quiet: !settings.quiet };
    audio.setSettings(settings);
    void audio.unlock();
    setText('#sound', settings.quiet ? '♫ sound off' : '♫ sound on');
    const result = repository.writeSettings(settings);
    if (!result.ok) showMessage(result.message);
  });
  elements<HTMLButtonElement>('[data-open]').forEach(button => button.addEventListener('click', () => {
    void audio.unlock();
    pendingLevel = null;
    setText('#saveIntro', 'Choose a journey to continue, or start a new one in an empty slot.');
    if (isMenuPage(button.dataset.open)) navigateToMenu(button.dataset.open);
  }));
  elements('[data-home]').forEach(button => button.addEventListener('click', returnHome));
  elements<HTMLButtonElement>('[data-level]').forEach(button => button.addEventListener('click', () => launchLevel(button.dataset.level as Level)));
  element('#saveList').addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const load = event.target.closest<HTMLElement>('[data-load]');
    const fresh = event.target.closest<HTMLElement>('[data-new]');
    if (load) loadJourney(Number(load.dataset.load));
    if (fresh) newJourney(Number(fresh.dataset.new));
  });
  for (const field of ['music', 'sound'] as const) {
    element<HTMLInputElement>(`#${field}Volume`).addEventListener('input', event => {
      settings = { ...settings, [field]: Number((event.target as HTMLInputElement).value) };
      renderOptions(settings);
      audio.setSettings(settings);
      void audio.unlock();
      const result = repository.writeSettings(settings);
      if (!result.ok) showMessage(result.message);
    });
  }
  element('#resultContinue').addEventListener('click', () => {
    if (!saveJourney()) return;
    showResults = false;
    navigateToMenu('upgrades');
  });
  element('#upgradeToLevels').addEventListener('click', () => navigateToMenu('levels'));
  startRuntime({
    engine,
    isVisible: () => gameVisible,
    onEvents: handleEngineEvents,
    onRender: () => renderer.render(engine.state, showResults),
    onSave: () => { saveJourney(); },
    onBackground: () => { void audio.suspend(); },
  });
  initPwa({
    onMessage: showMessage,
    beforeUpdate: () => {
      engine.dispatch({ type: 'pause' });
      if (gameVisible) renderer.render(engine.state, showResults);
      return saveJourney();
    },
  });
  setText('#sound', settings.quiet ? '♫ sound off' : '♫ sound on');
  renderer.render(engine.state, showResults);
  navigateToMenu('home');

}
