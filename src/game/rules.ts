import { dragons } from '../content/catalog';
import { defenseRules } from '../content/defense-rules';
import type { DragonType } from '../domain/model';
import type { GameState, Tower } from './types';

/** Original playable balance. Refactoring must not change these values. */
export const battleRules = {
  startingGold: 120,
  eggCount: 5,
  maximumEnemies: 50,
  movementPerMillisecond: 0.0045,
  enemySpeedMultiplier: 0.5,
  projectileTravelPerMillisecond: 0.25,
  projectileHitTolerance: 3,
  projectileOriginOffset: 18,
  fireProjectileSpeed: 6,
  otherProjectileSpeed: 5,
  rangePerLevel: 6,
  damagePerExtraLevel: 0.42,
  attackRatePerExtraLevel: 0.13,
  upgradeGoldPerLevel: 45,
  saleFraction: 0.5,
  saleGoldPerExtraLevel: 18,
  enemyGold: 12,
  chiefBonusGold: 120,
  survivingEggGold: 10,
  waveCount: 5,
  waveBaseGold: 25,
  waveGoldPerLevel: 10,
  minimumSpawnIntervalMs: 390,
  initialSpawnIntervalMs: 710,
  spawnIntervalReductionMs: 54,
  freezeDurationMs: 1250,
  poisonDurationMs: 2300,
  initialPoisonTickMs: 10,
  poisonTickIntervalMs: 450,
  poisonTickDamage: 4,
} as const;

export function towerRange(tower: Tower): number {
  const startingRange = tower.level === 1 ? dragons[tower.type].range : dragons.fire.range;
  return startingRange + tower.level * battleRules.rangePerLevel;
}

export function towerDamage(tower: Tower): number {
  return dragons[tower.type].damage * (1 + (tower.level - 1) * battleRules.damagePerExtraLevel);
}

export function towerAttackInterval(tower: Tower): number {
  return dragons[tower.type].rate / (1 + (tower.level - 1) * battleRules.attackRatePerExtraLevel);
}

export function dragonPlacementCost(state: GameState, type: DragonType): number {
  return state.defense ? defenseRules.dragonPlacementFood : dragons[type].cost;
}

export function towerUpgradeCost(state: GameState, tower: Tower): number {
  if (state.defense) return defenseRules.dragonUpgradeFood + (tower.level - 1) * defenseRules.dragonUpgradeFoodPerTier;
  return tower.level * battleRules.upgradeGoldPerLevel;
}

export function towerSaleRefund(state: GameState, tower: Tower): number {
  if (state.defense) {
    let totalSpent = defenseRules.dragonPlacementFood;
    for (let level = 1; level < tower.level; level++)
      totalSpent += defenseRules.dragonUpgradeFood + (level - 1) * defenseRules.dragonUpgradeFoodPerTier;
    return totalSpent * battleRules.saleFraction;
  }
  return (
    Math.floor(dragons[tower.type].cost * battleRules.saleFraction) +
    (tower.level - 1) * battleRules.saleGoldPerExtraLevel
  );
}

export function waveReward(wave: number): number {
  return battleRules.waveBaseGold + wave * battleRules.waveGoldPerLevel;
}
