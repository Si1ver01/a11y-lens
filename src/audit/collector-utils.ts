import { computeAccessibleName } from 'dom-accessibility-api';
import {
  collectAuditElements,
  DEFAULT_OVERLAY_ATTRIBUTE,
  registerAuditTargets,
} from './dom-filter';
import { TargetRegistry } from './target-registry';
import type { AuditCategory, AuditFinding, AuditSeverity } from './types';

export interface CollectorOptions {
  readonly document: Document;
  readonly targetRegistry: TargetRegistry;
  readonly overlayAttribute?: string;
}

export function auditElements({
  document,
  overlayAttribute = DEFAULT_OVERLAY_ATTRIBUTE,
}: CollectorOptions): readonly Element[] {
  return collectAuditElements(document, { document, overlayAttribute });
}

export function targetIds(
  elements: readonly Element[],
  registry: TargetRegistry,
): ReadonlyMap<Element, string> {
  return registerAuditTargets(elements, registry);
}

export function accessibleName(element: Element): string {
  return computeAccessibleName(element).trim();
}

export function finding(
  id: string,
  category: AuditCategory,
  severity: AuditSeverity,
  code: string,
  message: string,
  targetId?: string,
): AuditFinding {
  return { id, category, severity, code, message, ...(targetId ? { targetId } : {}) };
}
