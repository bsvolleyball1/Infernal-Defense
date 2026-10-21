export type DragonType = 'fire' | 'ice' | 'poison';
export type DragonColor = 'red' | 'blue' | 'yellow';
export type DragonForm =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'red2'
  | 'purple'
  | 'orange'
  | 'blue2'
  | 'green'
  | 'yellow2'
  | 'red3'
  | 'bloodRed'
  | 'pink'
  | 'blue3'
  | 'black'
  | 'gray'
  | 'yellow3'
  | 'sun'
  | 'turquoise'
  | 'white'
  | 'purple2'
  | 'orange2'
  | 'green2';
export type MonsterKind =
  | 'scout'
  | 'shield'
  | 'runner'
  | 'chief'
  | 'imp'
  | 'seaSerpent'
  | 'demon'
  | 'hellhound'
  | 'fury'
  | 'devil'
  | 'ghost'
  | 'gargoyle'
  | 'witch'
  | 'hag'
  | 'troll'
  | 'necromancer'
  | 'zombieTrain'
  | 'lich'
  | 'skeleton'
  | 'phantom'
  | 'shade';
export type SpellKind = 'poison' | 'ice' | 'fire';
export type Level =
  | 'level1'
  | 'tutorial'
  | 'meadow'
  | 'volcanic'
  | 'fireTrial'
  | 'iceTrial'
  | 'poisonTrial'
  | 'noPoisonTrial'
  | 'noIceTrial'
  | 'noFireTrial';

export type DefenseProfile = 'defense-1' | 'defense-2';

/** Authored mobile-map dimensions are saved so an active battle never changes under its towers. */
export interface MobileMapLayout {
  version: 1;
  width: number;
  height: number;
  insets: { top: number; right: number; bottom: number; left: number };
}
