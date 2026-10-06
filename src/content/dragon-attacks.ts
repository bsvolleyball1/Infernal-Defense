export const fireLevels = [
  { dps: 6, beams: 1, area: false },
  { dps: 15, beams: 1, area: false },
  { dps: 15, beams: 2, area: false },
  { dps: 15, beams: 3, area: false },
  { dps: 15, beams: 0, area: true },
  { dps: 20, beams: 0, area: true },
] as const;
export const iceLevels = [
  { damage: 15, capacity: 1, freeze: 0 },
  { damage: 15, capacity: 2, freeze: 0 },
  { damage: 15, capacity: 3, freeze: 0 },
  { damage: 15, capacity: 3, freeze: 0.2 },
  { damage: 25, capacity: 3, freeze: 0.2 },
  { damage: 25, capacity: 3, freeze: 0.3 },
] as const;
export const poisonLevels = [
  { damage: 2, poison: 0, slow: 0 },
  { damage: 4, poison: 0, slow: 0 },
  { damage: 4, poison: 5000, slow: 0 },
  { damage: 4, poison: 5000, slow: 1000 },
  { damage: 5, poison: 5000, slow: 1000 },
  { damage: 6, poison: 5000, slow: 1000 },
] as const;
export const attackIndex = (level: number): number => Math.max(0, Math.min(5, level - 1));
