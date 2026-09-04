import { browser } from 'wxt/browser';

import { evaluateTabCapability, type TabCapability } from './capabilities';

const CONTENT_SCRIPT_PATH = '/content-scripts/content.js';

export async function injectIntoActiveTab(): Promise<TabCapability> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const capability = evaluateTabCapability(activeTab ?? {});

  if (!capability.supported) return capability;

  await browser.scripting.executeScript({
    target: { tabId: capability.tabId },
    files: [CONTENT_SCRIPT_PATH],
  });

  return capability;
}
