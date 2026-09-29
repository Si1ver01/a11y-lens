import { auditElements, finding, targetIds, type CollectorOptions } from './collector-utils';
import type { AuditFinding } from './types';

export interface FocusOrderEntry {
  readonly targetId: string;
  readonly tabIndex: number;
  readonly positiveTabIndex: boolean;
  readonly contentEditable: boolean;
}

export interface FocusOrderCollection {
  readonly order: readonly FocusOrderEntry[];
  readonly findings: readonly AuditFinding[];
}

function isFocusable(element: Element): boolean {
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  const tag = element.tagName;
  return (
    element.hasAttribute('tabindex') ||
    element.getAttribute('contenteditable') === 'true' ||
    (tag === 'A' && element.hasAttribute('href')) ||
    ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(tag)
  );
}

export function collectFocusOrder(options: CollectorOptions): FocusOrderCollection {
  const elements = auditElements(options).filter(isFocusable);
  const ids = targetIds(elements, options.targetRegistry);
  const entries: FocusOrderEntry[] = [];
  const findings: AuditFinding[] = [];

  elements.forEach((element, index) => {
    const targetId = ids.get(element);
    if (!targetId) return;
    const tabIndex = Number(element.getAttribute('tabindex') ?? '0');
    const positiveTabIndex = Number.isInteger(tabIndex) && tabIndex > 0;
    const contentEditable = element.getAttribute('contenteditable') === 'true';
    entries.push({ targetId, tabIndex, positiveTabIndex, contentEditable });
    if (positiveTabIndex) {
      findings.push(
        finding(
          `focus-positive-tabindex-${index + 1}`,
          'focus-order',
          'warning',
          'focus-positive-tabindex',
          'Positive tabindex changes the natural focus order.',
          targetId,
        ),
      );
    }
  });

  entries.sort((left, right) => {
    if (left.positiveTabIndex !== right.positiveTabIndex) return left.positiveTabIndex ? -1 : 1;
    if (left.positiveTabIndex && left.tabIndex !== right.tabIndex) {
      return left.tabIndex - right.tabIndex;
    }
    return 0;
  });
  return { order: entries, findings };
}
