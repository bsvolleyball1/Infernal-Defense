import { mountApplication } from '../ui/mount';
import { bindBattleControls } from '../ui/controls';
import {
  isMenuPage,
  renderBestiary,
  renderContinue,
  renderJourney,
  renderOptions,
  renderSaveSlots,
  showBattle,
  showMenu,
} from '../ui/menus';
import type { MenuPage } from '../ui/menus';
import { GameEngine } from '../game/engine';
import { createDefenseState, nextBattle } from '../game/defense-state';
import { defenseRules } from '../content/defense-rules';
import {
  bindDefenseControls,
  mountDefenseControls,
  permanentCommand,
  renderPermanent,
} from '../ui/defense-controls';
import type { GameCommand, GameEvent, GameState, Level } from '../game/types';
import { createJourney, importJourney, recordJourneyResult } from '../game/journey';
import type { JourneyProgress } from '../game/journey';
import { SaveRepository } from '../services/storage';
import { AudioService } from '../services/audio';
import { initPwa } from '../services/pwa';
import type { PwaController } from '../services/pwa';
import { element, elements, setText } from '../ui/dom';
import { SvgRenderer } from '../ui/renderer';
import { startRuntime } from './runtime';

export function startApplication(): void {
  mountApplication();
  mountDefenseControls();
  const engine = new GameEngine();
  const repository = new SaveRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
  const audio = new AudioService();
  let settings = repository.readSettings();
  audio.setSettings(settings);
  let bestiary = repository.readBestiary();
  let slot: number | null = null;
  let journey = createJourney();
  let continueSlot: number | null = null;
  let gameVisible = false;
  let showResults = true;
  let toastTimer = 0;
  let saveFailure: string | null = null;
  let pwa: PwaController = { onJourneySaved: () => {}, checkPendingUpdate: () => {} };

  const renderer = new SvgRenderer();

  function showMessage(text: string): void {
    // Background PWA notices must not hide an unresolved journey-save failure.
    const toast = element('#toast');
    setText('#toastText', saveFailure ?? text);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function writeJourney(index: number, state: GameState, progress: JourneyProgress): boolean {
    const result = repository.saveSlot(index, state, progress);

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
    return true;
  }

  function saveJourney(report = false): boolean {
    if (slot === null) return true;
    journey = recordJourneyResult(journey, engine.state);
    if (!writeJourney(slot, engine.snapshot(), journey)) return false;
    if (report) showMessage(`Journey saved to slot ${slot + 1}`);
    pwa.onJourneySaved();
    return true;
  }

  /** Commit level/player changes only after their complete save succeeds. */
  function commitJourney(index: number, state: GameState, progress: JourneyProgress): boolean {
    if (!writeJourney(index, state, progress)) return false;
    slot = index;
    engine.restore(state);
    journey = progress;
    pwa.onJourneySaved();
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
    if (command.type !== 'previewSpell') saveJourney();
    renderer.render(engine.state, showResults);
    pwa.checkPendingUpdate();
  }

  function navigateToMenu(name: MenuPage): void {
    if (name === 'levels' && slot === null) name = 'saves';
    gameVisible = false;
    showMenu(name);
    if (name === 'home') continueSlot = renderContinue((index) => repository.readSlot(index));
    if (name === 'levels' && slot !== null) renderJourney(slot, engine.state, journey);
    if (name === 'saves') renderSaveSlots((index) => repository.readSlot(index));
    if (name === 'bestiary') renderBestiary(bestiary);
    if (name === 'options') renderOptions(settings);
    if (name === 'upgrades') {
      setText('#bankedGold', `${engine.state.bankedGold} gold`);
      renderPermanent(engine.state);
    }
  }

  function returnHome(): void {
    if (slot !== null) {
      handleEngineEvents(engine.dispatch({ type: 'pause' }));
      if (!saveJourney()) {
        renderer.render(engine.state, showResults);
        return;
      }
    }
    navigateToMenu(slot === null ? 'home' : 'levels');
  }

  function showBattleScreen(): void {
    gameVisible = true;
    showResults = true;
    showBattle();
    renderer.render(engine.state, showResults);
  }

  function newJourney(index: number): void {
    if (slot !== null && slot !== index && !saveJourney()) return;
    const existing = repository.readSlot(index);
    if (existing.status === 'error') {
      showMessage(existing.message);
      return;
    }
    if (
      existing.status === 'valid' &&
      !window.confirm(`Start a new journey in Save Slot ${index + 1}? This replaces its saved progress.`)
    )
      return;
    repository.readSlot(index, true);
    if (commitJourney(index, createDefenseState(), createJourney())) navigateToMenu('levels');
  }

  function loadJourney(index: number): void {
    if (slot !== null && slot !== index && !saveJourney()) return;
    const read = repository.readSlot(index, true);
    if (read.status !== 'valid') {
      if (read.status === 'error') showMessage(read.message);
      return;
    }
    slot = index;
    engine.restore(read.data.state);
    journey = read.data.journey ?? importJourney(engine.state);
    if (journey.activeBattle) engine.dispatch({ type: 'pause' });
    bestiary = [...new Set([...bestiary, ...engine.state.knownMonsters])];
    const result = repository.writeBestiary(bestiary);
    if (!result.ok) showMessage(result.message);
    navigateToMenu('levels');
    if (read.migrated || !read.data.journey) saveJourney();
    showMessage(`Save Slot ${index + 1} loaded${engine.state.paused ? ' · battle paused' : ''}`);
  }

  function launchLevel(level: Level): void {
    audio.unlock();
    if (slot === null) {
      setText('#saveIntro', 'Create or load a player save before choosing a level.');
      navigateToMenu('saves');
      return;
    }
    if (journey.activeBattle) {
      showMessage('Finish or end your current attempt before choosing another level.');
      return;
    }
    const state = nextBattle(engine.state, level);
    state.defense!.countdown = defenseRules.waveCountdownMs;
    state.knownMonsters = [...engine.state.knownMonsters];
    if (commitJourney(slot, state, { ...journey, activeBattle: true })) showBattleScreen();
  }

  function abandonBattle(): void {
    if (slot === null || !journey.activeBattle) return;
    if (
      !window.confirm(
        'End this attempt? Its towers, wave progress, and unbanked battle gold will be lost. Your banked gold and cleared levels remain.',
      )
    )
      return;
    const state = nextBattle(engine.state, engine.state.activeLevel);
    state.knownMonsters = [...engine.state.knownMonsters];
    if (commitJourney(slot, state, { ...journey, activeBattle: false })) navigateToMenu('levels');
  }

  bindDefenseControls(() => engine.state, dispatchGameCommand);
  bindBattleControls({
    dispatch: dispatchGameCommand,
    readState: () => engine.state,
    isVisible: () => gameVisible,
    resume: () => {
      void audio.resume();
      dispatchGameCommand({ type: 'resume' });
    },
    returnHome,
    save: () => {
      saveJourney(true);
    },
  });
  element('#sound').addEventListener('click', () => {
    settings = { ...settings, quiet: !settings.quiet };
    audio.setSettings(settings);
    void audio.unlock();
    setText('#sound', settings.quiet ? '♫ sound off' : '♫ sound on');
    const result = repository.writeSettings(settings);
    if (!result.ok) showMessage(result.message);
  });
  elements<HTMLButtonElement>('[data-open]').forEach((button) =>
    button.addEventListener('click', () => {
      void audio.unlock();
      setText(
        '#saveIntro',
        'Each slot is one player journey across all levels. Create or load a player save.',
      );
      if (isMenuPage(button.dataset.open)) navigateToMenu(button.dataset.open);
    }),
  );
  elements('[data-home]').forEach((button) => button.addEventListener('click', returnHome));
  element('#continueJourney').addEventListener('click', () => {
    if (continueSlot !== null) loadJourney(continueSlot);
  });
  element('#openPermanent').addEventListener('click', () => {
    if (saveJourney()) navigateToMenu('upgrades');
  });
  element('#permanentControls').addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || slot === null || journey.activeBattle) return;
    const button = event.target.closest<HTMLElement>('[data-permanent]');
    if (!button) return;
    const candidate = new GameEngine(engine.snapshot()),
      events = candidate.dispatch(permanentCommand(button));
    if (!events.length) return;
    const state =
      candidate.state.phase === 'ready'
        ? createDefenseState(candidate.state.activeLevel, candidate.state)
        : candidate.snapshot();
    if (commitJourney(slot, state, journey)) {
      renderPermanent(engine.state);
      setText('#bankedGold', `${engine.state.bankedGold} gold`);
      showMessage('Permanent upgrade purchased');
    }
  });
  element('#startTestMode').addEventListener('click', () => {
    engine.dispatch({ type: 'pause' });
    if (!saveJourney()) return;
    slot = null;
    journey = createJourney();
    engine.restore(createDefenseState('tutorial', undefined, true));
    elements<HTMLInputElement>('[data-test-count]').forEach((i) => {
      i.value = i.dataset.testCount === 'imp' ? '3' : '0';
    });
    showBattleScreen();
  });
  element('#journeyResume').addEventListener('click', () => {
    if (slot !== null) showBattleScreen();
  });
  element('#abandonBattle').addEventListener('click', abandonBattle);
  element('#journeyExit').addEventListener('click', () => {
    if (!saveJourney()) return;
    slot = null;
    navigateToMenu('home');
  });
  elements<HTMLButtonElement>('[data-level]').forEach((button) =>
    button.addEventListener('click', () => launchLevel(button.dataset.level as Level)),
  );
  element('#saveList').addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const load = event.target.closest<HTMLElement>('[data-load]');
    const fresh = event.target.closest<HTMLElement>('[data-new]');
    if (load) loadJourney(Number(load.dataset.load));
    if (fresh) newJourney(Number(fresh.dataset.new));
  });
  for (const field of ['music', 'sound'] as const) {
    element<HTMLInputElement>(`#${field}Volume`).addEventListener('input', (event) => {
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
    onRender: () => {
      renderer.render(engine.state, showResults);
      pwa.checkPendingUpdate();
    },
    onSave: () => {
      saveJourney();
    },
    onBackground: () => {
      void audio.suspend();
    },
  });
  pwa = initPwa({
    onMessage: showMessage,
    canAutoUpdate: () =>
      !document.hidden &&
      !(
        gameVisible &&
        (engine.state.phase === 'battle' || engine.state.defense?.countdown != null) &&
        !engine.state.paused
      ),
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
