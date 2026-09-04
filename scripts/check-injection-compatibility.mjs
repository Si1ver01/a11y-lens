import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, firefox } from 'playwright';

const TIMEOUT_MS = 20_000;
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

function log(level, event, metadata = {}) {
  console.log(JSON.stringify({ level, scope: 'injection-compatibility', event, ...metadata }));
}

function waitForResult(results, target) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${target} injection result.`)),
      TIMEOUT_MS,
    );
    results.set(target, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function createFixtureServer() {
  const results = new Map();
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/result' || requestUrl.pathname === '/ready') {
      const target = requestUrl.searchParams.get('target');
      const expectedValue = requestUrl.pathname === '/result' ? 'injected' : 'supported';
      const actualValue =
        requestUrl.pathname === '/result'
          ? requestUrl.searchParams.get('marker')
          : requestUrl.searchParams.get('scripting');
      if (target && actualValue === expectedValue) {
        log('DEBUG', 'fixture-signal-received', {
          target,
          signal: requestUrl.pathname === '/result' ? 'injection-result' : 'runtime-ready',
        });
        results.get(`${requestUrl.pathname}:${target}`)?.();
      }
      response.writeHead(204).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body><main>Compatibility fixture</main></body></html>');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Fixture server address is unavailable.');

  return {
    results,
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function createProbeExtension(root, target, fixtureUrl) {
  const extensionDirectory = path.join(root, target);
  await mkdir(extensionDirectory, { recursive: true });

  const manifest = {
    manifest_version: 3,
    name: `a11y-lens ${target} injection probe`,
    version: '0.0.0',
    permissions: ['scripting', 'tabs'],
    host_permissions: ['http://127.0.0.1/*'],
    background:
      target === 'chromium'
        ? { service_worker: 'background.js', type: 'module' }
        : { scripts: ['background.js'] },
    ...(target === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'a11y-lens-injection-probe@si1ver01.dev',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  };
  const background = `
const extensionApi = globalThis.browser ?? globalThis.chrome;
const injectedTabs = new Set();
void fetch('${fixtureUrl}ready?target=${target}&scripting=' + (extensionApi.scripting?.executeScript ? 'supported' : 'unsupported'));
async function injectIntoFixture(tabId, tabUrl) {
  if (!tabUrl) return;
  let pageUrl;
  try {
    pageUrl = new URL(tabUrl);
  } catch {
    return;
  }
  if (pageUrl.hostname !== '127.0.0.1') return;
  if (injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  await extensionApi.scripting.executeScript({
    target: { tabId },
    files: ['probe.js'],
  });
}
extensionApi.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  await injectIntoFixture(tabId, tab.url);
});
void extensionApi.tabs.query({}).then((tabs) => {
  for (const tab of tabs) {
    if (tab.id !== undefined) void injectIntoFixture(tab.id, tab.url);
  }
});
`;
  const probe = `
document.documentElement.dataset.a11yLensProbe = 'injected';
const target = new URL(location.href).searchParams.get('target');
void fetch('${fixtureUrl}result?target=' + encodeURIComponent(target ?? '') + '&marker=' + document.documentElement.dataset.a11yLensProbe);
`;

  await Promise.all([
    writeFile(path.join(extensionDirectory, 'manifest.json'), JSON.stringify(manifest)),
    writeFile(path.join(extensionDirectory, 'background.js'), background),
    writeFile(path.join(extensionDirectory, 'probe.js'), probe),
  ]);
  return extensionDirectory;
}

async function checkChromium(extensionDirectory, fixtureUrl, resultPromise, profileDirectory) {
  const context = await chromium.launchPersistentContext(profileDirectory, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionDirectory}`,
      `--load-extension=${extensionDirectory}`,
    ],
  });
  try {
    if (context.serviceWorkers().length === 0) {
      await context.waitForEvent('serviceworker', { timeout: TIMEOUT_MS });
    }
    log('DEBUG', 'extension-runtime-ready', { target: 'chromium' });
    const page = await context.newPage();
    await page.goto(`${fixtureUrl}?target=chromium`);
    await resultPromise;
    log('INFO', 'runtime-injection-passed', { target: 'chromium' });
  } finally {
    await context.close();
  }
}

async function checkFirefox(extensionDirectory, fixtureUrl, readyPromise, resultPromise) {
  const webExtPath = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'web-ext');
  const childProcess = spawn(
    webExtPath,
    [
      'run',
      '--source-dir',
      extensionDirectory,
      '--firefox',
      firefox.executablePath(),
      '--start-url',
      `${fixtureUrl}?target=firefox`,
      '--arg=-headless',
      '--no-input',
      '--no-reload',
    ],
    { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let diagnostics = '';
  childProcess.stdout.on('data', (chunk) => {
    diagnostics += String(chunk);
  });
  childProcess.stderr.on('data', (chunk) => {
    diagnostics += String(chunk);
  });
  const earlyExit = new Promise((_, reject) => {
    const rejectWithExitCode = (code) =>
      reject(new Error(`Firefox exited before injection completed (code ${String(code)}).`));
    if (childProcess.exitCode !== null) rejectWithExitCode(childProcess.exitCode);
    else childProcess.once('exit', rejectWithExitCode);
  });
  try {
    await Promise.race([Promise.all([readyPromise, resultPromise]), earlyExit]);
    log('DEBUG', 'extension-runtime-ready', { target: 'firefox' });
    log('INFO', 'runtime-injection-passed', { target: 'firefox' });
  } catch (error) {
    log('ERROR', 'runtime-injection-failed', {
      target: 'firefox',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      addonInstalled: /temporary add-on|extension loaded/i.test(diagnostics),
      hasError: /\berror\b/i.test(diagnostics),
      invalidOption: /unexpected option|unknown (?:option|argument)|not recognized/i.test(
        diagnostics,
      ),
      launchStarted: /launching firefox|running web extension/i.test(diagnostics),
      manifestError: /manifest.*(?:error|invalid)|could not install/i.test(diagnostics),
      exitCode: childProcess.exitCode,
      processExited: childProcess.exitCode !== null,
    });
    throw error;
  } finally {
    childProcess.kill('SIGTERM');
  }
}

async function main() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'a11y-lens-injection-'));
  const fixture = await createFixtureServer();
  let stage = 'setup';
  try {
    const [chromiumExtension, firefoxExtension] = await Promise.all([
      createProbeExtension(temporaryRoot, 'chromium', fixture.url),
      createProbeExtension(temporaryRoot, 'firefox', fixture.url),
    ]);
    stage = 'chromium';
    const chromiumResult = waitForResult(fixture.results, '/result:chromium');
    await checkChromium(
      chromiumExtension,
      fixture.url,
      chromiumResult,
      path.join(temporaryRoot, 'chromium-profile'),
    );
    stage = 'firefox';
    const firefoxReady = waitForResult(fixture.results, '/ready:firefox');
    const firefoxResult = waitForResult(fixture.results, '/result:firefox');
    await checkFirefox(firefoxExtension, fixture.url, firefoxReady, firefoxResult);
    stage = 'complete';
  } catch (error) {
    log('ERROR', 'compatibility-check-failed', {
      stage,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  } finally {
    await fixture.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  log('ERROR', 'compatibility-check-exited', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
