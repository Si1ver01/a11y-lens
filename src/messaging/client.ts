import { browser } from 'wxt/browser';

import { createLogger } from '../diagnostics/logger';
import type { Logger } from '../diagnostics/types';
import {
  parseCommandMessage,
  parseResponseMessage,
  type AuditErrorCode,
  type ExtensionCommand,
  type ExtensionResponse,
} from './schema';

export interface MessageTransport {
  send(tabId: number, message: ExtensionCommand): Promise<unknown>;
}

const clientLogger = createLogger({
  scope: 'messaging-client',
  allowedMetadataKeys: ['messageType', 'version', 'errorCode'],
});

const browserTransport: MessageTransport = {
  send: (tabId, message) => browser.tabs.sendMessage(tabId, message),
};

export class MessagingError extends Error {
  constructor(
    public readonly code: AuditErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'MessagingError';
  }
}

export async function sendCommandToTab(
  tabId: number,
  command: ExtensionCommand,
  transport: MessageTransport = browserTransport,
  logger: Logger = clientLogger,
): Promise<ExtensionResponse> {
  const outgoing = parseCommandMessage(command);
  if (!outgoing.ok) {
    logger.error('message-validation-failed', { errorCode: outgoing.error.code });
    throw new MessagingError(outgoing.error.code, outgoing.error.message);
  }

  logger.debug('message-send-started', {
    messageType: outgoing.value.type,
    version: outgoing.value.version,
  });

  let rawResponse: unknown;
  try {
    rawResponse = await transport.send(tabId, outgoing.value);
  } catch (error) {
    logger.error('message-transport-failed', { errorCode: 'TRANSPORT_ERROR' });
    throw new MessagingError('TRANSPORT_ERROR', 'Не удалось связаться с текущей вкладкой.', {
      cause: error,
    });
  }

  const response = parseResponseMessage(rawResponse);
  if (!response.ok) {
    logger.error('message-validation-failed', { errorCode: response.error.code });
    throw new MessagingError(response.error.code, response.error.message);
  }

  logger.info('message-command-completed', {
    messageType: outgoing.value.type,
    version: outgoing.value.version,
  });
  return response.value;
}
