import { mountApplication } from '../ui/mount';
import { bindBattleControls } from '../ui/controls';
import { bindBattlefieldInput } from '../ui/battlefield-input';
import {
  renderBestiary,
  renderContinue,
  renderJourney,
  renderOptions,
  renderSaveSlots,
  renderSoundToggle,
  showBattle,
  showMenu,
} from '../ui/menus';
import { GameEngine } from '../game/engine';
import { bindTestWaveInputs, renderDefenseControls, renderPermanent } from '../ui/defense-controls';
import type { GameCommand, GameEvent, SimulationEngine } from '../game/types';
import { SaveRepository } from '../services/storage';
import { AudioService } from '../services/audio';
import { initPwa } from '../services/pwa';
import type { PwaController } from '../services/pwa';
import { element, elements, setText } from '../ui/dom';
import { SvgRenderer, type Renderer } from '../ui/renderer';
import { BestiaryStore } from './bestiary-store';
import { bindMenuControls } from './bindings';
import { copy } from './copy';
import { applyEngineEvents } from './engine-events';
import { JourneyController } from './journey-controller';
import { NavigationController } from './navigation';
import { shouldPersist } from './persist-policy';
import { startRuntime } from './runtime';
import { GameSession } from './session';
import { SettingsController } from './settings-controller';
import { reportWrite } from './write-report';

export function startApplication(): void {
  mountApplication();
  const engine: SimulationEngine = new GameEngine();
  const repository = new SaveRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
  const audio = new AudioService();
  const renderer: Renderer = new SvgRenderer();
  let pwa: PwaController = { onJourneySaved: () => {}, checkPendingUpdate: () => {} };
  let showResults = true;
  let saveFailure: string | null = null;
  let toastTimer = 0;

  function showMessage(text: string): void {
    // Background PWA notices must not hide an unresolved journey-save failure.
    const toast = element('#toast');
    setText('#toastText', saveFailure ?? text);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3500);
  }

  const reportResult = (result: Parameters<typeof reportWrite>[0]) => reportWrite(result, showMessage);
  const renderBattle = () => {
    renderer.render(engine.state, showResults);
    renderDefenseControls(engine.state);
  };
  const settings = new SettingsController(
    repository.readSettings(),
    repository,
    audio,
    { renderSoundToggle, renderOptions },
    reportResult,
  );
  const bestiary = new BestiaryStore(repository, reportResult);
  const session: GameSession = new GameSession({
    readState: () => engine.state,
    snapshot: () => engine.snapshot(),
    restore: (state) => engine.restore(state),
    pause: () => {
      engine.dispatch({ type: 'pause' });
    },
    saveSlot: (index, state, progress) => repository.saveSlot(index, state, progress),
    onSaved: () => pwa.onJourneySaved(),
    onReported: (index) => showMessage(copy.journeySaved(index)),
    onWriteSuccess: () => {
      saveFailure = null;
      setText('#saveNotice', '');
    },
    onWriteFailure: (result) => {
      saveFailure = result.message;
      if (result.code === 'conflict' && navigation.battleVisible) renderBattle();
      showMessage(result.message);
      setText('#saveNotice', result.message);
    },
  });

  function persistEvents(command: GameCommand | null, events: GameEvent[]): void {
    const requested = applyEngineEvents(events, {
      bestiary,
      notify: showMessage,
      playSound: (dragon) => audio.play(dragon),
      onResult: () => {
        showResults = true;
      },
    });
    if (shouldPersist(command, requested)) session.save();
  }

  function dispatchGameCommand(command: GameCommand): void {
    void audio.unlock();
    persistEvents(command, engine.dispatch(command));
    renderBattle();
    pwa.checkPendingUpdate();
  }

  const navigation: NavigationController = new NavigationController({
    session,
    engine,
    renderBattle,
    persistEvents,
    notify: showMessage,
    confirm: (text) => window.confirm(text),
    unlockAudio: () => {
      void audio.unlock();
    },
    setSaveIntro: (text) => setText('#saveIntro', text),
    onBattleShown: () => {
      showResults = true;
    },
    views: {
      showMenu,
      showBattle,
      renderHome: () => renderContinue((index) => repository.readSlot(index)),
      renderLevels: renderJourney,
      renderSaves: () => renderSaveSlots((index) => repository.readSlot(index)),
      renderBestiary: () => renderBestiary(bestiary.list),
      renderOptions: () => renderOptions(settings.settings),
      renderUpgrades: (state) => {
        setText('#bankedGold', `${state.bankedGold} gold`);
        renderPermanent(state);
      },
    },
  });
  const journeys = new JourneyController({
    session,
    engine,
    repository,
    bestiary,
    navigation,
    notify: showMessage,
    confirm: (text) => window.confirm(text),
    previewEngine: (state) => new GameEngine(state),
    onPermanentPurchased: () => {
      renderPermanent(engine.state);
      setText('#bankedGold', `${engine.state.bankedGold} gold`);
    },
    onTestModeStarted: () => {
      elements<HTMLInputElement>('[data-test-count]').forEach((input) => {
        input.value = input.dataset.testCount === 'imp' ? '3' : '0';
      });
    },
  });

  bindTestWaveInputs(dispatchGameCommand);
  bindBattlefieldInput({
    dispatch: dispatchGameCommand,
    readState: () => engine.state,
    view: {
      previewPlacement: (point) => renderer.renderPlacement(point, engine.state),
      dismissTowerActions: () => renderer.dismissTowerActions(),
      reopenTowerActions: () => renderer.reopenTowerActions(),
      afterTowerAction: () => renderer.afterTowerAction(),
    },
  });
  bindBattleControls({
    dispatch: dispatchGameCommand,
    readState: () => engine.state,
    isVisible: () => navigation.battleVisible,
    resume: () => {
      void audio.resume();
      dispatchGameCommand({ type: 'resume' });
    },
    returnHome: () => navigation.returnHome(),
    save: () => {
      session.save(true);
    },
  });
  bindMenuControls({
    navigation,
    journeys,
    settings,
    unlockAudio: () => {
      void audio.unlock();
    },
    setSaveIntro: (text) => setText('#saveIntro', text),
    continueFromResults: () => {
      if (!session.save()) return;
      showResults = false;
      navigation.navigate('upgrades');
    },
  });
  startRuntime({
    engine,
    isVisible: () => navigation.battleVisible,
    onEvents: (events) => persistEvents(null, events),
    onRender: () => {
      renderBattle();
      pwa.checkPendingUpdate();
    },
    onSave: () => {
      session.save();
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
        navigation.battleVisible &&
        (engine.state.phase === 'battle' || engine.state.defense?.countdown != null) &&
        !engine.state.paused
      ),
    beforeUpdate: () => {
      engine.dispatch({ type: 'pause' });
      if (navigation.battleVisible) renderBattle();
      return session.save();
    },
  });
  settings.init();
  renderBattle();
  navigation.navigate('home');
}
