import fire1 from '../assets/dragons/fire-1.png';
import fire2 from '../assets/dragons/fire-2.png';
import fire3 from '../assets/dragons/fire-3.png';
import ice1 from '../assets/dragons/ice-1.png';
import ice2 from '../assets/dragons/ice-2.png';
import ice3 from '../assets/dragons/ice-3.png';
import poison1 from '../assets/dragons/yellow-1.png';
import poison2 from '../assets/dragons/yellow-2.png';
import poison3 from '../assets/dragons/yellow-3.png';
import type { DragonType } from '../game/types';

const portraits: Record<DragonType, readonly [string, string, string]> = {
  fire: [fire1, fire2, fire3],
  ice: [ice1, ice2, ice3],
  poison: [poison1, poison2, poison3],
};

export function dragonPortrait(type: DragonType, level = 1): string {
  const tier = Math.max(1, Math.min(3, Math.floor(level)));
  return portraits[type][tier - 1];
}
