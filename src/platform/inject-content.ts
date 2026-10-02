import { browser } from 'wxt/browser';

import { evaluateTabCapability, type TabCapability } from './capabilities';
import { MESSAGE_VERSION, parseResponseMessage } from '../messaging/schema';

const CONTENT_SCRIPT_PATH = '/content-scripts/content.js';

export async function injectIntoActiveTab(): Promise<TabCapability> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const capability = evaluateTabCapability(activeTab ?? {});

  if (!capability.supported) return capability;

  try {
    const response = await browser.tabs.sendMessage(capability.tabId, {
      version: MESSAGE_VERSION,
      type: 'GET_STATUS',
    });
    if (parseResponseMessage(response).ok) return capability;
  } catch {
    // The content script is not ready yet; inject it below.
  }

  await browser.scripting.executeScript({
    target: { tabId: capability.tabId },
    files: [CONTENT_SCRIPT_PATH],
  });

  return capability;
}
