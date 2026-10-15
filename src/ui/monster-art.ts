import demon from '../assets/monsters/demon.png';
import devil from '../assets/monsters/devil.png';
import fury from '../assets/monsters/fury.png';
import gargoyle from '../assets/monsters/gargoyle.png';
import ghost from '../assets/monsters/ghost.png';
import hag from '../assets/monsters/hag.png';
import hellhound from '../assets/monsters/hellhound.png';
import imp from '../assets/monsters/imp.png';
import lich from '../assets/monsters/lich.png';
import necromancer from '../assets/monsters/necromancer.png';
import phantom from '../assets/monsters/phantom.png';
import seaSerpent from '../assets/monsters/seaSerpent.png';
import shade from '../assets/monsters/shade.png';
import skeleton from '../assets/monsters/skeleton.png';
import troll from '../assets/monsters/troll.png';
import witch from '../assets/monsters/witch.png';
import zombieTrain from '../assets/monsters/zombieTrain.png';
import type { MonsterKind } from '../game/types';

const portraits: Record<MonsterKind, string> = {
  scout: imp,
  shield: gargoyle,
  runner: seaSerpent,
  chief: devil,
  imp,
  seaSerpent,
  demon,
  hellhound,
  fury,
  devil,
  ghost,
  gargoyle,
  witch,
  hag,
  troll,
  necromancer,
  zombieTrain,
  lich,
  skeleton,
  phantom,
  shade,
};

export function monsterPortrait(kind: MonsterKind): string {
  return portraits[kind];
}
