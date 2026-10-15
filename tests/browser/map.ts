import type { Page } from '@playwright/test';

export async function clickMapAt(page: Page, x: number, y: number): Promise<void> {
  const screenPoint = await mapScreenPoint(page, x, y);
  await page.mouse.click(screenPoint.x, screenPoint.y);
}

export async function movePointerToMap(page: Page, x: number, y: number): Promise<void> {
  const screenPoint = await mapScreenPoint(page, x, y);
  await page.mouse.move(screenPoint.x, screenPoint.y);
}

async function mapScreenPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.locator('#map').evaluate((svg: SVGSVGElement, point) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('Map is not rendered');
    return new DOMPoint(point.x, point.y).matrixTransform(matrix).toJSON();
  }, { x, y });
}
