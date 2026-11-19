import yellow1 from '../assets/dragons/yellow-1.png';
import yellow2 from '../assets/dragons/yellow-2.png';
import yellow3 from '../assets/dragons/yellow-3.png';
import fire1 from '../assets/dragons/fire-1.png';
import fire2 from '../assets/dragons/fire-2.png';
import fire3 from '../assets/dragons/fire-3.png';
import ice1 from '../assets/dragons/ice-1.png';
import ice2 from '../assets/dragons/ice-2.png';
import ice3 from '../assets/dragons/ice-3.png';
import poison1 from '../assets/dragons/poison-1.png';
import poison2 from '../assets/dragons/poison-2.png';
import poison3 from '../assets/dragons/poison-3.png';
import white from '../assets/dragons/white.png';
import sun from '../assets/dragons/sun.png';
import orange from '../assets/dragons/orange.png';
import orange2 from '../assets/dragons/orange2.png';
import gray from '../assets/dragons/gray.png';
import purple from '../assets/dragons/purple.png';
import purple2 from '../assets/dragons/purple2.png';
import green from '../assets/dragons/green.png';
import green2 from '../assets/dragons/green2.png';
import black from '../assets/dragons/black.png';
import pink from '../assets/dragons/pink.png';
import bloodRed from '../assets/dragons/bloodRed.png';
import turquoise from '../assets/dragons/turquoise.png';
import type { DragonForm, DragonType } from '../game/types';

const portraits: Record<DragonType, readonly [string, string, string]> = {
  fire: [fire1, fire2, fire3],
  ice: [ice1, ice2, ice3],
  poison: [poison1, poison2, poison3],
};

export function dragonPortrait(type: DragonType, level = 1, evolved = false, form?: DragonForm): string {
  if (form === 'yellow') return yellow1;
  if (form === 'white') return white;
  if (form === 'sun') return sun;
  if (form === 'orange') return orange;
  if (form === 'orange2') return orange2;
  if (form === 'gray') return gray;
  if (form === 'purple') return purple;
  if (form === 'purple2') return purple2;
  if (form === 'green') return green2;
  if (form === 'green2') return green;
  if (form === 'black') return black;
  if (form === 'pink') return pink;
  if (form === 'bloodRed') return bloodRed;
  if (form === 'turquoise') return turquoise;
  const tier = Math.max(1, Math.min(3, Math.floor(level)));
  return (evolved && type === 'poison' ? [yellow1, yellow2, yellow3] : portraits[type])[tier - 1];
}
