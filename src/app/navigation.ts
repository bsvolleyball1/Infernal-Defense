import { defenseRules } from '../content/defense-rules';
import { getMap } from '../content/catalog';
import { nextBattle } from '../game/defense-state';
import { isLevelUnlocked, levelPrerequisite } from '../game/journey';
import type { JourneyProgress } from '../game/journey';
import type { GameCommand, GameEvent, GameState, Level, SimulationEngine } from '../game/types';
import type { MenuPage } from '../ui/menus';
import { copy } from './copy';
import type { GameSession } from './session';

export interface MenuViews {
  showMenu(page: MenuPage): void;
  showBattle(): void;
  /** Renders the continue card and returns the slot it continues, if any. */
  renderHome(): number | null;
  renderLevels(slot: number, state: GameState, journey: JourneyProgress): void;
  renderSaves(): void;
  renderBestiary(): void;
  renderOptions(): void;
  renderUpgrades(state: GameState): void;
}

export interface NavigationHooks {
  session: GameSession;
  engine: Pick<SimulationEngine, 'state' | 'dispatch'>;
  views: MenuViews;
  renderBattle(): void;
  persistEvents(command: GameCommand | null, events: GameEvent[]): void;
  notify(text: string): void;
  confirm(text: string): boolean;
  unlockAudio(): void;
  setSaveIntro(text: string): void;
  /** Called whenever the battle screen becomes visible. */
  onBattleShown(): void;
}

/** Owns which screen is visible and the actions that move between screens. */
export class NavigationController {
  continueSlot: number | null = null;
  battleVisible = false;

  constructor(private readonly hooks: NavigationHooks) {}

  navigate(requested: MenuPage): void {
    const { session, engine, views } = this.hooks;
    const page = requested === 'levels' && session.slot === null ? 'saves' : requested;
    this.battleVisible = false;
    views.showMenu(page);
    switch (page) {
      case 'home':
        this.continueSlot = views.renderHome();
        break;
      case 'levels':
        if (session.slot !== null) views.renderLevels(session.slot, engine.state, session.journey);
        break;
      case 'saves':
        views.renderSaves();
        break;
      case 'bestiary':
        views.renderBestiary();
        break;
      case 'options':
        views.renderOptions();
        break;
      case 'upgrades':
        views.renderUpgrades(engine.state);
        break;
    }
  }

  returnHome(): void {
    const { session, engine } = this.hooks;
    if (session.slot !== null) {
      this.hooks.persistEvents(null, engine.dispatch({ type: 'pause' }));
      if (!session.save()) {
        this.hooks.renderBattle();
        return;
      }
    }
    this.navigate(session.slot === null ? 'home' : 'levels');
  }

  showBattleScreen(): void {
    this.battleVisible = true;
    this.hooks.onBattleShown();
    this.hooks.views.showBattle();
    this.hooks.renderBattle();
  }

  launchLevel(level: Level): void {
    const { session, engine } = this.hooks;
    this.hooks.unlockAudio();
    if (session.slot === null) {
      this.hooks.setSaveIntro(copy.saveIntroNeedsSave);
      this.navigate('saves');
      return;
    }
    if (session.journey.activeBattle) {
      this.hooks.notify(copy.finishAttemptFirst);
      return;
    }
    if (!isLevelUnlocked(level, session.journey)) {
      const prerequisite = levelPrerequisite(level);
      if (prerequisite) this.hooks.notify(copy.clearFirst(getMap(prerequisite).name, getMap(level).name));
      return;
    }
    const state = nextBattle(engine.state, level);
    if (state.defense) state.defense.countdown = defenseRules.waveCountdownMs;
    state.knownMonsters = [...engine.state.knownMonsters];
    if (session.commit(session.slot, state, { ...session.journey, activeBattle: true })) this.showBattleScreen();
  }

  abandonBattle(): void {
    const { session, engine } = this.hooks;
    if (session.slot === null || !session.journey.activeBattle) return;
    if (!this.hooks.confirm(copy.confirmAbandon)) return;
    const state = nextBattle(engine.state, engine.state.activeLevel);
    state.knownMonsters = [...engine.state.knownMonsters];
    if (session.commit(session.slot, state, { ...session.journey, activeBattle: false })) this.navigate('levels');
  }
}
