import { browser } from 'wxt/browser';

import { createLogger } from '../diagnostics/logger';
import type { Logger } from '../diagnostics/types';
import {
  createAuditError,
  parseCommandMessage,
  parseResponseMessage,
  type ExtensionCommand,
  type ExtensionResponse,
} from './schema';

export type CommandHandler = (
  command: ExtensionCommand,
) => ExtensionResponse | Promise<ExtensionResponse>;

const serverLogger = createLogger({
  scope: 'messaging-server',
  allowedMetadataKeys: ['messageType', 'version', 'errorCode'],
});

export function createRuntimeMessageListener(
  handleCommand: CommandHandler,
  logger: Logger = serverLogger,
): (message: unknown) => Promise<ExtensionResponse> {
  return async (message) => {
    const command = parseCommandMessage(message);
    if (!command.ok) {
      logger.error('message-validation-failed', { errorCode: command.error.code });
      return createAuditError(command.error.code, command.error.message);
    }

    logger.debug('message-received', {
      messageType: command.value.type,
      version: command.value.version,
    });

    try {
      const rawResponse: unknown = await handleCommand(command.value);
      const response = parseResponseMessage(rawResponse);
      if (!response.ok) {
        logger.error('response-validation-failed', { errorCode: response.error.code });
        return createAuditError(response.error.code, response.error.message);
      }
      logger.info('message-command-completed', {
        messageType: command.value.type,
        version: command.value.version,
      });
      return response.value;
    } catch {
      logger.error('message-handler-failed', { errorCode: 'AUDIT_FAILED' });
      return createAuditError('AUDIT_FAILED', 'Не удалось выполнить команду аудита.');
    }
  };
}

export function registerMessageServer(handleCommand: CommandHandler, logger?: Logger): () => void {
  const listener = createRuntimeMessageListener(handleCommand, logger);
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
