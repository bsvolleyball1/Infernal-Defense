/** Latest main gameplay rules, kept separate from the original battle balance. */
export const defenseRules = {
  startingEggs: 3,
  maximumEggs: 6,
  maximumDragonLevel: 6,
  maximumUpgradeRank: 1000,
  placementManaPerRank: 5,
  manaPerSecond: 5,
  spellCost: 150,
  spellCooldownMs: 5000,
  waveCountdownMs: 5000,
  earlyWaveManaPerSecond: 10,
  bonusDamagePerLevel: 0.1,
  bonusRangePerLevel: 0.1,
  bonusManaPerSecondPerLevel: 0.5,
  bonusFoodPerSecondPerLevel: 0.5,
  bonusGoldPerSecondPerLevel: 0.25,
  eggReturnMs: 30000,
  eggReturnReductionMs: 5000,
  minimumEggReturnMs: 5000,
  directDistanceUnit: 50,
  baseMana: 200,
  manaPerTotalManaRank: 25,
  startingManaPerRank: 10,
  startingFoodPerRank: 25,
  baseDragonLevel: 3,
  sandboxMaxLevelRank: 3,
  attackPowerPerRank: 0.05,
  nonAttackRankBonus: 0.01,
  carrierDamagePerRank: 0.1,
  killFoodPerRank: 2,
  fireRainDamage: 25,
  fireRainDamagePerRank: 0.1,
  fireRainRadius: 100,
  fireRainDurationMs: 1150,
  fireRainImpactDelayMs: 500,
  poisonCloudRadius: 200,
  poisonCloudDurationMs: 3000,
  poisonCloudHealthFraction: 0.05,
  iceFreezeBaseMs: 2000,
  iceFreezePerRankMs: 1000,
  iceFreezeOnHitMs: 1000,
  poisonSlowMs: 3000,
  poisonTickMs: 1000,
  manaRegenPerRank: 0.1,
  poisonShotIntervalMs: 250,
  poisonShotHealthFraction: 0.01,
  fireWaveCooldownMs: 1000,
  fireWaveVisualMs: 350,
  iceChargeIntervalMs: 1000,
  projectileOriginOffset: 18,
  projectileSpeed: 5,
  projectileHitSlop: 3,
  slowMultiplier: 0.5,
  spellNudge: 20,
  summonCap: 500,
  defaultSummonClockMs: 5000,
  balanceEpsilon: 1e-7,
} as const;

export function upgradedEggCount(rank: number): number {
  return Math.min(defenseRules.maximumEggs, defenseRules.startingEggs + rank);
}

export function eggReturnDelay(rank: number): number {
  return Math.max(defenseRules.minimumEggReturnMs, defenseRules.eggReturnMs - defenseRules.eggReturnReductionMs * rank);
}

export function maximumMana(totalManaRank: number): number {
  return defenseRules.baseMana + defenseRules.manaPerTotalManaRank * totalManaRank;
}
