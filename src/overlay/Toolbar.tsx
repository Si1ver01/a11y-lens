import type { AuditCategory, AuditFinding, AuditSeverity } from '../audit';

interface ToolbarProps {
  readonly findings: readonly AuditFinding[];
  readonly category: AuditCategory | 'all';
  readonly severity: AuditSeverity | 'all';
  readonly onCategoryChange: (category: AuditCategory | 'all') => void;
  readonly onSeverityChange: (severity: AuditSeverity | 'all') => void;
  readonly onClear: () => void;
}

const categories: readonly (AuditCategory | 'all')[] = [
  'all',
  'headings',
  'landmarks',
  'accessible-names',
  'contrast',
  'focus-order',
];

const severities: readonly (AuditSeverity | 'all')[] = ['all', 'error', 'warning', 'info'];

export function Toolbar({
  findings,
  category,
  severity,
  onCategoryChange,
  onSeverityChange,
  onClear,
}: ToolbarProps) {
  return (
    <header className="a11y-lens-toolbar">
      <div>
        <strong>Результаты аудита</strong>
        <span role="status" aria-live="polite">
          {findings.length}
        </span>
      </div>
      <label>
        Категория
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as AuditCategory | 'all')}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item === 'all' ? 'Все' : item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Severity
        <select
          value={severity}
          onChange={(event) => onSeverityChange(event.target.value as AuditSeverity | 'all')}
        >
          {severities.map((item) => (
            <option key={item} value={item}>
              {item === 'all' ? 'Все' : item}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onClear}>
        Очистить
      </button>
    </header>
  );
}
