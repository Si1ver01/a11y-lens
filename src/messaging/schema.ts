export const MESSAGE_VERSION = 1 as const;
export const MAX_MESSAGE_BYTES = 8_192;
export const MAX_RUN_ID_LENGTH = 64;
export const MAX_ERROR_MESSAGE_LENGTH = 240;
export const MAX_FINDING_COUNT = 10_000;

export const AUDIT_CATEGORIES = [
  'headings',
  'landmarks',
  'accessible-names',
  'contrast',
  'focus-order',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditState = 'idle' | 'running' | 'complete' | 'error';
export type MessageValidationErrorCode =
  'INVALID_MESSAGE' | 'MESSAGE_TOO_LARGE' | 'VERSION_UNSUPPORTED';
export type AuditErrorCode =
  | MessageValidationErrorCode
  | 'AUDIT_FAILED'
  | 'INJECTION_FAILED'
  | 'STALE_RUN'
  | 'TRANSPORT_ERROR';

export interface RunAuditMessage {
  readonly version: typeof MESSAGE_VERSION;
  readonly type: 'RUN_AUDIT';
  readonly categories: readonly AuditCategory[];
}

export interface ClearAuditMessage {
  readonly version: typeof MESSAGE_VERSION;
  readonly type: 'CLEAR_AUDIT';
}

export interface GetStatusMessage {
  readonly version: typeof MESSAGE_VERSION;
  readonly type: 'GET_STATUS';
}

export interface AuditStatusMessage {
  readonly version: typeof MESSAGE_VERSION;
  readonly type: 'AUDIT_STATUS';
  readonly runId: string | null;
  readonly state: AuditState;
  readonly categoryCounts: Readonly<Record<AuditCategory, number>>;
  readonly totalCount: number;
}

export interface AuditErrorMessage {
  readonly version: typeof MESSAGE_VERSION;
  readonly type: 'AUDIT_ERROR';
  readonly runId: string | null;
  readonly code: AuditErrorCode;
  readonly message: string;
}

export type ExtensionCommand = RunAuditMessage | ClearAuditMessage | GetStatusMessage;
export type ExtensionResponse = AuditStatusMessage | AuditErrorMessage;
export type ExtensionMessage = ExtensionCommand | ExtensionResponse;

export interface MessageValidationError {
  readonly code: MessageValidationErrorCode;
  readonly message: string;
}

export type MessageValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MessageValidationError };

const CATEGORY_SET = new Set<string>(AUDIT_CATEGORIES);
const AUDIT_STATES = new Set<AuditState>(['idle', 'running', 'complete', 'error']);
const AUDIT_ERROR_CODES = new Set<AuditErrorCode>([
  'INVALID_MESSAGE',
  'MESSAGE_TOO_LARGE',
  'VERSION_UNSUPPORTED',
  'AUDIT_FAILED',
  'INJECTION_FAILED',
  'STALE_RUN',
  'TRANSPORT_ERROR',
]);

function failure(
  code: MessageValidationErrorCode,
  message: string,
): MessageValidationResult<never> {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedRunId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.length > 0 && value.length <= MAX_RUN_ID_LENGTH)
  );
}

function serializedByteLength(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : new TextEncoder().encode(serialized).byteLength;
  } catch {
    return null;
  }
}

function validateEnvelope(value: unknown): MessageValidationResult<Record<string, unknown>> {
  const byteLength = serializedByteLength(value);
  if (byteLength === null) return failure('INVALID_MESSAGE', 'Сообщение нельзя сериализовать.');
  if (byteLength > MAX_MESSAGE_BYTES) {
    return failure('MESSAGE_TOO_LARGE', 'Сообщение превышает допустимый размер.');
  }
  if (!isRecord(value) || typeof value.type !== 'string') {
    return failure('INVALID_MESSAGE', 'Сообщение имеет неверную структуру.');
  }
  if (value.version !== MESSAGE_VERSION) {
    return failure('VERSION_UNSUPPORTED', 'Версия протокола не поддерживается.');
  }
  return { ok: true, value };
}

function isCategoryCounts(value: unknown): value is Readonly<Record<AuditCategory, number>> {
  if (!isRecord(value) || !hasOnlyKeys(value, AUDIT_CATEGORIES)) return false;
  return AUDIT_CATEGORIES.every(
    (category) =>
      Number.isInteger(value[category]) &&
      (value[category] as number) >= 0 &&
      (value[category] as number) <= MAX_FINDING_COUNT,
  );
}

