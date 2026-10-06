import { getMap } from '../content/catalog';
import type { Level } from '../game/types';
import type { Battlefield } from '../content/maps';
import { themedBattlefield } from './themed-battlefield';
import { battlefieldLayers } from './battlefield-layers';

/** Map artwork is vector-native, offline, and aligned with simulation geometry. */
export function battlefieldArtwork(level: Level = 'level1'): string {
  const geometry = getMap(level);
  return geometry.theme === 'gorge' ? gorgeArtwork(geometry) : themedBattlefield(geometry);
}

function gorgeArtwork(map: Battlefield): string {
  const route = map.path.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

  return `
  <defs>
    <linearGradient id="gorgeFloor" x2=".7" y2="1"><stop stop-color="#52675b"/><stop offset="1" stop-color="#2c4646"/></linearGradient>
    <linearGradient id="gorgeWater" x2="1" y2=".5"><stop stop-color="#214f54"/><stop offset=".5" stop-color="#4e9190"/><stop offset="1" stop-color="#173c45"/></linearGradient>
    <pattern id="gorgeGrain" width="37" height="31" patternUnits="userSpaceOnUse"><path d="M5 8l5-2M24 24l4-3" stroke="#c5cda0" stroke-width="1" opacity=".16"/><circle cx="17" cy="15" r="1.2" fill="#dce1bc" opacity=".13"/></pattern>
    <g id="gorgePine"><ellipse cy="14" rx="13" ry="5" fill="#152f30" opacity=".4"/><path d="M0-30L-14-7H-9L-19 8H-5V17H5V8H19L9-7H14Z" fill="#203c37"/><path d="M0-30L0 8H19L9-7H14Z" fill="#335749"/><path d="M-5-5L0-14 5-5" fill="#688574"/></g>
    <g id="gorgeRock"><path d="M-16 3L-10-9 4-13 17-2 12 10-5 13Z" fill="#63736a" stroke="#263f40" stroke-width="2"/><path d="M-10-9L4-13 17-2 1 2Z" fill="#879187"/><path d="M1 2L-5 13" stroke="#344c49"/></g>
  </defs>
  <rect width="700" height="430" fill="url(#gorgeFloor)"/>
  <rect width="700" height="430" fill="url(#gorgeGrain)"/>
  <path d="M0 0H700V27L652 43 606 27 564 47 491 29 456 48 363 31 325 19 261 35 219 17 154 28 91 13 0 43Z" fill="#223b3d"/>
  <path d="M0 0H700V12L652 28 606 12 564 32 491 14 456 33 363 16 325 4 261 20 219 2 154 13 91 0 0 28Z" fill="#778477"/>
  <path d="M0 365L45 355 93 378 157 373 179 399 247 387 292 415 337 397 382 418 441 403 482 427 548 409 597 421 657 388 700 399V430H0Z" fill="#203b3d"/>
  <path d="M0 363L45 351 93 373 157 366 179 392 247 382 292 408 337 390 382 411 441 396 482 420 548 402 597 414 657 381 700 392" fill="none" stroke="#859485" stroke-width="5"/>
  <path d="M355-30C322 74 428 125 413 190S330 258 341 330 294 393 309 470" fill="none" stroke="#203b3d" stroke-width="92"/>
  <path d="M355-30C322 74 428 125 413 190S330 258 341 330 294 393 309 470" fill="none" stroke="#698777" stroke-width="76"/>
  <path d="M355-30C322 74 428 125 413 190S330 258 341 330 294 393 309 470" fill="none" stroke="url(#gorgeWater)" stroke-width="63"/>
  <g fill="none" stroke="#a9d6c1" opacity=".4" stroke-linecap="round"><path d="M346 27q-8 23 0 40M375 103q14 7 21 20M402 176q0 19-9 30M364 253q-14 16-14 29M329 365q-8 15-10 29" stroke-width="2"/><path d="M358 44l-2 9M384 138l8 5M379 224l-8 8M344 314l2 14M305 418l1 10"/></g>
  <path d="M560 34L608 23 693 42 700 129 675 144 619 121 563 102Z" fill="#2a4443"/>
  <path d="M561 30L609 18 696 36 698 104 672 120 620 98 563 88Z" fill="#778779" stroke="#9da58b" stroke-width="2"/>
  <g opacity=".65"><path d="M573 106l10 14 34 10M633 119l19 15 32-5M574 36l28-8 18 6" fill="none" stroke="#cf824b" stroke-width="2"/><path d="M19 51l27 13 7 29M672 314l-21 16 9 26M72 405l17-8 27 10" fill="none" stroke="#c58351" stroke-width="3"/></g>
  <g><use href="#gorgePine" x="38" y="114"/><use href="#gorgePine" x="51" y="166"/><use href="#gorgePine" x="44" y="230"/><use href="#gorgePine" x="249" y="32"/><use href="#gorgePine" x="277" y="41"/><use href="#gorgePine" x="272" y="290"/><use href="#gorgePine" x="206" y="397"/><use href="#gorgePine" x="632" y="270"/><use href="#gorgePine" x="672" y="232"/><use href="#gorgePine" x="655" y="374"/></g>
  <g><use href="#gorgeRock" x="48" y="48"/><use href="#gorgeRock" x="201" y="36"/><use href="#gorgeRock" x="248" y="238"/><use href="#gorgeRock" x="456" y="236"/><use href="#gorgeRock" x="553" y="397"/><use href="#gorgeRock" x="669" y="160"/></g>
  <path id="battle-route-bed" d="${route}" fill="none" stroke="#293f3b" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
  <path id="battle-route" d="${route}" fill="none" stroke="#958568" stroke-width="37" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${route}" fill="none" stroke="#c7b48a" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${route}" fill="none" stroke="#e1cea4" stroke-width="2" stroke-dasharray="2 15" opacity=".55"/>
  <g transform="translate(334 290) rotate(58)"><rect x="-46" y="-21" width="92" height="42" rx="3" fill="#3a3930"/><path d="M-42-17H42V17H-42Z" fill="#a18b63"/><path d="M-34-18V18M-22-18V18M-10-18V18M2-18V18M14-18V18M26-18V18M38-18V18" stroke="#695c45" stroke-width="3"/><path d="M-49-23H49M-49 23H49" stroke="#dfcba0" stroke-width="4"/></g>
  <g transform="translate(17 300)" fill="#293f3b"><path d="M0-22L-5-15V15L0 22H8V-22Z"/><path d="M16-10L28 0 16 10V5H7V-5H16Z" fill="#e7d7ad"/></g>
  ${battlefieldLayers(map)}`;
}
