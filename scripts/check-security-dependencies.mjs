import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNT_KEYS = ['info', 'low', 'moderate', 'high', 'critical', 'total'];

export function validateAuditResult({ stdout, status, error }) {
  if (error) throw new Error('Не удалось запустить npm audit.', { cause: error });

  let report;
  try {
    report = JSON.parse(String(stdout));
  } catch (cause) {
    throw new Error('npm audit не вернул JSON-отчёт.', { cause });
  }

  const counts = report?.metadata?.vulnerabilities;
  if (
    !report ||
    Object.hasOwn(report, 'error') ||
    !counts ||
    !COUNT_KEYS.every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
  ) {
    throw new Error('Отчёт npm audit неполный или содержит ошибку. Проверьте доступ к registry.');
  }
  const total = COUNT_KEYS.slice(0, -1).reduce((sum, key) => sum + counts[key], 0);
  if (total !== counts.total) throw new Error('Счётчики npm audit не согласованы.');
  if (total > 0) {
    throw new Error(
      `Найдены уязвимости: ${counts.low} low, ${counts.moderate} moderate, ` +
        `${counts.high} high, ${counts.critical} critical, ${counts.info} info.`,
    );
  }
  if (status !== 0) throw new Error('npm audit завершился с ошибкой, проверка не пройдена.');
  return counts;
}

export function checkDependencySecurity({ run = spawnSync, logger = console } = {}) {
  logger.log('[FIX:security-gates] Проверяем все зависимости, включая devDependencies.');
  try {
    const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    const webExtVersion = packageJson.devDependencies?.['web-ext'];
    if (webExtVersion !== '10.7.0') {
      throw new Error(`Ожидается web-ext@10.7.0; обнаружено ${String(webExtVersion)}.`);
    }

    validateAuditResult(
      run(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        [
          'audit',
          '--include=dev',
          '--include=optional',
          '--include=peer',
          '--audit-level=low',
          '--json',
        ],
        { cwd: projectRoot, encoding: 'utf8', timeout: 60_000 },
      ),
    );
    logger.log('[SECURITY] Полный audit зависимостей пройден: уязвимостей нет.');
    logger.log('[FIX:security-gates] Проверка завершена.');
    return 0;
  } catch (error) {
    logger.error(`[SECURITY] ${error instanceof Error ? error.message : 'Проверка не выполнена.'}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = checkDependencySecurity();
}
