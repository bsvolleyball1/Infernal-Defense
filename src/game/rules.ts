import { dragons } from '../content/catalog';
import type { Tower } from './types';

/** Original playable balance. Refactoring must not change these values. */
export const battleRules = {
  startingGold: 120,
  eggCount: 5,
  maximumEnemies: 50,
  movementPerMillisecond: 0.0045,
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
  return dragons[tower.type].range + tower.level * battleRules.rangePerLevel;
}

export function towerDamage(tower: Tower): number {
  return dragons[tower.type].damage * (1 + (tower.level - 1) * battleRules.damagePerExtraLevel);
}

export function towerAttackInterval(tower: Tower): number {
  return dragons[tower.type].rate / (1 + (tower.level - 1) * battleRules.attackRatePerExtraLevel);
}

export function towerUpgradeCost(tower: Tower): number {
  return tower.level * battleRules.upgradeGoldPerLevel;
}

export function towerSaleRefund(tower: Tower): number {
  return Math.floor(dragons[tower.type].cost * battleRules.saleFraction)
    + (tower.level - 1) * battleRules.saleGoldPerExtraLevel;
}

export function waveReward(wave: number): number {
  return battleRules.waveBaseGold + wave * battleRules.waveGoldPerLevel;
}
