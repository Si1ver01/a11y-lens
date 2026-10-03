// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  checkDependencySecurity,
  validateAuditResult,
} from '../../scripts/check-security-dependencies.mjs';

const CLEAN_COUNTS = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };

function auditResult(counts = CLEAN_COUNTS, status = 0) {
  return { stdout: JSON.stringify({ metadata: { vulnerabilities: counts } }), status };
}

describe('полный security gate зависимостей', () => {
  it('принимает только полный чистый отчёт', () => {
    expect(validateAuditResult(auditResult())).toEqual(CLEAN_COUNTS);
  });

  it.each(['info', 'low', 'moderate', 'high', 'critical'])('отклоняет уровень %s', (level) => {
    expect(() =>
      validateAuditResult(auditResult({ ...CLEAN_COUNTS, [level]: 1, total: 1 }, 1)),
    ).toThrow('Найдены уязвимости');
  });

  it.each([
    { stdout: JSON.stringify({ error: { code: 'ENOTFOUND' } }), status: 1 },
    {
      stdout: JSON.stringify({ error: {}, metadata: { vulnerabilities: CLEAN_COUNTS } }),
      status: 0,
    },
    { stdout: '{}', status: 0 },
    { stdout: 'null', status: 0 },
    { stdout: '', status: 1 },
    { stdout: '<html>error</html>', status: 1 },
    auditResult({ ...CLEAN_COUNTS, high: -1 }),
    auditResult({ ...CLEAN_COUNTS, low: 0.5 }),
    auditResult({ ...CLEAN_COUNTS, total: 1 }),
    auditResult({ high: 0, critical: 0 }),
    auditResult(CLEAN_COUNTS, 1),
    auditResult(CLEAN_COUNTS, null),
  ])('не считает сбой или неполный отчёт успехом: %j', (result) => {
    expect(() => validateAuditResult(result)).toThrow();
  });

  it('отклоняет невозможность запуска npm', () => {
    expect(() => validateAuditResult({ error: new Error('ENOENT') })).toThrow(
      'Не удалось запустить npm audit',
    );
  });

  it('включает devDependencies и выводит success только при успешной проверке', () => {
    const run = vi.fn().mockReturnValue(auditResult());
    const logger = { log: vi.fn(), error: vi.fn() };

    expect(checkDependencySecurity({ run, logger })).toBe(0);
    expect(run).toHaveBeenCalledWith(
      expect.stringMatching(/^npm(?:\.cmd)?$/),
      [
        'audit',
        '--include=dev',
        '--include=optional',
        '--include=peer',
        '--audit-level=low',
        '--json',
      ],
      expect.objectContaining({ encoding: 'utf8', timeout: 60_000 }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      '[SECURITY] Полный audit зависимостей пройден: уязвимостей нет.',
    );
  });

  it('не выводит success при сбое сети', () => {
    const run = vi.fn().mockReturnValue({ stdout: '{"error":{"code":"ENOTFOUND"}}', status: 1 });
    const logger = { log: vi.fn(), error: vi.fn() };

    expect(checkDependencySecurity({ run, logger })).toBe(1);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledTimes(1);
  });
});
