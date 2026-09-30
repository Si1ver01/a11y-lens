import { afterEach, describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/dom';

import { TargetRegistry } from '../src/audit';
import { mountAuditOverlay } from '../src/overlay';

describe('audit overlay', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.querySelector('[data-a11y-lens-overlay="root"]')?.remove();
  });

  it('mounts one shadow root and renders aggregate findings', async () => {
    const target = document.createElement('button');
    document.body.append(target);
    const registry = new TargetRegistry();
    const targetId = registry.register(target);
    const handle = mountAuditOverlay(
      document,
      [
        {
          id: 'heading-1',
          category: 'headings',
          severity: 'warning',
          code: 'heading-outline-gap',
          message: 'Heading outline skips one or more levels.',
          targetId,
        },
      ],
      registry,
      () => undefined,
    );
    cleanup = handle.unmount;

    const host = document.querySelector('[data-a11y-lens-overlay="root"]');
    expect(host?.shadowRoot).toBeTruthy();
    await waitFor(() => expect(host?.shadowRoot?.textContent).toContain('Результаты аудита'));
    expect(document.querySelectorAll('[data-a11y-lens-overlay="root"]')).toHaveLength(1);
  });
});
