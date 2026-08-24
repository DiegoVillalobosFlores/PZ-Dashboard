import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { rootDir, zomboidDir } from './pzDir';

const sourceDir = join(rootDir, 'mod', 'PZDashboard');
const targetDir = join(await zomboidDir(), 'mods', 'PZDashboard');

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });
console.log(`Deployed ${sourceDir} -> ${targetDir}`);
