import type { DragonType } from '../game/types';

export const upgradeTrees: Record<
  DragonType,
  { name: string; nodes: { name: string; effect: string; cap?: number }[] }
> = {
  fire: {
    name: 'Fire · Damage',
    nodes: [
      { name: 'Total mana', effect: '+25 maximum mana' },
      { name: 'Max level', effect: '+1 dragon level cap (maximum level 6)' },
      { name: 'Placement mana', effect: '+5 mana when placing a dragon' },
      { name: 'Fire Rain', effect: '+10% spell damage' },
      { name: 'Egg return', effect: 'Dropped eggs return after 30s, −5s per rank (minimum 5s)' },
      { name: 'Attack power', effect: '+5% fire dragon damage' },
    ],
  },
  poison: {
    name: 'Green · Rate',
    nodes: [
      { name: 'Starting mana', effect: '+10 starting mana' },
      { name: 'Max level', effect: '+1 dragon level cap (maximum level 6)' },
      { name: 'More eggs', effect: '+1 starting egg (maximum 6)' },
      { name: 'Ice duration', effect: '+1 second Ice Freeze' },
      { name: 'Food from kills', effect: '+2 food per kill' },
      { name: 'Attack power', effect: '+5% poison dragon damage' },
    ],
  },
  ice: {
    name: 'Blue · Range',
    nodes: [
      { name: 'Starting food', effect: '+25 starting food' },
      { name: 'Max level', effect: '+1 dragon level cap (maximum level 6)' },
      { name: 'More charges', effect: '+1 ice charge capacity' },
      { name: 'Mana regeneration', effect: '+10% mana regeneration' },
      { name: 'Carrier damage', effect: '+10% damage against egg carriers' },
      { name: 'Attack power', effect: '+5% ice dragon damage' },
    ],
  },
};
export const upgradeCost = (rank: number): number => 30 + rank * 20;
