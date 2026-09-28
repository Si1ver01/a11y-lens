export const AUDIT_CATEGORIES = [
  'headings',
  'landmarks',
  'accessible-names',
  'contrast',
  'focus-order',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export type AuditSeverity = 'info' | 'warning' | 'error';

export type AuditRunState = 'complete' | 'partial' | 'cancelled' | 'error';

export interface AuditFinding {
  readonly id: string;
  readonly category: AuditCategory;
  readonly severity: AuditSeverity;
  readonly code: string;
  readonly message: string;
  readonly targetId?: string;
  readonly incomplete?: boolean;
}

export type AuditCategoryCounts = Readonly<Record<AuditCategory, number>>;

export interface AuditResult {
  readonly runId: string;
  readonly state: AuditRunState;
  readonly findings: readonly AuditFinding[];
  readonly categoryCounts: AuditCategoryCounts;
  readonly skippedCategories: readonly AuditCategory[];
  readonly totalCount: number;
  readonly durationMs: number;
}

export interface AuditOptions {
  readonly document: Document;
  readonly categories?: readonly AuditCategory[];
  readonly signal?: AbortSignal;
  readonly maxFindings?: number;
  readonly overlayAttribute?: string;
}
