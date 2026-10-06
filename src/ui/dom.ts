export function element<T extends Element = HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing interface element: ${selector}`);
  return result;
}

export function elements<T extends Element = HTMLElement>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}

export function setText(selector: string, value: string | number): void {
  const node = element(selector);
  const text = String(value);
  if (node.textContent !== text) node.textContent = text;
}
