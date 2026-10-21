import type { Battlefield } from '../content/maps';
import { battlefieldLayers } from './battlefield-layers';

/** Terrain is drawn directly in the device-shaped world; sprites and paths are never stretched. */
export function mobileBattlefieldArtwork(map: Battlefield, tutorial: boolean): string {
  const { width: w, height: h, theme, placementBounds: bounds } = map;
  const [floor, grain, tree] =
    theme === 'gorge'
      ? ['gorgeFloor', 'gorgeGrain', 'gorgePine']
      : theme === 'meadow'
        ? ['meadowFloor', 'meadowGrass', 'willow']
        : ['obsidianFloor', 'obsidianTiles', 'basalt'];
  const volcanic = theme === 'volcanic';
  const colors = volcanic
    ? ['#514559', '#302e3e', '#242332', '#796779']
    : theme === 'meadow'
      ? ['#a5b980', '#648262', '#527451', '#91ab70']
      : ['#52675b', '#2c4646', '#203c37', '#688574'];
  const routes = [map.path, ...map.forks].map((path) => path.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '));
  const roads = routes
    .map(
      (route, i) =>
        `<path d="${route}" fill="none" stroke="${volcanic ? '#292332' : '#293f3b'}" stroke-width="48" stroke-linejoin="round" stroke-linecap="round"/><path id="battle-route${i ? '-' + i : ''}" class="battle-route" d="${route}" fill="none" stroke="${volcanic ? '#8b7173' : '#958568'}" stroke-width="37" stroke-linejoin="round" stroke-linecap="round"/><path d="${route}" fill="none" stroke="${volcanic ? '#b69a90' : '#e1cea4'}" stroke-width="27" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join('');
  const water =
    theme === 'gorge'
      ? `<path d="M${w * 0.51} -50C${w * 0.4} ${h * 0.22} ${w * 0.61} ${h * 0.44} ${w * 0.53} ${h * 0.63}S${w * 0.45} ${h * 0.89} ${w * 0.52} ${h + 50}" fill="none" stroke="#698777" stroke-width="86"/><path d="M${w * 0.51} -50C${w * 0.4} ${h * 0.22} ${w * 0.61} ${h * 0.44} ${w * 0.53} ${h * 0.63}S${w * 0.45} ${h * 0.89} ${w * 0.52} ${h + 50}" fill="none" stroke="#3a797e" stroke-width="64"/>`
      : theme === 'meadow'
        ? `<path d="M-30 ${h * 0.12}Q${w * 0.25} ${h * 0.18} ${w * 0.5} ${h * 0.08}T${w + 30} ${h * 0.15}" fill="none" stroke="#8ebbbb" stroke-width="28"/><ellipse cx="${w * 0.55}" cy="${h * 0.75}" rx="${w * 0.09}" ry="${h * 0.09}" fill="#527b72" stroke="#91ab70" stroke-width="9"/>`
        : `<path d="M${w * 0.36} ${h * 0.49}L${w * 0.46} ${h * 0.37} ${w * 0.6} ${h * 0.45} ${w * 0.65} ${h * 0.59} ${w * 0.5} ${h * 0.64}Z" fill="#201e2c" stroke="#786071" stroke-width="7"/><path d="M${w * 0.42} ${h * 0.5}l${w * 0.08} -22 34 30 48 -18 -30 40 -55 -9Z" fill="#e56e43"/>`;
  const scenery = tutorial
    ? `<g id="tutorialTree" transform="translate(${w * 0.31} ${h * 0.8})" aria-hidden="true"><use href="#${tree}"/></g>`
    : '';
  return `<defs>
    <linearGradient id="${floor}" gradientUnits="userSpaceOnUse" x2="${w * 0.7}" y2="${h}"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>
    <pattern id="${grain}" width="43" height="37" patternUnits="userSpaceOnUse"><path d="M5 8l5-2M24 24l4-3" stroke="${colors[3]}" opacity=".22"/><circle cx="17" cy="15" r="1.4" fill="#dce1bc" opacity=".15"/></pattern>
    <g id="${tree}"><ellipse cy="14" rx="18" ry="6" fill="${colors[2]}" opacity=".4"/>${volcanic ? `<path d="M-19 9V-19L-7-33 10-31 22-17V13L5 22Z" fill="${colors[2]}" stroke="${colors[3]}" stroke-width="2"/>` : `<path d="M0-36L-18-8H-12L-24 12H-5V23H5V12H24L12-8H18Z" fill="${colors[2]}"/><path d="M0-36V12H24L12-8H18Z" fill="${colors[3]}" opacity=".4"/>`}</g>
  </defs><rect width="${w}" height="${h}" fill="url(#${floor})"/><rect width="${w}" height="${h}" fill="url(#${grain})"/>
  <path d="M0 0H${w}V24L${w * 0.86} 38 ${w * 0.73} 18 ${w * 0.55} 30 ${w * 0.37} 17 ${w * 0.18} 38 0 23Z" fill="${colors[2]}"/>
  <path d="M0 ${h}H${w}V${h - 21}L${w * 0.8} ${h - 35} ${w * 0.6} ${h - 15} ${w * 0.4} ${h - 38} ${w * 0.2} ${h - 20} 0 ${h - 35}Z" fill="${colors[2]}"/>
  ${water}${roads}
  ${[0.05, 0.18, 0.33, 0.69, 0.83, 0.96].map((x, i) => `<use href="#${tree}" x="${w * x}" y="${i % 2 ? bounds!.top - 20 : h - 35}"/>`).join('')}
  ${battlefieldLayers(map, scenery, true)}`;
}
