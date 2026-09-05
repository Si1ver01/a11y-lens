import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const webExtVersion = packageJson.devDependencies?.['web-ext'];

console.log('[FIX:security-gates] Checking production dependencies and web-ext baseline.');

function fail(message) {
  console.error(`[SECURITY] ${message}`);
  process.exitCode = 1;
}

function parseAuditOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    fail('npm audit returned non-JSON output. Check registry connectivity and npm version.');
    return undefined;
  }
}

if (webExtVersion !== '10.6.0') {
  fail(`web-ext must stay on the patched 10.6.0 line; found ${String(webExtVersion)}.`);
}

try {
  const output = execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['audit', '--omit=dev', '--audit-level=high', '--json'],
    { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const report = parseAuditOutput(output);
  const high = report?.metadata?.vulnerabilities?.high ?? 0;
  const critical = report?.metadata?.vulnerabilities?.critical ?? 0;
  if (report && high + critical > 0) {
    fail('Production dependencies contain high or critical vulnerabilities.');
  }
} catch (error) {
  const output = error?.stdout?.toString() ?? '';
  const report = output ? parseAuditOutput(output) : undefined;
  const high = report?.metadata?.vulnerabilities?.high ?? 0;
  const critical = report?.metadata?.vulnerabilities?.critical ?? 0;
  if (high + critical > 0) {
    fail(
      `Production dependency audit found ${high} high and ${critical} critical vulnerabilities.`,
    );
  } else if (!report) {
    fail('Production dependency audit could not complete.');
  }
}

if (process.exitCode !== 1) {
  console.log('[SECURITY] Production dependency audit passed.');
  console.log('[FIX:security-gates] Dependency security gate completed.');
}
