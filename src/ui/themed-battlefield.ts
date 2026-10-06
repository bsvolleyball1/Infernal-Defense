import { routesFor } from '../content/catalog';
import type { Battlefield } from '../content/maps';
import { battlefieldLayers } from './battlefield-layers';

function meadowTerrain(): string {
  return `<defs>
    <linearGradient id="meadowFloor" x2="0" y2="1"><stop stop-color="#a5b980"/><stop offset="1" stop-color="#648262"/></linearGradient>
    <pattern id="meadowGrass" width="43" height="37" patternUnits="userSpaceOnUse"><path d="M9 27l-2-5m2 5 3-7M32 10l-3-5" stroke="#476b50" opacity=".35"/><circle cx="25" cy="29" r="1.8" fill="#edd997" opacity=".65"/></pattern>
    <g id="willow"><path d="M0 0L4-55M3-20L-18-38M3-34L23-49" fill="none" stroke="#5d6544" stroke-width="5"/><path d="M-32-52Q-30-89 5-83Q41-83 37-50L29-20 19-54 11-11 2-51-9-18-15-55-29-30Z" fill="#527451"/><path d="M-27-54Q-12-82 8-75Q31-73 33-53" fill="none" stroke="#91ab70" stroke-width="9"/></g>
  </defs><rect width="700" height="430" fill="url(#meadowFloor)"/>
  <path d="M-20 350Q120 250 220 318T450 380T720 345V430H0Z" fill="#72916a"/>
  <rect width="700" height="430" fill="url(#meadowGrass)"/>
  <path d="M-20 26Q155 1 260 41T465 30T720 28" fill="none" stroke="#486f63" stroke-width="41"/>
  <path d="M-20 26Q155 1 260 41T465 30T720 28" fill="none" stroke="#8ebbbb" stroke-width="27"/>
  <path d="M12 23Q104 7 170 23M400 33l55-10M549 25l48 0" fill="none" stroke="#d9e6c4" stroke-width="2" opacity=".7"/>
  <g><use href="#willow" x="43" y="90"/><use href="#willow" x="478" y="111"/><use href="#willow" x="60" y="359"/><use href="#willow" x="204" y="390"/></g>
  <g fill="#c0cf8d" stroke="#506f50" stroke-width="2"><ellipse cx="194" cy="248" rx="38" ry="22"/><ellipse cx="273" cy="325" rx="43" ry="25"/><ellipse cx="563" cy="81" rx="23" ry="13"/></g>
  <g fill="#edd997"><circle cx="189" cy="241" r="3"/><circle cx="207" cy="252" r="3"/><circle cx="277" cy="319" r="3"/><circle cx="258" cy="332" r="3"/></g>
  <path d="M41 400L43 382M76 400V379M112 400V378M34 388H122M34 396H122" fill="none" stroke="#d0bc83" stroke-width="4"/>
  <path d="M601 140L627 119H678L693 138V219L677 239H607Z" fill="#8aa079" stroke="#bcca91" stroke-width="3"/>`;
}

function volcanicTerrain(): string {
  return `<defs>
    <linearGradient id="obsidianFloor" x2="0" y2="1"><stop stop-color="#514559"/><stop offset="1" stop-color="#302e3e"/></linearGradient>
    <pattern id="obsidianTiles" width="53" height="46" patternUnits="userSpaceOnUse"><path d="M0 0H53V46H0ZM26 0V46" fill="none" stroke="#89778c" opacity=".12"/></pattern>
    <g id="basalt"><path d="M-19 9V-19L-7-33 10-31 22-17V13L5 22Z" fill="#242332" stroke="#68596f" stroke-width="2"/><path d="M-19-19L-7-33 10-31 22-17 5-8Z" fill="#796779"/><path d="M5-8V22M-7-33L-7-12" stroke="#a48a99" opacity=".5"/></g>
  </defs><rect width="700" height="430" fill="url(#obsidianFloor)"/>
  <rect width="700" height="430" fill="url(#obsidianTiles)"/>
  <path d="M0 13L112 24 198 9 291 20 402 7 520 22 700 9V0H0ZM0 417L102 405 223 423 322 409 426 425 522 410 700 422V430H0Z" fill="#221f2c"/>
  <path d="M316 177L366 159 416 176 397 207 433 232 392 253 338 238 322 212Z" fill="#201e2c" stroke="#786071" stroke-width="7"/>
  <path d="M343 180L363 189 381 180 371 211 404 228 377 236 357 219 343 229 352 202Z" fill="#e56e43"/>
  <path d="M357 188L364 200 360 216 378 224" fill="none" stroke="#ffd288" stroke-width="4"/>
  <g fill="none" stroke="#c05c49" stroke-width="3"><path d="M1 48l30 13 25-5 18 29M606 359l17 25 40-8 38 16M163 376l-19 15-47-3"/></g>
  <g><use href="#basalt" x="161" y="67"/><use href="#basalt" x="207" y="37"/><use href="#basalt" x="571" y="48"/><use href="#basalt" x="535" y="400"/><use href="#basalt" x="167" y="382"/><use href="#basalt" x="643" y="330"/></g>
  <path d="M603 163L625 147H693V261L671 277H600Z" fill="#5c4e60" stroke="#a38a91" stroke-width="3"/>
  <path d="M608 168H691M608 259H691M611 172V258M686 172V258" fill="none" stroke="#2c2738" stroke-width="7"/>
  <g fill="#df945f"><path d="M592 201l-4-16 7-13 5 15-2 14Z"/><path d="M681 276l-4-16 7-13 5 15-2 14Z"/></g>`;
}

/** New map scenery shares one route/entity layer, not simulation logic. */
export function themedBattlefield(map: Battlefield): string {
  const volcanic = map.theme === 'volcanic';
  const routes = routesFor(map).map(path => path.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '));
  const paths = (stroke: string, width: number, ids = false) => routes.map((d, i) =>
    `<path ${ids ? `id="battle-route${i ? '-'+i : ''}" class="battle-route" data-route="${i}"` : ''} d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `${volcanic ? volcanicTerrain() : meadowTerrain()}
    ${paths(volcanic ? '#292332' : '#486245', 48)}
    ${paths(volcanic ? '#8b7173' : '#b9aa79', 37, true)}
    ${paths(volcanic ? '#b69a90' : '#e0d0a0', 28)}
    <g transform="translate(18 ${map.path[0][1]})" fill="#f2e5bc"><path d="M0-10L13 0 0 10V4H-9V-4H0Z"/></g>
    ${volcanic ? '<g fill="#f3ce96"><path d="M210 171l9-16 4 11 11-3-10 17 0-12Z"/><path d="M210 259l9 16 4-11 11 3-10-17 0 12Z"/></g>' : ''}
    ${battlefieldLayers(map)}`;
}
