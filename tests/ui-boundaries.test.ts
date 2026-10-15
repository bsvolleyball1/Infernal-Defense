import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve('src/ui', path), 'utf8');

describe('presentation boundaries', () => {
  it('keeps input handling out of the SVG renderer', () => {
    expect(source('renderer.ts')).not.toContain('addEventListener');
  });

  it('registers battlefield map listeners in one module', () => {
    const owners = [
      'controls.ts',
      'defense-controls.ts',
      'renderer.ts',
      'tower-actions.ts',
      'battlefield-input.ts',
    ].filter((file) => /map\.addEventListener/.test(source(file)));
    expect(owners).toEqual(['battlefield-input.ts']);
  });

  it('keeps static structure in the template rather than runtime patches', () => {
    for (const file of ['mount.ts', 'renderer.ts']) expect(source(file), file).not.toMatch(/document\.createElement\(/);
  });
});
