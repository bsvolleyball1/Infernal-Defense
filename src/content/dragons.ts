import type { DragonType } from '../domain/model';

export interface DragonDefinition {
  name: string;
  cost: number;
  color: string;
  damage: number;
  rate: number;
  range: number;
  icon: string;
}

export const dragons: Record<DragonType, DragonDefinition> = {
  fire: { name: 'Ember', cost: 60, color: '#ee7959', damage: 27, rate: 680, range: 132, icon: '🐉' },
  ice: { name: 'Frost', cost: 55, color: '#81d0dc', damage: 8, rate: 820, range: 145, icon: '🐲' },
  poison: { name: 'Thorn', cost: 50, color: '#94c968', damage: 7, rate: 760, range: 125, icon: '🐉' },
};
