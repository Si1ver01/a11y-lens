const DEFAULT_TARGET_PREFIX = 'a11y-target';

export interface TargetRegistryOptions {
  readonly prefix?: string;
}

/**
 * Maps live DOM elements to short-lived IDs used only during one content-script run.
 * The registry never creates selectors or serializes DOM/page data.
 */
export class TargetRegistry {
  private readonly ids = new WeakMap<Element, string>();

  private readonly elements = new Map<string, Element>();

  private readonly prefix: string;

  private sequence = 0;

  public constructor({ prefix = DEFAULT_TARGET_PREFIX }: TargetRegistryOptions = {}) {
    this.prefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || DEFAULT_TARGET_PREFIX;
  }

  public register(element: Element): string {
    const existing = this.ids.get(element);
    if (existing) return existing;

    const id = `${this.prefix}-${++this.sequence}`;
    this.ids.set(element, id);
    this.elements.set(id, element);
    return id;
  }

  public resolve(id: string, document: Document): Element | undefined {
    const element = this.elements.get(id);
    if (!element || element.ownerDocument !== document || !element.isConnected) return undefined;
    return element;
  }

  public has(id: string): boolean {
    return this.elements.has(id);
  }

  public size(): number {
    return this.elements.size;
  }

  public clear(): void {
    this.elements.clear();
    this.sequence = 0;
  }
}
