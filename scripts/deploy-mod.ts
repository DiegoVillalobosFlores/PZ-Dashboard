import { cp, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const rootDir = resolve(import.meta.dir, '..');
const envPath = join(rootDir, 'apps', 'server', '.env.local');
const sourceDir = join(rootDir, 'mod', 'PZDashboard');

function envValue(text: string, name: string): string | undefined {
  const raw = text.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1];
  if (!raw) return undefined;
  return raw.replace(/^("|')(.*)\1$/, '$2');
}

const configuredEnv = await Bun.file(envPath).text().catch(() => '');
const luaDir = process.env.PZ_LUA_DIR ?? envValue(configuredEnv, 'PZ_LUA_DIR');

if (!luaDir) {
  throw new Error(`PZ_LUA_DIR is not set. Set it or add it to ${envPath}`);
}

const normalizedLuaDir = luaDir.replace(/\/$/, '');
if (!normalizedLuaDir.endsWith('/Lua')) {
  throw new Error(`PZ_LUA_DIR must point to a Zomboid Lua directory: ${luaDir}`);
}

const targetDir = join(dirname(normalizedLuaDir), 'mods', 'PZDashboard');
await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });
console.log(`Deployed ${sourceDir} -> ${targetDir}`);
