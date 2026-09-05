import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['chrome-mv3', 'firefox-mv3'];
const requiredFiles = [
  'manifest.json',
  'popup.html',
  'content-scripts/content.js',
  'icon/16.png',
  'icon/32.png',
  'icon/48.png',
  'icon/128.png',
];

console.log('[FIX:security-gates] Checking required files in browser packages.');

async function assertFile(filePath, label) {
  try {
    const details = await stat(filePath);
    if (!details.isFile() || details.size === 0) throw new Error('empty or not a regular file');
  } catch (error) {
    throw new Error(
      `${label} is missing or invalid: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

try {
  for (const target of targets) {
    const outputDirectory = path.join(projectRoot, '.output', target);
    await assertFile(path.join(outputDirectory, 'manifest.json'), `${target}/manifest.json`);
    for (const requiredFile of requiredFiles.slice(1)) {
      await assertFile(path.join(outputDirectory, requiredFile), `${target}/${requiredFile}`);
    }
  }
  console.log('[EXTENSION] Chromium and Firefox packages contain all required files.');
  console.log('[FIX:security-gates] Extension package gate completed.');
} catch (error) {
  console.error(`[EXTENSION] ${error instanceof Error ? error.message : 'Unknown failure.'}`);
  process.exitCode = 1;
}
