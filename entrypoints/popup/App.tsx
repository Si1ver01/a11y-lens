import { AUDIT_CATEGORIES, type AuditCategory } from '../../src/messaging/schema';
import { useAuditCommand } from '../../src/popup/use-audit-command';

const categoryLabels: Record<AuditCategory, string> = {
  headings: 'Headings',
  landmarks: 'Landmarks',
  'accessible-names': 'Accessible names',
  contrast: 'Contrast',
  'focus-order': 'Focus order',
};

export function App() {
  const { categories, error, running, status, setCategories, run, clear } = useAuditCommand();
  const toggleCategory = (category: AuditCategory): void => {
    setCategories(
      categories.includes(category)
        ? categories.filter((item) => item !== category)
        : [...categories, category],
    );
  };

  return (
    <main className="popup-app">
      <h1>a11y-lens</h1>
      <p role="status" aria-live="polite">
        {error ??
          (running
            ? 'Аудит выполняется…'
            : status
              ? `Найдено результатов: ${status.totalCount} (${status.state}).`
              : 'Выберите категории и запустите аудит текущей вкладки.')}
      </p>
      <fieldset disabled={running}>
        <legend>Категории</legend>
        {AUDIT_CATEGORIES.map((category) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={categories.includes(category)}
              onChange={() => toggleCategory(category)}
            />
            {categoryLabels[category]}
          </label>
        ))}
      </fieldset>
      <div className="popup-actions">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || categories.length === 0}
        >
          {running ? 'Проверяем…' : 'Запустить аудит'}
        </button>
        <button type="button" onClick={() => void clear()} disabled={running || !status}>
          Очистить
        </button>
      </div>
    </main>
  );
}
