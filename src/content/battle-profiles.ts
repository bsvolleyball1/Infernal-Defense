import type { DefenseProfile } from '../domain/model';

export const defenseProfiles = {
  'defense-1': { grid: false, evolution: false, maximumTier: 6 },
  'defense-2': { grid: true, evolution: true, maximumTier: 3 },
} as const satisfies Record<DefenseProfile, { grid: boolean; evolution: boolean; maximumTier: number }>;

/** New production battles opt in explicitly; historical fixture factories keep their old default. */
export const newBattleProfile: DefenseProfile = 'defense-2';