function parseRunAudit(value: Record<string, unknown>): MessageValidationResult<RunAuditMessage> {
  if (!hasOnlyKeys(value, ['version', 'type', 'categories']) || !Array.isArray(value.categories)) {
    return failure('INVALID_MESSAGE', 'Команда RUN_AUDIT имеет неверную структуру.');
  }
  const categories = value.categories;
  if (
    categories.length === 0 ||
    categories.length > AUDIT_CATEGORIES.length ||
    !categories.every((category): category is AuditCategory =>
      typeof category === 'string' ? CATEGORY_SET.has(category) : false,
    ) ||
    new Set(categories).size !== categories.length
  ) {
    return failure('INVALID_MESSAGE', 'Команда RUN_AUDIT содержит неверные категории.');
  }
  return { ok: true, value: { version: MESSAGE_VERSION, type: 'RUN_AUDIT', categories } };
}

export function parseCommandMessage(value: unknown): MessageValidationResult<ExtensionCommand> {
  const envelope = validateEnvelope(value);
  if (!envelope.ok) return envelope;
  const message = envelope.value;

  if (message.type === 'RUN_AUDIT') return parseRunAudit(message);
  if (message.type === 'CLEAR_AUDIT' || message.type === 'GET_STATUS') {
    if (!hasOnlyKeys(message, ['version', 'type'])) {
      return failure('INVALID_MESSAGE', `Команда ${message.type} имеет неверную структуру.`);
    }
    return {
      ok: true,
      value: { version: MESSAGE_VERSION, type: message.type },
    };
  }
  return failure('INVALID_MESSAGE', 'Тип команды не поддерживается.');
}

function parseAuditStatus(
  value: Record<string, unknown>,
): MessageValidationResult<AuditStatusMessage> {
  const categoryCounts = value.categoryCounts;
  if (
    !hasOnlyKeys(value, ['version', 'type', 'runId', 'state', 'categoryCounts', 'totalCount']) ||
    !isBoundedRunId(value.runId) ||
    typeof value.state !== 'string' ||
    !AUDIT_STATES.has(value.state as AuditState) ||
    !isCategoryCounts(categoryCounts) ||
    !Number.isInteger(value.totalCount) ||
    (value.totalCount as number) < 0
  ) {
    return failure('INVALID_MESSAGE', 'Статус аудита имеет неверную структуру.');
  }
  const totalCount = AUDIT_CATEGORIES.reduce(
    (total, category) => total + categoryCounts[category],
    0,
  );
  if (totalCount !== value.totalCount) {
    return failure('INVALID_MESSAGE', 'Итоговое число результатов не совпадает с категориями.');
  }
  return { ok: true, value: value as unknown as AuditStatusMessage };
}

function parseAuditError(
  value: Record<string, unknown>,
): MessageValidationResult<AuditErrorMessage> {
  if (
    !hasOnlyKeys(value, ['version', 'type', 'runId', 'code', 'message']) ||
    !isBoundedRunId(value.runId) ||
    typeof value.code !== 'string' ||
    !AUDIT_ERROR_CODES.has(value.code as AuditErrorCode) ||
    typeof value.message !== 'string' ||
    value.message.length === 0 ||
    value.message.length > MAX_ERROR_MESSAGE_LENGTH
  ) {
    return failure('INVALID_MESSAGE', 'Ошибка аудита имеет неверную структуру.');
  }
  return { ok: true, value: value as unknown as AuditErrorMessage };
}

export function parseResponseMessage(value: unknown): MessageValidationResult<ExtensionResponse> {
  const envelope = validateEnvelope(value);
  if (!envelope.ok) return envelope;
  if (envelope.value.type === 'AUDIT_STATUS') return parseAuditStatus(envelope.value);
  if (envelope.value.type === 'AUDIT_ERROR') return parseAuditError(envelope.value);
  return failure('INVALID_MESSAGE', 'Тип ответа не поддерживается.');
}

export function createAuditError(
  code: AuditErrorCode,
  message: string,
  runId: string | null = null,
): AuditErrorMessage {
  return {
    version: MESSAGE_VERSION,
    type: 'AUDIT_ERROR',
    runId,
    code,
    message: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
  };
}
