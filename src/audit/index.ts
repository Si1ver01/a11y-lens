export {
  collectAuditElements,
  DEFAULT_OVERLAY_ATTRIBUTE,
  isAuditCandidate,
  isDetached,
  isHiddenOrInert,
  isOwnedOverlay,
  registerAuditTargets,
} from './dom-filter';
export { TargetRegistry } from './target-registry';
export type { TargetRegistryOptions } from './target-registry';
export { AUDIT_CATEGORIES } from './types';
export type {
  AuditCategory,
  AuditCategoryCounts,
  AuditFinding,
  AuditOptions,
  AuditResult,
  AuditRunState,
  AuditSeverity,
} from './types';
export { runAxeAudit } from './axe-adapter';
export type { AxeAdapterOptions, AxeAuditResult } from './axe-adapter';
export { AXE_RULES, axeRulesForCategories, categoryForAxeRule } from './axe-rules';
export { AuditCancellation, AuditCancelledError, throwIfAborted } from './cancellation';
export { AuditController, runAudit } from './run-audit';
export type { RunAuditOptions } from './run-audit';
