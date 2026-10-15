import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { nextGameSpeed } from '../src/ui/controls';
import { isMenuPage } from '../src/ui/menus';

function tsFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return tsFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const sourceRoot = resolve('src');
const layerNames = ['game', 'content', 'domain'] as const;
const layerPaths = layerNames.flatMap((layer) => tsFiles(resolve(sourceRoot, layer)));
const domainPaths = layerPaths;

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

function dependencies(source: ts.SourceFile, runtimeOnly = false): string[] {
  const result: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    if (runtimeOnly && (ts.isImportDeclaration(statement) ? statement.importClause?.isTypeOnly : statement.isTypeOnly))
      continue;
    result.push(specifier.text);
  }
  return result;
}

/** Declared type text of every variable, parameter or property with this name, read from the AST. */
function declaredTypes(source: ts.SourceFile, name: string): string[] {
  const types: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertySignature(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.type
    ) {
      types.push(node.type.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return types;
}

function sourcePaths(directory: string): string[] {
  return readdirSync(resolve(sourceRoot, directory))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => resolve(sourceRoot, directory, file));
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
      'window',
      'document',
      'localStorage',
      'sessionStorage',
      'AudioContext',
      'performance',
      'Date',
      'setTimeout',
      'setInterval',
      'requestAnimationFrame',
      'Storage',
      'HTMLElement',
      'SVGElement',
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
    domainPaths.forEach((path) => visit(path, []));
  });

  it('makes runtime depend on the engine contract rather than its concrete class', () => {
    const runtime = parse(resolve(sourceRoot, 'app/runtime.ts'));
    expect(dependencies(runtime)).toEqual(['../game/types']);
    expect(declaredTypes(runtime, 'engine')).toEqual(['SimulationEngine']);
  });

  it('holds the composition root engine and renderer by their contracts', () => {
    const application = parse(resolve(sourceRoot, 'app/application.ts'));
    expect(declaredTypes(application, 'engine')).toEqual(['SimulationEngine']);
    expect(declaredTypes(application, 'renderer')).toEqual(['Renderer']);
  });

  it('keeps content from depending on the simulation', () => {
    const contentPaths = layerPaths.filter((path) => path.includes(`${resolve(sourceRoot, 'content')}`));
    for (const path of contentPaths) {
      for (const dependency of dependencies(parse(path))) {
        expect(dependency, path).not.toMatch(/^\.\.\/game(\/|$)/);
      }
    }
  });

  it('keeps shared vocabulary free of game and content imports', () => {
    const vocabulary = layerPaths.filter((path) => path.includes(`${resolve(sourceRoot, 'domain')}`));
    for (const path of vocabulary) {
      expect(dependencies(parse(path)), path).toEqual([]);
    }
  });

  it('keeps the legacy ruleset from importing the defense simulation', () => {
    const legacy = layerPaths.filter((path) => path.includes(`${resolve(sourceRoot, 'game', 'legacy')}`));
    expect(legacy.length).toBeGreaterThan(0);
    for (const path of legacy) {
      for (const dependency of dependencies(parse(path))) {
        expect(dependency, path).not.toMatch(/defense-/);
      }
    }
    const defense = parse(resolve(sourceRoot, 'game/defense-simulation.ts'));
    expect(dependencies(defense).some((dependency) => dependency.includes('legacy'))).toBe(false);
  });

  it('keeps defense controls outside the SVG renderer', () => {
    expect(dependencies(parse(resolve(sourceRoot, 'ui/renderer.ts')))).not.toContain('./defense-controls');
  });
});

describe('typed UI routing and controls', () => {
  it.each([1, 1.5, 2] as const)('cycles supported speed %s without adding a new speed', (speed) => {
    expect(nextGameSpeed(speed)).toBe(speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1);
  });

  it('recognizes all menu routes and rejects unknown browser-provided values', () => {
    expect(['home', 'bestiary', 'options', 'saves', 'levels', 'upgrades'].every(isMenuPage)).toBe(true);
    expect(['battle', 'toString', '', undefined, null, 1].some(isMenuPage)).toBe(false);
  });

  it('keeps adapters in services/ independent of the UI', () => {
    for (const path of sourcePaths('services')) {
      for (const dependency of dependencies(parse(path))) expect(dependency, path).not.toMatch(/(^|\/)ui\//);
    }
  });

  // Enforced once phase 5 (#17) adds selectors.
  it.todo('lets ui/ import game/ only through selectors and view-models');
});
