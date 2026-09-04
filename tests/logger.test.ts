import { describe, expect, it, vi } from 'vitest';

import { createLogger, resolveLogLevel } from '../src/diagnostics/logger';
import type { LogEntry } from '../src/diagnostics/types';

describe('redacted logger', () => {
  it('uses SILENT as the production fallback and supports explicit DEBUG', () => {
    expect(resolveLogLevel(undefined, 'SILENT')).toBe('SILENT');
    expect(resolveLogLevel('debug', 'SILENT')).toBe('DEBUG');
    expect(resolveLogLevel('unexpected', 'SILENT')).toBe('SILENT');
  });

  it('filters by level and keeps only allowlisted safe metadata', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      scope: 'test',
      level: 'INFO',
      allowedMetadataKeys: ['messageType', 'url', 'count'],
      sink: (entry) => entries.push(entry),
    });

    logger.debug('ignored', { count: 1 });
    logger.info('accepted', {
      messageType: 'GET_STATUS',
      count: 2,
      url: 'https://example.test/private',
      payload: { secret: true },
    });

    expect(entries).toEqual([
      {
        level: 'INFO',
        scope: 'test',
        event: 'accepted',
        metadata: { messageType: 'GET_STATUS', count: 2 },
      },
    ]);
  });

  it('does not evaluate object metadata or write when silent', () => {
    const sink = vi.fn();
    const logger = createLogger({
      scope: 'test',
      level: 'SILENT',
      allowedMetadataKeys: ['details'],
      sink,
    });

    logger.error('ignored', { details: { toJSON: () => 'private' } });

    expect(sink).not.toHaveBeenCalled();
  });
});
