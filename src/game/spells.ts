import { challengeAllowsSpell } from '../content/maps';
import { entityPosition, isInsideBattlefield } from './geometry';
import { applyDamage } from './damage';
import { rankOf } from './defense-state';
import { defenseRules } from '../content/defense-rules';
import { enemyTraits } from '../content/enemies';
import type { DefenseBattle, GameEvent, GameState, Point, SpellKind } from './types';
import { getMap } from '../content/catalog';

export function castSpell(state: GameState, spell: SpellKind, point: Point | undefined): GameEvent[] {
  const d = state.defense;
  if (
    !d ||
    !['fire', 'ice', 'poison'].includes(spell) ||
    !challengeAllowsSpell(getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout), spell) ||
    state.phase !== 'battle' ||
    state.paused ||
    (d.mana < defenseRules.spellCost && d.mode !== 'sandbox') ||
    d.spellCooldowns[spell] > 0
  )
    return [];
  const battlefield = getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout);
  if (spell !== 'ice' && (!point || !isInsideBattlefield(point, battlefield))) return [];
  if (!state.enemies.some((e) => e.hp > 0)) return [{ type: 'message', text: 'No monsters on the map' }];
  if (d.mode !== 'sandbox') d.mana -= defenseRules.spellCost;
  d.spellCooldowns[spell] = defenseRules.spellCooldownMs;
  d.targeting = null;
  d.preview = null;
  const events: GameEvent[] = [{ type: 'save' }];
  if (spell === 'ice') {
    for (const e of state.enemies)
      if (!enemyTraits(e.kind).spellImmune)
        e.frozen = Math.max(
          e.frozen ?? 0,
          defenseRules.iceFreezeBaseMs + defenseRules.iceFreezePerRankMs * rankOf(state, 'poison', 'iceDuration'),
        );
  } else if (point) {
    d.visuals.push({
      id: state.nextEntityId++,
      kind: spell,
      ...point,
      radius: spell === 'fire' ? defenseRules.fireRainRadius : defenseRules.poisonCloudRadius,
      remaining: spell === 'fire' ? defenseRules.fireRainDurationMs : defenseRules.poisonCloudDurationMs,
    });
    if (spell === 'fire')
      d.impacts.push({
        id: state.nextEntityId++,
        ...point,
        remaining: defenseRules.fireRainImpactDelayMs,
        damage:
          defenseRules.fireRainDamage * (1 + rankOf(state, 'fire', 'fireRain') * defenseRules.fireRainDamagePerRank),
      });
    else
      for (const e of state.enemies) {
        const [x, y] = entityPosition(state, e);
        if (enemyTraits(e.kind).spellImmune || Math.hypot(x - point.x, y - point.y) > defenseRules.poisonCloudRadius)
          continue;
        e.slow = Math.max(e.slow, defenseRules.poisonSlowMs);
        e.poison = defenseRules.poisonCloudDurationMs;
        e.poisonD = defenseRules.poisonTickMs;
        e.poisonDamage = e.max * defenseRules.poisonCloudHealthFraction;
        e.poisonSource = 'spell';
      }
  }
  return [
    ...events,
    {
      type: 'message',
      text:
        spell === 'ice'
          ? 'All vulnerable monsters frozen'
          : spell === 'fire'
            ? 'Fire Rain summoned'
            : 'Poison Gas released',
    },
  ];
}
export function tickSpells(state: DefenseBattle, dt: number, events: GameEvent[]): void {
  const d = state.defense;
  d.mana = Math.min(
    d.maxMana,
    d.mana +
      (defenseRules.manaPerSecond *
        (1 + rankOf(state, 'ice', 'manaRegeneration') * defenseRules.manaRegenPerRank) *
        dt) /
        1000,
  );
  for (const key of ['fire', 'ice', 'poison'] as const) d.spellCooldowns[key] = Math.max(0, d.spellCooldowns[key] - dt);
  for (const impact of d.impacts) {
    impact.remaining -= dt;
    if (impact.remaining > defenseRules.balanceEpsilon) continue;
    for (const e of state.enemies) {
      const [x, y] = entityPosition(state, e);
      if (Math.hypot(x - impact.x, y - impact.y) <= defenseRules.fireRainRadius)
        applyDamage(state, e, impact.damage, 'spell', events);
    }
  }
  d.impacts = d.impacts.filter((i) => i.remaining > defenseRules.balanceEpsilon);
  for (const visual of d.visuals) visual.remaining -= dt;
  d.visuals = d.visuals.filter((v) => v.remaining > 0);
  for (const egg of state.eggs) {
    if (egg.status !== 'dropped' || egg.returnTimer === undefined) continue;
    egg.returnTimer = Math.max(0, egg.returnTimer - dt);
    if (egg.returnTimer < defenseRules.balanceEpsilon) {
      egg.status = 'nest';
      egg.progress = null;
      delete egg.routeId;
      delete egg.direct;
      delete egg.returnTimer;
      events.push({ type: 'save' });
    }
  }
}
