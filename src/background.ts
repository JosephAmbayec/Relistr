// Types defined inline to avoid module imports
interface RelistrSettings {
  enabled: boolean;
  customRules: Record<string, any>;
  stats: {
    totalRemoved: number;
    lastReset: number;
  };
}

interface MessageRequest {
  action: 'getSettings' | 'updateSettings' | 'incrementStats' | 'getConfig' | 'toggle' | 'updatePageStats' | 'getPageStats';
  settings?: Partial<RelistrSettings>;
  count?: number;
}

interface RelistrConfig {
  domains: Record<string, any>;
  globalSelectors: string[];
}

class RelistrBackground {
  private pageStats: Map<number, number> = new Map();

  constructor() {
    this.init();
  }

  private init(): void {
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
    chrome.action.onClicked.addListener(this.handleActionClick.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    
    // Update icon on startup
    this.updateIcon();
  }

  private async handleInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
    if (details.reason === 'install') {
      await this.setDefaultSettings();
    }
  }

  private async setDefaultSettings(): Promise<void> {
    const defaultSettings: RelistrSettings = {
      enabled: true,
      useGlobalSelectors: true,
      customRules: {},
      stats: {
        totalRemoved: 0,
        lastReset: Date.now()
      }
    };

    await chrome.storage.sync.set(defaultSettings);
    this.updateIcon();
  }

  private handleActionClick(tab: chrome.tabs.Tab): void {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
    }
  }

  private handleMessage(
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    switch (request.action) {
      case 'getSettings':
        chrome.storage.sync.get().then((settings: any) => {
          sendResponse(settings);
        });
        return true;
        
      case 'updateSettings':
        if (request.settings) {
          chrome.storage.sync.set(request.settings).then(() => {
            this.updateIcon();
            sendResponse({ success: true });
          });
        }
        return true;
        
      case 'incrementStats':
        this.incrementStats(request.count).then(() => {
          sendResponse({ success: true });
        });
        return true;
        
      case 'getConfig':
        this.getConfig().then((config: RelistrConfig | null) => {
          sendResponse(config);
        });
        return true;
        
      case 'updatePageStats':
        if (sender.tab?.id && request.count !== undefined) {
          this.pageStats.set(sender.tab.id, request.count);
          this.updateBadge(sender.tab.id);
        }
        sendResponse({ success: true });
        return true;
        
      case 'getPageStats':
        if (sender.tab?.id) {
          const count = this.pageStats.get(sender.tab.id) || 0;
          sendResponse({ removedCount: count });
        } else {
          sendResponse({ removedCount: 0 });
        }
        return true;
    }
    
    return false;
  }

  private async incrementStats(count: number = 1): Promise<void> {
    const result = await chrome.storage.sync.get(['stats']);
    const stats = result.stats || { totalRemoved: 0, lastReset: Date.now() };
    
    stats.totalRemoved += count;
    await chrome.storage.sync.set({ stats });
  }

  private async getConfig(): Promise<RelistrConfig | null> {
    try {
      const response = await fetch(chrome.runtime.getURL('config.json'));
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  private handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, namespace: string): void {
    if (namespace === 'sync' && changes.enabled) {
      this.updateIcon();
    }
  }

  private handleTabRemoved(tabId: number): void {
    this.pageStats.delete(tabId);
  }

  private handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
    this.updateBadge(activeInfo.tabId);
  }

  private async updateBadge(tabId: number): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['enabled']);
      const isEnabled = settings.enabled !== false;
      
      if (!isEnabled) {
        await chrome.action.setBadgeText({ text: '', tabId });
        return;
      }
      
      const count = this.pageStats.get(tabId) || 0;
      const badgeText = count > 0 ? count.toString() : '';
      
      await chrome.action.setBadgeText({ text: badgeText, tabId });
      if (count > 0) {
        await chrome.action.setBadgeBackgroundColor({ color: '#44ef58', tabId });
      }
    } catch (error) {
      console.log(error)
    }
  }

  private async updateIcon(): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['enabled']);
      const isEnabled = settings.enabled !== false;
      
      const iconPath = isEnabled 
        ? {
            "16": "icons/icon-16.png",
            "32": "icons/icon-32.png",
            "48": "icons/icon-48.png",
            "128": "icons/icon-128.png"
          }
        : {
            "16": "icons/icon-16-disabled.png",
            "32": "icons/icon-32-disabled.png", 
            "48": "icons/icon-48-disabled.png",
            "128": "icons/icon-128-disabled.png"
          };

      await chrome.action.setIcon({ path: iconPath });
      
      // Clear badges when disabled, or maintain current badge when enabled
      if (!isEnabled) {
        await chrome.action.setBadgeText({ text: '' });
      }
      
    } catch (error) {
      console.log(error)
      // Fallback - use badge if icons aren't available yet
      const settings = await chrome.storage.sync.get(['enabled']);
      const isEnabled = settings.enabled !== false;
      
      const badgeText = isEnabled ? '' : '';
      const badgeColor = '#ef4444';
      
      await chrome.action.setBadgeText({ text: badgeText });
      if (!isEnabled) {
        await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      }
    }
  }
}

new RelistrBackground();