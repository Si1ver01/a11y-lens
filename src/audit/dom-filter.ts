const DEFAULT_OVERLAY_ATTRIBUTE = 'data-a11y-lens-overlay';

export interface DomFilterOptions {
  readonly document: Document;
  readonly overlayAttribute?: string;
}

export type AuditRoot = Document | Element | ShadowRoot;

function hasAncestorAttribute(element: Element, attribute: string): boolean {
  return Boolean(element.closest(`[${attribute}]`));
}

export function isOwnedOverlay(
  element: Element,
  overlayAttribute = DEFAULT_OVERLAY_ATTRIBUTE,
): boolean {
  return hasAncestorAttribute(element, overlayAttribute);
}

export function isHiddenOrInert(element: Element, document: Document): boolean {
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return true;
  if (hasAncestorAttribute(element, 'hidden')) return true;
  if (hasAncestorAttribute(element, 'inert')) return true;
  if (element.closest('[aria-hidden="true"]')) return true;

  const view = document.defaultView;
  if (!view) return false;

  const style = view.getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden';
}

export function isDetached(element: Element, document: Document): boolean {
  return element.ownerDocument !== document || !element.isConnected;
}

export function isAuditCandidate(
  element: Element,
  { document, overlayAttribute = DEFAULT_OVERLAY_ATTRIBUTE }: DomFilterOptions,
): boolean {
  if (isDetached(element, document)) return false;
  if (isOwnedOverlay(element, overlayAttribute)) return false;
  if (isHiddenOrInert(element, document)) return false;
  return true;
}

export function collectAuditElements(
  root: AuditRoot,
  options: DomFilterOptions,
): readonly Element[] {
  const elements: Element[] = [];
  if (root instanceof Element && isAuditCandidate(root, options)) elements.push(root);

  for (const element of root.querySelectorAll('*')) {
    if (isAuditCandidate(element, options)) elements.push(element);
  }

  return elements;
}

export function registerAuditTargets(
  elements: readonly Element[],
  registry: { register(element: Element): string },
): ReadonlyMap<Element, string> {
  const targets = new Map<Element, string>();
  for (const element of elements) targets.set(element, registry.register(element));
  return targets;
}

export { DEFAULT_OVERLAY_ATTRIBUTE };
