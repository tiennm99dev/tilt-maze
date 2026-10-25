import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rapierManualWasm } from '../../vite.config.js';

// The build and Vitest pass without the plugin, so these checks are what
// notice a Rapier upgrade that renames or rewires the entry it replaces.
const entry = fileURLToPath(import.meta.resolve('@dimforge/rapier3d/rapier_wasm3d.js'));
const pkgDir = dirname(entry);

/** @returns {RegExp} */
function entryFilter() {
  const load = /** @type {{filter: {id: RegExp}}} */ (rapierManualWasm().load);
  return load.filter.id;
}

describe('rapierManualWasm', () => {
  it('matches the entry file as the build, Vitest and the dev server name it', () => {
    const filter = entryFilter();
    expect(filter.test(entry)).toBe(true);
    expect(filter.test(`${entry}?v=abc123`)).toBe(true);
    expect(filter.test(join(pkgDir, 'rapier_wasm3d_bg.js'))).toBe(false);
  });

  it('replaces a file that the package API still imports and that still imports the .wasm', () => {
    const raw = readFileSync(join(pkgDir, 'raw.js'), 'utf8');
    expect(raw).toMatch(/from\s+["']\.\/rapier_wasm3d(\.js)?["']/);
    const rapier = readFileSync(join(pkgDir, 'rapier.js'), 'utf8');
    expect(rapier).toMatch(/from\s+["']\.\/exports(\.js)?["']/);
    const exportsJs = readFileSync(join(pkgDir, 'exports.js'), 'utf8');
    expect(exportsJs).toMatch(/["']\.\/raw(\.js)?["']/);
    expect(readFileSync(entry, 'utf8')).toMatch(/from\s+["']\.\/rapier_wasm3d_bg\.wasm["']/);
  });
});
