import { useCallback, useState } from 'react';

import { injectIntoActiveTab } from '../platform/inject-content';
import { sendCommandToTab, MessagingError } from '../messaging/client';
import {
  AUDIT_CATEGORIES,
  MESSAGE_VERSION,
  type AuditCategory,
  type AuditStatusMessage,
  type ExtensionResponse,
} from '../messaging/schema';

export interface AuditCommandState {
  readonly status: AuditStatusMessage | null;
  readonly error: string | null;
  readonly running: boolean;
  readonly categories: readonly AuditCategory[];
}

const CAPABILITY_MESSAGES: Record<string, string> = {
  TAB_ID_MISSING: 'Текущая вкладка недоступна для аудита.',
  TAB_DISCARDED: 'Текущая вкладка выгружена браузером.',
  URL_MISSING: 'У текущей вкладки нет адреса для проверки.',
  URL_RESTRICTED: 'Эта страница запрещает запуск content script.',
};

export function useAuditCommand(): AuditCommandState & {
  readonly setCategories: (categories: readonly AuditCategory[]) => void;
  readonly run: () => Promise<void>;
  readonly clear: () => Promise<void>;
} {
  const [categories, setCategories] = useState<readonly AuditCategory[]>(AUDIT_CATEGORIES);
  const [status, setStatus] = useState<AuditStatusMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(
    async (type: 'RUN_AUDIT' | 'CLEAR_AUDIT'): Promise<void> => {
      setRunning(type === 'RUN_AUDIT');
      setError(null);
      try {
        const capability = await injectIntoActiveTab();
        if (!capability.supported) {
          setError(CAPABILITY_MESSAGES[capability.code] ?? 'Вкладка недоступна для аудита.');
          return;
        }
        const response: ExtensionResponse = await sendCommandToTab(
          capability.tabId,
          type === 'RUN_AUDIT'
            ? { version: MESSAGE_VERSION, type, categories }
            : { version: MESSAGE_VERSION, type },
        );
        if (response.type === 'AUDIT_ERROR') {
          setError(response.message);
          return;
        }
        setStatus(response);
      } catch (caught) {
        setError(
          caught instanceof MessagingError ? caught.message : 'Команда аудита не выполнена.',
        );
      } finally {
        setRunning(false);
      }
    },
    [categories],
  );

  return {
    categories,
    error,
    running,
    status,
    setCategories,
    run: useCallback(() => execute('RUN_AUDIT'), [execute]),
    clear: useCallback(() => execute('CLEAR_AUDIT'), [execute]),
  };
}
