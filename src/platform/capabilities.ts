export type TabCapabilityCode =
  'TAB_ID_MISSING' | 'TAB_DISCARDED' | 'URL_MISSING' | 'URL_RESTRICTED';

export interface SupportedTabCapability {
  readonly supported: true;
  readonly tabId: number;
  readonly scheme: string;
}

export interface UnsupportedTabCapability {
  readonly supported: false;
  readonly code: TabCapabilityCode;
  readonly scheme?: string;
}

export type TabCapability = SupportedTabCapability | UnsupportedTabCapability;

export interface TabDescriptor {
  readonly id?: number;
  readonly url?: string;
  readonly discarded?: boolean;
}

const SUPPORTED_SCHEMES = new Set(['http:', 'https:', 'file:']);

export function evaluateTabCapability(tab: TabDescriptor): TabCapability {
  if (tab.id === undefined) return { supported: false, code: 'TAB_ID_MISSING' };
  if (tab.discarded) return { supported: false, code: 'TAB_DISCARDED' };
  if (!tab.url) return { supported: false, code: 'URL_MISSING' };

  let scheme: string;
  try {
    scheme = new URL(tab.url).protocol;
  } catch {
    return { supported: false, code: 'URL_RESTRICTED' };
  }

  if (!SUPPORTED_SCHEMES.has(scheme)) {
    return { supported: false, code: 'URL_RESTRICTED', scheme };
  }

  return { supported: true, tabId: tab.id, scheme };
}
