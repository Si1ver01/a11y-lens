import type { AuditFinding } from '../audit';

interface FindingsListProps {
  readonly findings: readonly AuditFinding[];
  readonly onSelect: (finding: AuditFinding) => void;
}

export function FindingsList({ findings, onSelect }: FindingsListProps) {
  if (findings.length === 0) {
    return <p className="a11y-lens-empty">По выбранным фильтрам результатов нет.</p>;
  }

  return (
    <ol className="a11y-lens-findings">
      {findings.map((finding) => (
        <li key={finding.id}>
          <button type="button" onClick={() => onSelect(finding)}>
            <span className={`severity-${finding.severity}`}>{finding.severity}</span>
            <span>{finding.message}</span>
            <small>{finding.code}</small>
          </button>
        </li>
      ))}
    </ol>
  );
}
