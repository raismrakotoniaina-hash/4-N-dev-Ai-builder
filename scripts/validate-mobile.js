import { mkdtemp, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureMobileProject } from '../server/mobile-project.js';

const root = await mkdtemp(join(tmpdir(), '4ndev-expo-validation-'));
function run(command, args, timeout) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n').slice(-12000) || command + ' failed');
}
try {
  const files = ensureMobileProject([], 'TARGET PLATFORM: MOBILE. Validate Expo Android app', '4N DEV CI Mobile');
  for (const file of files) {
    const path = join(root, file.path);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, file.content, 'utf8');
  }
  run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], 600000);
  run('npm', ['exec', '--', 'expo', 'export', '--platform', 'android', '--output-dir', 'dist'], 600000);
  const output = await stat(join(root, 'dist'));
  if (!output.isDirectory()) throw new Error('Expo Android export did not produce a dist directory.');
  process.stdout.write('Expo Android JavaScript bundle export passed. This does not create a signed APK/AAB.\n');
} finally {
  await rm(root, { recursive: true, force: true });
}
