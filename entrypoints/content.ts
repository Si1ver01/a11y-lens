import {
  AuditCancelledError,
  AuditController,
  DEFAULT_OVERLAY_ATTRIBUTE,
  TargetRegistry,
} from '../src/audit';
import {
  AUDIT_CATEGORIES,
  MESSAGE_VERSION,
  createAuditError,
  type AuditCategory,
  type AuditStatusMessage,
  type ExtensionCommand,
  type ExtensionResponse,
} from '../src/messaging/schema';
import { registerMessageServer } from '../src/messaging/server';
import { mountAuditOverlay, type AuditOverlayHandle } from '../src/overlay/mount-overlay';

function createEmptyCategoryCounts(): Record<AuditCategory, number> {
  return Object.fromEntries(AUDIT_CATEGORIES.map((category) => [category, 0])) as Record<
    AuditCategory,
    number
  >;
}

export default defineContentScript({
  registration: 'runtime',
  main() {
    const controller = new AuditController();
    let registry: TargetRegistry | undefined;
    let overlay: AuditOverlayHandle | undefined;
    let status: AuditStatusMessage = {
      version: MESSAGE_VERSION,
      type: 'AUDIT_STATUS',
      runId: null,
      state: 'idle',
      categoryCounts: createEmptyCategoryCounts(),
      totalCount: 0,
    };

    const handleCommand = async (command: ExtensionCommand): Promise<ExtensionResponse> => {
      if (command.type === 'GET_STATUS') return status;

      if (command.type === 'CLEAR_AUDIT') {
        controller.cancel();
        overlay?.unmount();
        overlay = undefined;
        registry?.clear();
        registry = undefined;
        status = {
          ...status,
          runId: null,
          state: 'idle',
          categoryCounts: createEmptyCategoryCounts(),
          totalCount: 0,
        };
        return status;
      }

      registry?.clear();
      overlay?.unmount();
      overlay = undefined;
      const nextRegistry = new TargetRegistry();
      registry = nextRegistry;
      const pending = controller.run({
        document,
        categories: command.categories,
        overlayAttribute: DEFAULT_OVERLAY_ATTRIBUTE,
        targetRegistry: nextRegistry,
      });
      const runId = controller.activeRunId;
      if (!runId) return createAuditError('AUDIT_FAILED', 'Не удалось создать запуск аудита.');

      status = {
        ...status,
        runId,
        state: 'running',
      };

      try {
        const result = await pending;
        if (controller.activeRunId !== runId && status.runId !== runId) {
          return createAuditError('STALE_RUN', 'Результат относится к устаревшему запуску.', runId);
        }
        status = {
          version: MESSAGE_VERSION,
          type: 'AUDIT_STATUS',
          runId: result.runId,
          state: result.state === 'partial' ? 'partial' : 'complete',
          categoryCounts: result.categoryCounts,
          totalCount: result.totalCount,
        };
        overlay = mountAuditOverlay(document, result.findings, nextRegistry, () => {
          controller.cancel();
          overlay?.unmount();
          overlay = undefined;
          nextRegistry.clear();
          registry = undefined;
          status = {
            ...status,
            runId: null,
            state: 'idle',
            categoryCounts: createEmptyCategoryCounts(),
            totalCount: 0,
          };
        });
        return status;
      } catch (error) {
        if (error instanceof AuditCancelledError || controller.activeRunId !== runId) {
          return createAuditError('STALE_RUN', 'Запуск аудита отменён или устарел.', runId);
        }
        status = {
          ...status,
          state: 'error',
        };
        return createAuditError('AUDIT_FAILED', 'Не удалось выполнить аудит.', runId);
      }
    };

    const unregister = registerMessageServer(handleCommand);
    const cleanup = (): void => {
      controller.cancel();
      overlay?.unmount();
      overlay = undefined;
      registry?.clear();
      registry = undefined;
      unregister();
    };
    window.addEventListener('pagehide', cleanup, { once: true });
  },
});
