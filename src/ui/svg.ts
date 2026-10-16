const NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

/** Parses markup in the SVG namespace. innerHTML on a detached SVG node does not. */
function appendMarkup(parent: SVGElement, markup: string): void {
  const parsed = new DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, 'image/svg+xml');
  for (const child of [...parsed.documentElement.childNodes]) parent.appendChild(child);
}

export function node<T extends SVGElement = SVGElement>(tag: string, markup = ''): T {
  const created = document.createElementNS(NS, tag) as T;
  if (markup) appendMarkup(created, markup);
  return created;
}

export function attr(n: Element, name: string, value: string | number): void {
  const text = String(value);
  if (n.getAttribute(name) !== text) n.setAttribute(name, text);
}

export function setPortrait(image: Element, url: string): void {
  image.setAttribute('href', url);
  image.setAttributeNS(XLINK, 'href', url);
}
