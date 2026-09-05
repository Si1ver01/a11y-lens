import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputTargets = [
  { name: 'chromium', directory: 'chrome-mv3' },
  { name: 'firefox', directory: 'firefox-mv3' },
];
const expectedPermissions = ['activeTab', 'scripting'];
const expectedCsp = "script-src 'self'; object-src 'none'; base-uri 'none'";

console.log('[FIX:security-gates] Checking Chromium and Firefox manifest constraints.');

function fail(message) {
  throw new Error(`[MANIFEST] ${message}`);
}

async function readManifest(target) {
  const manifestPath = path.join(projectRoot, '.output', target.directory, 'manifest.json');
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail(
      `Could not read ${target.name} manifest: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

function assertManifest(target, manifest) {
  if (manifest.manifest_version !== 3) fail(`${target.name} must use Manifest V3.`);
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPermissions)) {
    fail(`${target.name} permissions must be exactly activeTab and scripting.`);
  }
  if ('host_permissions' in manifest) fail(`${target.name} must not request host_permissions.`);
  if ('optional_host_permissions' in manifest) {
    fail(`${target.name} must not request optional_host_permissions.`);
  }
  if (manifest.content_security_policy?.extension_pages !== expectedCsp) {
    fail(`${target.name} has an unexpected extension_pages CSP.`);
  }
  for (const size of [16, 32, 48, 128]) {
    if (manifest.icons?.[size] !== `icon/${size}.png`) {
      fail(`${target.name} must declare icon/${size}.png.`);
    }
  }
  if (target.name === 'firefox') {
    const gecko = manifest.browser_specific_settings?.gecko;
    if (gecko?.id !== 'a11y-lens@si1ver01.dev') fail('Firefox Gecko ID is missing or changed.');
    if (JSON.stringify(gecko.data_collection_permissions?.required) !== JSON.stringify(['none'])) {
      fail('Firefox data collection permissions must remain none.');
    }
  }
}

try {
  for (const target of outputTargets) assertManifest(target, await readManifest(target));
  console.log('[MANIFEST] Chromium and Firefox manifests passed security checks.');
  console.log('[FIX:security-gates] Manifest security gate completed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : '[MANIFEST] Unknown failure.');
  process.exitCode = 1;
}
