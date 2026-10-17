import type { DragonType } from '../domain/model';

export type UpgradeNodeId =
  | 'totalMana'
  | 'maxLevel'
  | 'placementMana'
  | 'fireRain'
  | 'eggReturn'
  | 'attackPower'
  | 'startingMana'
  | 'moreEggs'
  | 'iceDuration'
  | 'foodFromKills'
  | 'startingFood'
  | 'moreCharges'
  | 'manaRegeneration'
  | 'carrierDamage';

export interface UpgradeNode {
  id: UpgradeNodeId;
  name: string;
  effect: string;
  cap?: number;
}

export const upgradeTrees: Record<DragonType, { name: string; nodes: UpgradeNode[] }> = {
  fire: {
    name: 'Red · Damage',
    nodes: [
      { id: 'totalMana', name: 'Total mana', effect: '+25 maximum mana' },
      { id: 'maxLevel', name: 'Max level', effect: '+1 dragon level cap (maximum level 6)' },
      { id: 'placementMana', name: 'Placement mana', effect: '+5 mana when placing a dragon' },
      { id: 'fireRain', name: 'Fire Rain', effect: '+10% spell damage' },
      { id: 'eggReturn', name: 'Egg return', effect: 'Dropped eggs return after 30s, −5s per rank (minimum 5s)' },
      { id: 'attackPower', name: 'Attack power', effect: '+5% fire dragon damage' },
    ],
  },
  poison: {
    name: 'Yellow · Rate',
    nodes: [
      { id: 'startingMana', name: 'Starting mana', effect: '+10 starting mana' },
      { id: 'maxLevel', name: 'Max level', effect: '+1 dragon level cap (maximum level 6)' },
      { id: 'moreEggs', name: 'More eggs', effect: '+1 starting egg (maximum 6)' },
      { id: 'iceDuration', name: 'Ice duration', effect: '+1 second Ice Freeze' },
      { id: 'foodFromKills', name: 'Food from kills', effect: '+2 food per kill' },
      { id: 'attackPower', name: 'Attack power', effect: '+5% poison dragon damage' },
    ],
  },
  ice: {
    name: 'Blue · Range',
    nodes: [
      { id: 'startingFood', name: 'Starting food', effect: '+25 starting food' },
      { id: 'maxLevel', name: 'Max level', effect: '+1 dragon level cap (maximum level 6)' },
      { id: 'moreCharges', name: 'More charges', effect: '+1 ice charge capacity' },
      { id: 'manaRegeneration', name: 'Mana regeneration', effect: '+10% mana regeneration' },
      { id: 'carrierDamage', name: 'Carrier damage', effect: '+10% damage against egg carriers' },
      { id: 'attackPower', name: 'Attack power', effect: '+5% ice dragon damage' },
    ],
  },
};

/** Save files store ranks by this order. Callers use node ids, not these indexes. */
export function nodeIndex(dragon: DragonType, id: UpgradeNodeId): number {
  const index = upgradeTrees[dragon].nodes.findIndex((node) => node.id === id);
  if (index < 0) throw new Error(`Upgrade ${id} is not on the ${dragon} tree.`);
  return index;
}

export const upgradeCost = (rank: number): number => 30 + rank * 20;
