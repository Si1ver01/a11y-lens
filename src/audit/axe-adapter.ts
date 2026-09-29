import axe, { type NodeResult, type Result } from 'axe-core';
import { TargetRegistry } from './target-registry';
import { AUDIT_CATEGORIES, type AuditCategory, type AuditFinding } from './types';
import { axeRulesForCategories, categoryForAxeRule } from './axe-rules';

const DEFAULT_TIMEOUT_MS = 5_000;

export interface AxeAdapterOptions {
  readonly document: Document;
  readonly categories?: readonly AuditCategory[];
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly targetRegistry?: TargetRegistry;
}

export interface AxeAuditResult {
  readonly findings: readonly AuditFinding[];
  readonly incompleteCategories: readonly AuditCategory[];
  readonly durationMs: number;
  readonly timedOut: boolean;
}

function asTargetSelector(target: unknown): string | undefined {
  if (typeof target === 'string') return target;
  if (!Array.isArray(target)) return undefined;
  const first = target[0];
  return typeof first === 'string' ? first : undefined;
}

function resolveTarget(document: Document, node: NodeResult): Element | undefined {
  const selector = asTargetSelector(node.target);
  if (!selector) return undefined;
  try {
    return document.querySelector(selector) ?? undefined;
  } catch {
    return undefined;
  }
}

function createFinding(
  result: Result,
  node: NodeResult,
  index: number,
  document: Document,
  registry: TargetRegistry,
  incomplete: boolean,
): AuditFinding | undefined {
  const category = categoryForAxeRule(result.id);
  if (!category) return undefined;
  const target = resolveTarget(document, node);
  return {
    id: `axe-${result.id}-${index + 1}`,
    category,
    severity: incomplete ? 'warning' : 'error',
    code: result.id,
    message: result.help,
    ...(target ? { targetId: registry.register(target) } : {}),
    ...(incomplete ? { incomplete: true } : {}),
  };
}

function abortError(): Error {
  return new Error('Axe audit cancelled');
}

export async function runAxeAudit({
  document,
  categories = AUDIT_CATEGORIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
  targetRegistry = new TargetRegistry(),
}: AxeAdapterOptions): Promise<AxeAuditResult> {
  const startedAt = performance.now();
  const rules = axeRulesForCategories(categories);
  if (rules.length === 0) {
    return { findings: [], incompleteCategories: [], durationMs: 0, timedOut: false };
  }

  if (signal?.aborted) throw abortError();

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const scan = axe.run(
      { include: document, exclude: ['[data-a11y-lens-overlay]'] },
      {
        runOnly: { type: 'rule', values: [...rules] },
        resultTypes: ['violations', 'incomplete'],
      },
    );
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => {
          reject(new Error('Axe audit timed out'));
        },
        Math.max(1, timeoutMs),
      );
    });
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(abortError());
      signal?.addEventListener('abort', onAbort, { once: true });
    });
    const results = await Promise.race([scan, timeout, cancelled]);
    const findings = results.violations.flatMap((result) =>
      result.nodes
        .map((node, index) => createFinding(result, node, index, document, targetRegistry, false))
        .filter((finding): finding is AuditFinding => Boolean(finding)),
    );
    const incompleteFindings = results.incomplete.flatMap((result) =>
      result.nodes
        .map((node, index) => createFinding(result, node, index, document, targetRegistry, true))
        .filter((finding): finding is AuditFinding => Boolean(finding)),
    );
    const incompleteCategories = [
      ...new Set(incompleteFindings.map((finding) => finding.category)),
    ];
    return {
      findings: [...findings, ...incompleteFindings],
      incompleteCategories,
      durationMs: Math.round(performance.now() - startedAt),
      timedOut: false,
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}
