import {
  auditElements,
  accessibleName,
  finding,
  targetIds,
  type CollectorOptions,
} from './collector-utils';
import type { AuditFinding } from './types';

const LANDMARK_ROLES = new Map<string, string>([
  ['HEADER', 'banner'],
  ['MAIN', 'main'],
  ['NAV', 'navigation'],
  ['FOOTER', 'contentinfo'],
  ['ASIDE', 'complementary'],
  ['FORM', 'form'],
]);

const ROLE_SELECTORS = [
  '[role="banner"]',
  '[role="complementary"]',
  '[role="contentinfo"]',
  '[role="form"]',
  '[role="main"]',
  '[role="navigation"]',
  '[role="region"]',
  '[role="search"]',
];

export interface LandmarkEntry {
  readonly role: string;
  readonly targetId: string;
  readonly name: string;
}

export interface LandmarkCollection {
  readonly landmarks: readonly LandmarkEntry[];
  readonly findings: readonly AuditFinding[];
}

function landmarkRole(element: Element): string | undefined {
  return element.getAttribute('role') ?? LANDMARK_ROLES.get(element.tagName);
}

export function collectLandmarks(options: CollectorOptions): LandmarkCollection {
  const elements = new Set<Element>();
  for (const element of auditElements(options)) {
    if (landmarkRole(element)) elements.add(element);
  }
  for (const selector of ROLE_SELECTORS) {
    for (const element of options.document.querySelectorAll(selector)) elements.add(element);
  }

  const ordered = [...elements];
  const ids = targetIds(ordered, options.targetRegistry);
  const landmarks: LandmarkEntry[] = [];
  const findings: AuditFinding[] = [];
  const roleCounts = new Map<string, number>();

  ordered.forEach((element, index) => {
    const role = landmarkRole(element);
    const targetId = ids.get(element);
    if (!role || !targetId) return;
    const name = accessibleName(element);
    landmarks.push({ role, targetId, name });
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    if (['navigation', 'complementary', 'form', 'region', 'search'].includes(role) && !name) {
      findings.push(
        finding(
          `landmark-missing-name-${index + 1}`,
          'landmarks',
          'warning',
          'landmark-missing-name',
          'Landmark requires an accessible name when multiple instances exist.',
          targetId,
        ),
      );
    }
  });

  for (const [role, count] of roleCounts) {
    if (count > 1 && ['main', 'banner', 'contentinfo'].includes(role)) {
      findings.push(
        finding(
          `landmark-duplicate-${role}`,
          'landmarks',
          'error',
          'landmark-duplicate',
          `Document contains multiple ${role} landmarks.`,
        ),
      );
    }
  }

  return { landmarks, findings };
}
