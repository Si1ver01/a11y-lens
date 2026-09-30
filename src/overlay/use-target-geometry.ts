import { useEffect, useState } from 'react';

import type { AuditFinding } from '../audit';
import type { TargetRegistry } from '../audit';

export interface TargetGeometry {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export type TargetGeometryMap = ReadonlyMap<string, TargetGeometry>;

function measure(
  findings: readonly AuditFinding[],
  registry: TargetRegistry,
  document: Document,
): TargetGeometryMap {
  const entries = new Map<string, TargetGeometry>();
  for (const finding of findings) {
    if (!finding.targetId || entries.has(finding.targetId)) continue;
    const target = registry.resolve(finding.targetId, document);
    if (!target) continue;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    entries.set(finding.targetId, {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }
  return entries;
}

export function useTargetGeometry(
  findings: readonly AuditFinding[],
  registry: TargetRegistry,
  document: Document,
): TargetGeometryMap {
  const [geometry, setGeometry] = useState<TargetGeometryMap>(() =>
    measure(findings, registry, document),
  );

  useEffect(() => {
    let frame: number | undefined;
    const update = (): void => {
      frame = undefined;
      setGeometry(measure(findings, registry, document));
    };
    const schedule = (): void => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [document, findings, registry]);

  return geometry;
}
