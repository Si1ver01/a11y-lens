import type { AuditFinding } from '../audit';

import type { TargetGeometryMap } from './use-target-geometry';

interface MarkerLayerProps {
  readonly findings: readonly AuditFinding[];
  readonly geometry: TargetGeometryMap;
}

export function MarkerLayer({ findings, geometry }: MarkerLayerProps) {
  const markers = findings.filter((finding) => finding.targetId && geometry.has(finding.targetId));
  return (
    <div className="a11y-lens-marker-layer" aria-hidden="true">
      {markers.map((finding, index) => {
        const targetId = finding.targetId as string;
        const target = geometry.get(targetId);
        if (!target) return null;
        return (
          <span
            className={`a11y-lens-marker severity-${finding.severity}`}
            key={`${finding.id}-${targetId}`}
            style={{
              top: `${target.top}px`,
              left: `${target.left}px`,
              width: `${target.width}px`,
              height: `${target.height}px`,
            }}
          >
            {index + 1}
          </span>
        );
      })}
    </div>
  );
}
