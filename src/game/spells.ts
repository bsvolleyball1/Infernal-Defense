import { entityPosition } from './geometry';
import { applyDamage } from './damage';
import { rank } from './defense-state';
import { defenseRules } from '../content/defense-rules';
import type { GameEvent, GameState, Point, SpellKind } from './types';

export function castSpell(state: GameState, spell: SpellKind, point: Point | undefined): GameEvent[] {
  const d = state.defense;
  if (
    !d ||
    !['fire', 'ice', 'poison'].includes(spell) ||
    state.phase !== 'battle' ||
    state.paused ||
    (d.mana < defenseRules.spellCost && d.mode !== 'sandbox') ||
    d.spellCooldowns[spell] > 0
  )
    return [];
  if (
    spell !== 'ice' &&
    (!point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.x > 700 ||
      point.y < 0 ||
      point.y > 430)
  )
    return [];
  if (!state.enemies.some((e) => e.hp > 0)) return [{ type: 'message', text: 'No monsters on the map' }];
  if (d.mode !== 'sandbox') d.mana -= defenseRules.spellCost;
  d.spellCooldowns[spell] = defenseRules.spellCooldownMs;
  d.targeting = null;
  d.preview = null;
  const events: GameEvent[] = [{ type: 'save' }];
  if (spell === 'ice') {
    for (const e of state.enemies)
      if (e.kind !== 'witch') e.frozen = Math.max(e.frozen ?? 0, 2000 + 1000 * rank(state, 'poison', 3));
  } else if (point) {
    d.visuals.push({
      id: state.nextEntityId++,
      kind: spell,
      ...point,
      radius: spell === 'fire' ? 100 : 200,
      remaining: spell === 'fire' ? 1150 : 3000,
    });
    if (spell === 'fire')
      d.impacts.push({
        id: state.nextEntityId++,
        ...point,
        remaining: 500,
        damage: 25 * (1 + rank(state, 'fire', 3) * 0.1),
      });
    else
      for (const e of state.enemies) {
        const [x, y] = entityPosition(state, e);
        if (e.kind === 'witch' || Math.hypot(x - point.x, y - point.y) > 200) continue;
        e.slow = Math.max(e.slow, 3000);
        e.poison = 3000;
        e.poisonD = 1000;
        e.poisonDamage = e.max * 0.05;
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
export function tickSpells(state: GameState, dt: number, events: GameEvent[]): void {
  const d = state.defense!;
  d.mana = Math.min(
    d.maxMana,
    d.mana + (defenseRules.manaPerSecond * (1 + rank(state, 'ice', 3) * 0.1) * dt) / 1000,
  );
  for (const key of ['fire', 'ice', 'poison'] as const)
    d.spellCooldowns[key] = Math.max(0, d.spellCooldowns[key] - dt);
  for (const impact of d.impacts) {
    impact.remaining -= dt;
    if (impact.remaining > 1e-7) continue;
    for (const e of state.enemies) {
      const [x, y] = entityPosition(state, e);
      if (Math.hypot(x - impact.x, y - impact.y) <= 100)
        applyDamage(state, e, impact.damage, 'spell', events);
    }
  }
  d.impacts = d.impacts.filter((i) => i.remaining > 1e-7);
  for (const visual of d.visuals) visual.remaining -= dt;
  d.visuals = d.visuals.filter((v) => v.remaining > 0);
  for (const egg of state.eggs) {
    if (egg.status !== 'dropped' || egg.returnTimer === undefined) continue;
    egg.returnTimer = Math.max(0, egg.returnTimer - dt);
    if (egg.returnTimer < 1e-7) {
      egg.status = 'nest';
      egg.progress = null;
      delete egg.routeId;
      delete egg.direct;
      delete egg.returnTimer;
      events.push({ type: 'save' });
    }
  }
}
