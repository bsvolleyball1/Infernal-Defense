import { newBattleProfile } from '../content/battle-profiles';
import { createDefenseState } from '../game/defense-state';
import { createJourney, importJourney } from '../game/journey';
import type { GameCommand, GameState, SimulationEngine } from '../game/types';
import type { SlotResult } from '../services/storage';
import type { BestiaryStore } from './bestiary-store';
import { copy } from './copy';
import type { NavigationController } from './navigation';
import type { GameSession } from './session';

export interface JourneyRepository {
  readSlot(index: number, adopt?: boolean): SlotResult;
}

export interface JourneyHooks {
  session: GameSession;
  engine: SimulationEngine;
  repository: JourneyRepository;
  bestiary: BestiaryStore;
  navigation: NavigationController;
  notify(text: string): void;
  confirm(text: string): boolean;
  /** Builds a throwaway engine used to price a permanent upgrade before committing it. */
  previewEngine(state: GameState): SimulationEngine;
  onPermanentPurchased(): void;
  onTestModeStarted(): void;
}

/** Owns the journey lifecycle: creating, loading, leaving and upgrading a player save. */
export class JourneyController {
  constructor(private readonly hooks: JourneyHooks) {}

  create(index: number): void {
    const { session, repository } = this.hooks;
    if (session.slot !== null && session.slot !== index && !session.save()) return;
    const existing = repository.readSlot(index);
    if (existing.status === 'error') {
      this.hooks.notify(existing.message);
      return;
    }
    if (existing.status === 'valid' && !this.hooks.confirm(copy.confirmNewJourney(index))) return;
    repository.readSlot(index, true);
    if (session.commit(index, createDefenseState('level1', undefined, false, newBattleProfile), createJourney()))
      this.hooks.navigation.navigate('levels');
  }

  load(index: number): void {
    const { session, engine, repository, bestiary, navigation } = this.hooks;
    if (session.slot !== null && session.slot !== index && !session.save()) return;
    const read = repository.readSlot(index, true);
    if (read.status !== 'valid') {
      if (read.status === 'error') this.hooks.notify(read.message);
      return;
    }
    session.slot = index;
    engine.restore(read.data.state);
    session.journey = read.data.journey ?? importJourney(engine.state);
    if (session.journey.activeBattle) engine.dispatch({ type: 'pause' });
    bestiary.record(...engine.state.knownMonsters);
    navigation.navigate('levels');
    if (read.migrated || !read.data.journey) session.save();
    this.hooks.notify(copy.slotLoaded(index, engine.state.paused));
  }

  continueLatest(): void {
    const slot = this.hooks.navigation.continueSlot;
    if (slot !== null) this.load(slot);
  }

  /** Close the open slot after saving it. */
  exit(): void {
    if (!this.hooks.session.save()) return;
    this.hooks.session.slot = null;
    this.hooks.navigation.navigate('home');
  }

  openUpgrades(): void {
    if (this.hooks.session.save()) this.hooks.navigation.navigate('upgrades');
  }

  buyPermanent(command: GameCommand): void {
    const { session, engine } = this.hooks;
    if (session.slot === null || session.journey.activeBattle) return;
    const current = engine.snapshot();
    const preview =
      current.defense?.ruleset === 'defense-1'
        ? createDefenseState(current.activeLevel, current, false, newBattleProfile)
        : current;
    const candidate = this.hooks.previewEngine(preview);
    if (!candidate.dispatch(command).length) return;
    const state =
      candidate.state.phase === 'ready'
        ? createDefenseState(candidate.state.activeLevel, candidate.state)
        : candidate.snapshot();
    if (!session.commit(session.slot, state, session.journey)) return;
    this.hooks.onPermanentPurchased();
    this.hooks.notify(copy.permanentPurchased);
  }

  startTestMode(): void {
    const { session, engine } = this.hooks;
    engine.dispatch({ type: 'pause' });
    if (!session.save()) return;
    session.slot = null;
    session.journey = createJourney();
    engine.restore(createDefenseState('tutorial', undefined, true, newBattleProfile));
    this.hooks.onTestModeStarted();
    this.hooks.navigation.showBattleScreen();
  }

  resumeBattle(): void {
    if (this.hooks.session.slot !== null) this.hooks.navigation.showBattleScreen();
  }
}
