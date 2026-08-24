import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { rootDir, zomboidDir } from './pzDir';

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const skipBuild = args.includes('--no-build');

const browserDir = join(rootDir, 'apps', 'browser');
const modSourceDir = join(rootDir, 'mod', 'PZDashboard');
const bundlePath = join(browserDir, 'dist', 'index.html');

const workshopDir = outArg === -1
  ? join(await zomboidDir(), 'Workshop', 'PZDashboard')
  : args[outArg + 1]!;
const modTargetDir = join(workshopDir, 'Contents', 'mods', 'PZDashboard');

if (!skipBuild) {
  const build = Bun.spawnSync(['bun', 'run', 'build'], { cwd: browserDir, stdout: 'inherit', stderr: 'inherit' });
  if (build.exitCode !== 0) throw new Error('apps/browser build failed');
}

const bundle = Bun.file(bundlePath);
if (!(await bundle.exists())) {
  throw new Error(`Missing ${bundlePath}. Run without --no-build, or build apps/browser first.`);
}

await rm(modTargetDir, { recursive: true, force: true });
await mkdir(modTargetDir, { recursive: true });
await cp(modSourceDir, modTargetDir, { recursive: true });
await Bun.write(join(modTargetDir, 'Dashboard.html'), bundle);

const workshopTxt = Bun.file(join(workshopDir, 'workshop.txt'));
if (!(await workshopTxt.exists())) {
  const description = [
    'Second-screen companion dashboard for Project Zomboid.',
    '',
    'The mod streams live game state to disk; Dashboard.html inside this mod folder is the whole interface - open it in Chrome or Edge on the machine running the game, no server and no network needed.',
    '',
    'Map with fog of war, live position and vehicles, health and 3D character model, every nearby container with item moving, skills and traits.',
    '',
    'Which categories stream, and how often, is set in Options > Mods > PZ Dashboard.',
  ].join('\n');

  const lines = [
    'version=1',
    'id=',
    'title=PZ Dashboard',
    ...description.split('\n').map((line) => `description=${line}`),
    'tags=Build 42;Interface;Misc',
    'visibility=public',
  ];
  await Bun.write(workshopTxt, lines.join('\r\n') + '\r\n');
  console.log(`Wrote ${workshopTxt.name}`);
}

if (!(await Bun.file(join(workshopDir, 'preview.png')).exists())) {
  console.warn(`Warning: no preview.png in ${workshopDir} - Steam needs one (256x256) before upload.`);
}
for (const art of ['poster.png', 'icon.png']) {
  if (!(await Bun.file(join(modTargetDir, art)).exists())) {
    console.warn(`Warning: mod has no ${art} - the in-game mod list will show a blank entry.`);
  }
}

console.log(`Packaged ${modSourceDir} + Dashboard.html -> ${modTargetDir}`);
console.log('Upload from the in-game Workshop > Create/Update Item screen.');
