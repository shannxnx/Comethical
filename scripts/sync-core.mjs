// Copies the framework-free game core (src/core) into the Edge Functions shared folder,
// adding the explicit `.ts` import extensions Deno requires. Run after editing src/core:
//   npm run sync:core
// tests/core-sync.test.ts fails if the copies drift.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/core');
const dest = join(root, 'supabase/functions/_shared/core');

export const HEADER = '// GENERATED from src/core by `npm run sync:core`. Do not edit here.\n';

export function toDeno(source) {
  return HEADER + source.replace(/(from\s+'\.\/[A-Za-z0-9._-]+?)(?<!\.ts)'/g, "$1.ts'");
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.ts'));
for (const file of files) {
  writeFileSync(join(dest, file), toDeno(readFileSync(join(src, file), 'utf8')));
}
console.log(`Synced ${files.length} core files to supabase/functions/_shared/core`);
