export class AuditCancelledError extends Error {
  public constructor() {
    super('Audit cancelled');
    this.name = 'AuditCancelledError';
  }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AuditCancelledError();
}

export class AuditCancellation {
  public readonly controller = new AbortController();

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public cancel(): void {
    this.controller.abort();
  }
}
