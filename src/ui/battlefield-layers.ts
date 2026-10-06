import type { Battlefield } from '../content/maps';

/** Shared roost/entity layers keep every map compatible with controls and renderer. */
export function battlefieldLayers(map: Battlefield): string {
  const volcanic = map.theme === 'volcanic';
  const roosts = map.perches.map(({ x, y }, index) => `
    <g class="perch" role="button" tabindex="0" data-id="${index}" transform="translate(${x} ${y})">
      <circle r="27" fill="${volcanic ? '#746179' : '#72877a'}" stroke="#d4b577" stroke-width="2"/>
      <path d="M-21-12L0-24 21-12 21 12 0 24-21 12Z" fill="none" stroke="#dce1bf" opacity=".35"/>
      <circle r="19" fill="${volcanic ? '#382e46' : '#334d49'}"/>
      <text text-anchor="middle" y="6" font-size="17" fill="#f4e9c8">✦</text>
      <text class="roost-number" text-anchor="middle" y="-34" font-size="9" fill="#f4e9c8">${index + 1}</text>
      <circle class="perch-hit" r="27" fill="transparent" pointer-events="all"/>
    </g>`).join('');
  return `<g id="effects"></g><g id="enemies"></g><g id="perches">${roosts}</g>
    <g id="nest" transform="translate(${map.nest.x} ${map.nest.y})"><ellipse cy="19" rx="29" ry="13" fill="#293f3b" opacity=".65"/><path d="M-28 6L-20-5 19-5 29 7 23 24-21 24Z" fill="${volcanic ? '#725567' : '#695c41'}" stroke="#d5bd7c" stroke-width="2"/><ellipse cy="7" rx="21" ry="11" fill="#a98d54"/><path d="M-25 7q25 30 50 0M-23 17l46 0" fill="none" stroke="#e5c583" stroke-width="2"/><text id="nestCount" y="-16" text-anchor="middle" font-size="10" fill="#fff1ca" font-weight="700">5 in nest</text></g>
    <g id="eggObjects"></g><g id="floaters"></g>`;
}
