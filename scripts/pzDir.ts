import { dirname, join, resolve } from 'node:path';

export const rootDir = resolve(import.meta.dir, '..');

function envValue(text: string, name: string): string | undefined {
  const raw = text.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1];
  if (!raw) return undefined;
  return raw.replace(/^("|')(.*)\1$/, '$2');
}

export async function zomboidDir(): Promise<string> {
  const envPath = join(rootDir, 'apps', 'server', '.env.local');
  const configuredEnv = await Bun.file(envPath).text().catch(() => '');
  const luaDir = process.env.PZ_LUA_DIR ?? envValue(configuredEnv, 'PZ_LUA_DIR');

  if (!luaDir) {
    throw new Error(`PZ_LUA_DIR is not set. Set it or add it to ${envPath}`);
  }

  const normalized = luaDir.replace(/\/$/, '');
  if (!normalized.endsWith('/Lua')) {
    throw new Error(`PZ_LUA_DIR must point to a Zomboid Lua directory: ${luaDir}`);
  }

  return dirname(normalized);
}
