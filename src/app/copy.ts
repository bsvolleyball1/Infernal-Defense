/** Player-facing application copy, kept in one place so each sentence exists once. */
export const copy = {
  saveIntro: 'Each slot is one player journey across all levels. Create or load a player save.',
  saveIntroNeedsSave: 'Create or load a player save before choosing a level.',
  finishAttemptFirst: 'Finish or end your current attempt before choosing another level.',
  permanentPurchased: 'Permanent upgrade purchased',
  confirmNewJourney: (slot: number) =>
    `Start a new journey in Save Slot ${slot + 1}? This replaces its saved progress.`,
  confirmAbandon:
    'End this attempt? Its towers, wave progress, and unbanked battle gold will be lost. Your banked gold and cleared levels remain.',
  journeySaved: (slot: number) => `Journey saved to slot ${slot + 1}`,
  slotLoaded: (slot: number, paused: boolean) => `Save Slot ${slot + 1} loaded${paused ? ' · battle paused' : ''}`,
  clearFirst: (required: string, level: string) => `Clear ${required} before starting ${level}.`,
} as const;
