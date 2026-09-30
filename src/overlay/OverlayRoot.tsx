import { useMemo, useState } from 'react';

import type { AuditCategory, AuditFinding, AuditSeverity, TargetRegistry } from '../audit';

import { FindingsList } from './FindingsList';
import { MarkerLayer } from './MarkerLayer';
import { Toolbar } from './Toolbar';
import { useTargetGeometry } from './use-target-geometry';

interface OverlayRootProps {
  readonly document: Document;
  readonly findings: readonly AuditFinding[];
  readonly registry: TargetRegistry;
  readonly onClear: () => void;
}

function focusTarget(finding: AuditFinding, registry: TargetRegistry, document: Document): void {
  if (!finding.targetId) return;
  const target = registry.resolve(finding.targetId, document);
  if (!target) return;
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
  if (target instanceof HTMLElement) target.focus({ preventScroll: true });
}

export function OverlayRoot({ document, findings, registry, onClear }: OverlayRootProps) {
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');
  const [severity, setSeverity] = useState<AuditSeverity | 'all'>('all');
  const filtered = useMemo(
    () =>
      findings.filter(
        (finding) =>
          (category === 'all' || finding.category === category) &&
          (severity === 'all' || finding.severity === severity),
      ),
    [category, findings, severity],
  );
  const geometry = useTargetGeometry(filtered, registry, document);

  return (
    <>
      <MarkerLayer findings={filtered} geometry={geometry} />
      <aside className="a11y-lens-panel" role="dialog" aria-label="Результаты аудита">
        <Toolbar
          findings={filtered}
          category={category}
          severity={severity}
          onCategoryChange={setCategory}
          onSeverityChange={setSeverity}
          onClear={onClear}
        />
        <FindingsList
          findings={filtered}
          onSelect={(finding) => focusTarget(finding, registry, document)}
        />
      </aside>
    </>
  );
}
