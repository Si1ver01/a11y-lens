export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';

export type LogMetadata = Readonly<Record<string, unknown>>;

export interface LogEntry {
  readonly level: Exclude<LogLevel, 'SILENT'>;
  readonly scope: string;
  readonly event: string;
  readonly metadata: Readonly<Record<string, LogMetadataValue>>;
}

export type LogMetadataValue =
  string | number | boolean | null | readonly (string | number | boolean)[];

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  debug(event: string, metadata?: LogMetadata): void;
  info(event: string, metadata?: LogMetadata): void;
  warn(event: string, metadata?: LogMetadata): void;
  error(event: string, metadata?: LogMetadata): void;
}
