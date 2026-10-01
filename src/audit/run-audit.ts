import { runAxeAudit } from './axe-adapter';
import { AuditCancelledError, throwIfAborted } from './cancellation';
import { collectFocusOrder } from './focus-order';
import { collectHeadings } from './headings';
import { collectLandmarks } from './landmarks';
import { TargetRegistry } from './target-registry';
import {
  AUDIT_CATEGORIES,
  type AuditCategory,
  type AuditCategoryCounts,
  type AuditFinding,
  type AuditOptions,
  type AuditResult,
} from './types';

const MAX_FINDINGS = 10_000;
let runSequence = 0;

export interface RunAuditOptions extends AuditOptions {
  readonly runId?: string;
  readonly targetRegistry?: TargetRegistry;
}

function nextRunId(): string {
  runSequence = (runSequence + 1) % 1_000_000;
  return `audit-${Date.now().toString(36)}-${runSequence.toString(36)}`.slice(0, 64);
}

function emptyCounts(): Record<AuditCategory, number> {
  return Object.fromEntries(AUDIT_CATEGORIES.map((category) => [category, 0])) as Record<
    AuditCategory,
    number
  >;
}

function stableFindings(
  findings: readonly AuditFinding[],
  maxFindings: number,
): readonly AuditFinding[] {
  const order = new Map(AUDIT_CATEGORIES.map((category, index) => [category, index]));
  return [...findings]
    .sort((left, right) => {
      const categoryOrder = (order.get(left.category) ?? 0) - (order.get(right.category) ?? 0);
      return categoryOrder || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(1, Math.min(MAX_FINDINGS, maxFindings)));
}

export async function runAudit({
  document,
  categories = AUDIT_CATEGORIES,
  signal,
  maxFindings = MAX_FINDINGS,
  overlayAttribute,
  runId = nextRunId(),
  targetRegistry = new TargetRegistry(),
}: RunAuditOptions): Promise<AuditResult> {
  const startedAt = performance.now();
  const selected = AUDIT_CATEGORIES.filter((category) => categories.includes(category));
  const findings: AuditFinding[] = [];
  const skippedCategories: AuditCategory[] = [];
  throwIfAborted(signal);

  const collectorOptions = { document, targetRegistry, overlayAttribute };
  if (selected.includes('headings')) {
    findings.push(...collectHeadings(collectorOptions).findings);
  }
  throwIfAborted(signal);
  if (selected.includes('landmarks')) {
    findings.push(...collectLandmarks(collectorOptions).findings);
  }
  throwIfAborted(signal);
  if (selected.includes('focus-order')) {
    findings.push(...collectFocusOrder(collectorOptions).findings);
  }
  throwIfAborted(signal);

  const axeCategories = selected.filter(
    (category): category is 'accessible-names' | 'contrast' =>
      category === 'accessible-names' || category === 'contrast',
  );
  if (axeCategories.length > 0) {
    try {
      const axe = await runAxeAudit({
        document,
        categories: axeCategories,
        signal,
        targetRegistry,
      });
      findings.push(...axe.findings);
      skippedCategories.push(...axe.incompleteCategories);
    } catch (error) {
      if (error instanceof AuditCancelledError || signal?.aborted) throw new AuditCancelledError();
      skippedCategories.push(...axeCategories);
    }
  }

  const stable = stableFindings(findings, maxFindings);
  const categoryCounts = emptyCounts();
  for (const item of stable) categoryCounts[item.category] += 1;
  const state = skippedCategories.length > 0 ? 'partial' : 'complete';
  return {
    runId,
    state,
    findings: stable,
    categoryCounts: categoryCounts as AuditCategoryCounts,
    skippedCategories: [...new Set(skippedCategories)],
    totalCount: stable.length,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

export class AuditController {
  private active?: { readonly runId: string; readonly cancellation: AbortController };

  public async run(options: Omit<RunAuditOptions, 'signal' | 'runId'>): Promise<AuditResult> {
    this.cancel();
    const runId = nextRunId();
    const cancellation = new AbortController();
    this.active = { runId, cancellation };
    try {
      return await runAudit({ ...options, runId, signal: cancellation.signal });
    } finally {
      if (this.active?.runId === runId) this.active = undefined;
    }
  }

  public cancel(): void {
    this.active?.cancellation.abort();
  }

  public get activeRunId(): string | null {
    return this.active?.runId ?? null;
  }
}
