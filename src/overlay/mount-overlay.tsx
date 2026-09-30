import { createRoot, type Root } from 'react-dom/client';

import type { AuditFinding, TargetRegistry } from '../audit';

import { OverlayRoot } from './OverlayRoot';
import styles from './styles.css?inline';

export interface AuditOverlayHandle {
  readonly update: (findings: readonly AuditFinding[], registry: TargetRegistry) => void;
  readonly unmount: () => void;
}

let activeOverlay: AuditOverlayHandle | undefined;

export function mountAuditOverlay(
  document: Document,
  findings: readonly AuditFinding[],
  registry: TargetRegistry,
  onClear: () => void,
): AuditOverlayHandle {
  activeOverlay?.unmount();
  const host = document.createElement('div');
  host.setAttribute('data-a11y-lens-overlay', 'root');
  host.setAttribute('aria-label', 'a11y-lens overlay');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  shadowRoot.append(style);
  const rootElement = document.createElement('div');
  shadowRoot.append(rootElement);
  document.documentElement.append(host);

  let currentFindings = findings;
  let currentRegistry = registry;
  let reactRoot: Root | undefined = createRoot(rootElement);
  const render = (): void => {
    reactRoot?.render(
      <OverlayRoot
        document={document}
        findings={currentFindings}
        registry={currentRegistry}
        onClear={onClear}
      />,
    );
  };
  const handle: AuditOverlayHandle = {
    update(nextFindings, nextRegistry) {
      currentFindings = nextFindings;
      currentRegistry = nextRegistry;
      render();
    },
    unmount() {
      reactRoot?.unmount();
      reactRoot = undefined;
      host.remove();
      if (activeOverlay === handle) activeOverlay = undefined;
    },
  };
  activeOverlay = handle;
  render();
  return handle;
}
