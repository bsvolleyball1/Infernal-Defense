import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { nextGameSpeed } from '../src/ui/controls';
import { isMenuPage } from '../src/ui/menus';

const sourceRoot = resolve('src');
const domainPaths = [
  ...readdirSync(resolve(sourceRoot, 'game')).filter(name => name.endsWith('.ts'))
    .map(name => resolve(sourceRoot, 'game', name)),
  ...readdirSync(resolve(sourceRoot, 'content')).filter(name => name.endsWith('.ts'))
    .map(name => resolve(sourceRoot, 'content', name)),
];

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

function dependencies(source: ts.SourceFile, runtimeOnly = false): string[] {
  const result: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    if (runtimeOnly && (ts.isImportDeclaration(statement)
      ? statement.importClause?.isTypeOnly : statement.isTypeOnly)) continue;
    result.push(specifier.text);
  }
  return result;
}

describe('CLEAN architecture boundaries', () => {
  it('keeps domain imports inside game/content, without framework or adapter dependencies', () => {
    for (const path of domainPaths) {
      for (const dependency of dependencies(parse(path))) {
        expect(dependency, path).toMatch(/^\.{1,2}\//);
        expect(domainPaths, `${path} imports ${dependency}`).toContain(resolve(dirname(path), `${dependency}.ts`));
      }
    }
  });

  it('keeps browser globals, audio, storage, clocks, and nondeterministic randomness out of simulation', () => {
    const forbidden = new Set([
      'window', 'document', 'localStorage', 'sessionStorage', 'AudioContext', 'performance',
      'Date', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Storage', 'HTMLElement', 'SVGElement',
    ]);
    for (const path of domainPaths) {
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node)) expect(forbidden.has(node.text), `${path}: ${node.text}`).toBe(false);
        if (ts.isPropertyAccessExpression(node)) {
          expect(node.getText(), path).not.toBe('Math.random');
        }
        ts.forEachChild(node, visit);
      };
      visit(parse(path));
    }
  });

  it('has no runtime circular dependencies in the domain', () => {
    const visited = new Set<string>();
    function visit(path: string, ancestors: string[]): void {
      expect(ancestors, `Circular domain dependency: ${[...ancestors, path].join(' -> ')}`).not.toContain(path);
      if (visited.has(path)) return;
      for (const dependency of dependencies(parse(path), true)) {
        visit(resolve(dirname(path), `${dependency}.ts`), [...ancestors, path]);
      }
      visited.add(path);
    }
    domainPaths.forEach(path => visit(path, []));
  });

  it('makes runtime depend on the engine contract rather than its concrete class', () => {
    const runtime = parse(resolve(sourceRoot, 'app/runtime.ts'));
    expect(dependencies(runtime)).toEqual(['../game/types']);
    expect(runtime.getText()).toContain('engine: SimulationEngine');
  });
});

describe('typed UI routing and controls', () => {
  it.each([1, 1.5, 2] as const)('cycles supported speed %s without adding a new speed', speed => {
    expect(nextGameSpeed(speed)).toBe(speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1);
  });

  it('recognizes all menu routes and rejects unknown browser-provided values', () => {
    expect(['home', 'bestiary', 'options', 'saves', 'levels', 'upgrades'].every(isMenuPage)).toBe(true);
    expect(['battle', 'toString', '', undefined, null, 1].some(isMenuPage)).toBe(false);
  });
});
