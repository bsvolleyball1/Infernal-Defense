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
  eggReturnMs: 30000,
  eggReturnReductionMs: 5000,
  minimumEggReturnMs: 5000,
  directDistanceUnit: 50,
} as const;

export function upgradedEggCount(rank: number): number {
  return Math.min(defenseRules.maximumEggs, defenseRules.startingEggs + rank);
}

export function eggReturnDelay(rank: number): number {
  return Math.max(
    defenseRules.minimumEggReturnMs,
    defenseRules.eggReturnMs - defenseRules.eggReturnReductionMs * rank,
  );
}
