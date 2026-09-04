import type { LogEntry, LogLevel, LogMetadata, LogMetadataValue, Logger, LogSink } from './types';

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  SILENT: 100,
};
const LOG_LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT']);
const FORBIDDEN_METADATA_KEYS = new Set([
  'accessibleName',
  'authorization',
  'computedColor',
  'cookie',
  'fullUrl',
  'hostname',
  'html',
  'pageData',
  'password',
  'payload',
  'selector',
  'secret',
  'text',
  'token',
  'url',
]);
const MAX_STRING_LENGTH = 160;
const MAX_ARRAY_LENGTH = 20;

export interface CreateLoggerOptions {
  readonly scope: string;
  readonly level?: LogLevel;
  readonly allowedMetadataKeys?: readonly string[];
  readonly sink?: LogSink;
}

export function resolveLogLevel(value: unknown, fallback: LogLevel): LogLevel {
  if (typeof value !== 'string') return fallback;
  const normalized = value.toUpperCase() as LogLevel;
  return LOG_LEVELS.has(normalized) ? normalized : fallback;
}

function sanitizeValue(value: unknown): LogMetadataValue | undefined {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (!Array.isArray(value)) return undefined;

  const sanitized = value
    .slice(0, MAX_ARRAY_LENGTH)
    .filter((item): item is string | number | boolean =>
      ['string', 'number', 'boolean'].includes(typeof item),
    )
    .map((item) => (typeof item === 'string' ? item.slice(0, MAX_STRING_LENGTH) : item));
  return sanitized;
}

function sanitizeMetadata(
  metadata: LogMetadata,
  allowedMetadataKeys: ReadonlySet<string>,
): Readonly<Record<string, LogMetadataValue>> {
  const sanitized: Record<string, LogMetadataValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedMetadataKeys.has(key) || FORBIDDEN_METADATA_KEYS.has(key)) continue;
    const safeValue = sanitizeValue(value);
    if (safeValue !== undefined) sanitized[key] = safeValue;
  }
  return sanitized;
}

function defaultSink(entry: LogEntry): void {
  const serializedEntry = JSON.stringify(entry);
  if (entry.level === 'ERROR') {
    console.error(serializedEntry);
    return;
  }
  if (entry.level === 'WARN') {
    console.warn(serializedEntry);
    return;
  }
  if (entry.level === 'INFO') {
    console.info(serializedEntry);
    return;
  }
  console.debug(serializedEntry);
}

const DEFAULT_LOG_LEVEL = resolveLogLevel(
  import.meta.env.WXT_LOG_LEVEL,
  import.meta.env.PROD ? 'SILENT' : 'INFO',
);

export function createLogger({
  scope,
  level = DEFAULT_LOG_LEVEL,
  allowedMetadataKeys = [],
  sink = defaultSink,
}: CreateLoggerOptions): Logger {
  const threshold = LEVEL_RANK[level];
  const allowedKeys = new Set(allowedMetadataKeys);

  const write = (
    entryLevel: Exclude<LogLevel, 'SILENT'>,
    event: string,
    metadata: LogMetadata = {},
  ) => {
    if (LEVEL_RANK[entryLevel] < threshold) return;
    sink({
      level: entryLevel,
      scope: scope.slice(0, MAX_STRING_LENGTH),
      event: event.slice(0, MAX_STRING_LENGTH),
      metadata: sanitizeMetadata(metadata, allowedKeys),
    });
  };

  return {
    debug: (event, metadata) => write('DEBUG', event, metadata),
    info: (event, metadata) => write('INFO', event, metadata),
    warn: (event, metadata) => write('WARN', event, metadata),
    error: (event, metadata) => write('ERROR', event, metadata),
  };
}
