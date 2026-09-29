import {
  auditElements,
  accessibleName,
  finding,
  targetIds,
  type CollectorOptions,
} from './collector-utils';
import type { AuditFinding } from './types';

export interface HeadingEntry {
  readonly level: number;
  readonly targetId: string;
  readonly name: string;
}

export interface HeadingCollection {
  readonly headings: readonly HeadingEntry[];
  readonly findings: readonly AuditFinding[];
}

export function collectHeadings(options: CollectorOptions): HeadingCollection {
  const elements = auditElements(options).filter((element) => /^H[1-6]$/.test(element.tagName));
  const ids = targetIds(elements, options.targetRegistry);
  const headings: HeadingEntry[] = [];
  const findings: AuditFinding[] = [];
  let previousLevel = 0;

  elements.forEach((element, index) => {
    const level = Number(element.tagName.slice(1));
    const targetId = ids.get(element);
    if (!targetId) return;
    const name = accessibleName(element);
    headings.push({ level, targetId, name });
    if (!name) {
      findings.push(
        finding(
          `heading-missing-name-${index + 1}`,
          'headings',
          'error',
          'heading-missing-name',
          'Heading has no accessible name.',
          targetId,
        ),
      );
    }
    if (previousLevel > 0 && level > previousLevel + 1) {
      findings.push(
        finding(
          `heading-outline-gap-${index + 1}`,
          'headings',
          'warning',
          'heading-outline-gap',
          'Heading outline skips one or more levels.',
          targetId,
        ),
      );
    }
    previousLevel = level;
  });

  return { headings, findings };
}
