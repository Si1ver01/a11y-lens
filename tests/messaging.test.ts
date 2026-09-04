import { describe, expect, it, vi } from 'vitest';

import { sendCommandToTab } from '../src/messaging/client';
import {
  AUDIT_CATEGORIES,
  MAX_MESSAGE_BYTES,
  MESSAGE_VERSION,
  parseCommandMessage,
  parseResponseMessage,
  type AuditStatusMessage,
} from '../src/messaging/schema';
import { createRuntimeMessageListener } from '../src/messaging/server';

const EMPTY_COUNTS = {
  headings: 0,
  landmarks: 0,
  'accessible-names': 0,
  contrast: 0,
  'focus-order': 0,
} as const;

const IDLE_STATUS: AuditStatusMessage = {
  version: MESSAGE_VERSION,
  type: 'AUDIT_STATUS',
  runId: null,
  state: 'idle',
  categoryCounts: EMPTY_COUNTS,
  totalCount: 0,
};

describe('messaging schema', () => {
  it('accepts a versioned RUN_AUDIT command', () => {
    const result = parseCommandMessage({
      version: MESSAGE_VERSION,
      type: 'RUN_AUDIT',
      categories: [...AUDIT_CATEGORIES],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        version: MESSAGE_VERSION,
        type: 'RUN_AUDIT',
        categories: [...AUDIT_CATEGORIES],
      },
    });
  });

  it('rejects unsupported versions and oversized payloads', () => {
    expect(parseCommandMessage({ version: 2, type: 'GET_STATUS' })).toMatchObject({
      ok: false,
      error: { code: 'VERSION_UNSUPPORTED' },
    });
    expect(
      parseCommandMessage({
        version: MESSAGE_VERSION,
        type: 'GET_STATUS',
        padding: 'x'.repeat(MAX_MESSAGE_BYTES),
      }),
    ).toMatchObject({ ok: false, error: { code: 'MESSAGE_TOO_LARGE' } });
  });

  it('does not allow findings or target IDs in AUDIT_STATUS', () => {
    expect(parseResponseMessage({ ...IDLE_STATUS, findings: [] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_MESSAGE' },
    });
    expect(parseResponseMessage({ ...IDLE_STATUS, targetIds: ['target-1'] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_MESSAGE' },
    });
  });

  it('rejects inconsistent aggregate counts', () => {
    expect(
      parseResponseMessage({
        ...IDLE_STATUS,
        categoryCounts: { ...EMPTY_COUNTS, headings: 1 },
        totalCount: 0,
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_MESSAGE' } });
  });
});

describe('messaging boundaries', () => {
  it('validates transport responses before returning them', async () => {
    const transport = { send: vi.fn().mockResolvedValue(IDLE_STATUS) };

    await expect(
      sendCommandToTab(7, { version: MESSAGE_VERSION, type: 'GET_STATUS' }, transport),
    ).resolves.toEqual(IDLE_STATUS);
    expect(transport.send).toHaveBeenCalledWith(7, {
      version: MESSAGE_VERSION,
      type: 'GET_STATUS',
    });
  });

  it('turns malformed incoming messages into controlled errors', async () => {
    const handler = vi.fn().mockResolvedValue(IDLE_STATUS);
    const listener = createRuntimeMessageListener(handler);

    await expect(listener({ version: MESSAGE_VERSION, type: 'UNKNOWN' })).resolves.toMatchObject({
      type: 'AUDIT_ERROR',
      code: 'INVALID_MESSAGE',
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
