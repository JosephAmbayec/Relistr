// Types defined inline to avoid module imports
interface RelistrSettings {
  enabled: boolean;
  useGlobalSelectors: boolean;
  customRules: Record<string, any>;
  whitelist: string[];
  stats: {
    totalRemoved: number;
    lastReset: number;
  };
}

interface MessageRequest {
  action: 'getSettings' | 'updateSettings' | 'incrementStats' | 'getConfig' | 'toggle' | 'updatePageStats' | 'getPageStats' | 'zapperElementsChanged' | 'zapperStarted' | 'zapperStopped' | 'getZapperState';
  settings?: Partial<RelistrSettings>;
  count?: number;
  tabId?: number;
}

interface RelistrConfig {
  domains: Record<string, any>;
  globalSelectors: string[];
}

interface ZapperState {
  active: boolean;
  selectedCount: number;
  domain: string;
}

class RelistrBackground {
  private pageStats: Map<number, number> = new Map();
  private zapperStates: Map<number, ZapperState> = new Map();

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
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    
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
      whitelist: [],
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
        
      case 'zapperElementsChanged':
        if (sender.tab?.id) {
          const state = this.zapperStates.get(sender.tab.id);
          if (state) {
            state.selectedCount = request.count || 0;
            this.zapperStates.set(sender.tab.id, state);
            this.updateZapperBadge(sender.tab.id);
          }
        }
        sendResponse({ success: true });
        return true;
        
      case 'zapperStarted':
        if (sender.tab?.id && sender.tab.url) {
          const domain = this.normalizeDomain(new URL(sender.tab.url).hostname);
          this.zapperStates.set(sender.tab.id, {
            active: true,
            selectedCount: 0,
            domain
          });
          this.updateZapperBadge(sender.tab.id);
        }
        sendResponse({ success: true });
        return true;
        
      case 'zapperStopped':
        if (sender.tab?.id) {
          this.zapperStates.delete(sender.tab.id);
          this.updateBadge(sender.tab.id);
        }
        sendResponse({ success: true });
        return true;
        
      case 'getZapperState':
        const tabId = request.tabId || sender.tab?.id;
        if (tabId) {
          const state = this.zapperStates.get(tabId);
          sendResponse(state || { active: false, selectedCount: 0, domain: '' });
        } else {
          sendResponse({ active: false, selectedCount: 0, domain: '' });
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
    if (namespace === 'sync' && (changes.enabled || changes.whitelist)) {
      this.updateIcon();
      // Also update badge for current tab if whitelist changed
      if (changes.whitelist) {
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            this.updateBadge(tab.id);
          }
        });
      }
    }
  }

  private handleTabRemoved(tabId: number): void {
    this.pageStats.delete(tabId);
    this.zapperStates.delete(tabId);
  }

  private handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
    // Add a small delay to ensure tab is fully loaded
    setTimeout(() => {
      this.updateBadge(activeInfo.tabId);
      this.updateIcon();
    }, 100);
  }

  private handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    if (changeInfo.url) {
      this.updateIcon();
      this.updateBadge(tabId);
    }
  }

  private normalizeDomain(hostname: string): string {
    return hostname.replace(/^www\./, '').toLowerCase();
  }

  private async isTabWhitelisted(tabId: number): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) return false;
      
      // Skip chrome:// and extension pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return false;
      }
      
      const url = new URL(tab.url);
      const domain = this.normalizeDomain(url.hostname);
      
      const settings = await chrome.storage.sync.get(['whitelist']);
      const whitelist = settings.whitelist || [];
      
      const isWhitelisted = whitelist.some((whitelistDomain: string) => 
        domain === whitelistDomain || domain.endsWith('.' + whitelistDomain)
      );
      
      
      return isWhitelisted;
    } catch (error) {
      return false;
    }
  }

  private async isCurrentTabWhitelisted(): Promise<boolean> {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || !activeTab?.url) return false;
      
      return await this.isTabWhitelisted(activeTab.id);
    } catch (error) {
      return false;
    }
  }

  private async updateBadge(tabId: number): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['enabled']);
      const isEnabled = settings.enabled !== false;
      const isWhitelisted = await this.isTabWhitelisted(tabId);
      
      if (!isEnabled || isWhitelisted) {
        await chrome.action.setBadgeText({ text: '', tabId });
        return;
      }
      
      // Check if zapper is active for this tab
      const zapperState = this.zapperStates.get(tabId);
      if (zapperState && zapperState.active) {
        this.updateZapperBadge(tabId);
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

  private async updateZapperBadge(tabId: number): Promise<void> {
    try {
      const zapperState = this.zapperStates.get(tabId);
      if (zapperState && zapperState.active) {
        const badgeText = zapperState.selectedCount > 0 ? zapperState.selectedCount.toString() : '🎯';
        await chrome.action.setBadgeText({ text: badgeText, tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId });
      }
    } catch (error) {
      console.log(error);
    }
  }

  private async updateIcon(): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['enabled']);
      const isEnabled = settings.enabled !== false;
      const isCurrentTabWhitelisted = await this.isCurrentTabWhitelisted();
      
      // Show disabled icon if extension is disabled OR current tab is whitelisted
      const shouldShowDisabled = !isEnabled || isCurrentTabWhitelisted;
      
      const iconPath = shouldShowDisabled 
        ? {
            "16": "icons/icon-16-disabled.png",
            "32": "icons/icon-32-disabled.png", 
            "48": "icons/icon-48-disabled.png",
            "128": "icons/icon-128-disabled.png"
          }
        : {
            "16": "icons/icon-16.png",
            "32": "icons/icon-32.png",
            "48": "icons/icon-48.png",
            "128": "icons/icon-128.png"
          };
      await chrome.action.setIcon({ path: iconPath });
      
      // Clear badges when disabled, or maintain current badge when enabled
      if (shouldShowDisabled) {
        await chrome.action.setBadgeText({ text: '' });
      }
      
    } catch (error) {
      // Fallback - use badge if icons aren't available yet
      const settings = await chrome.storage.sync.get(['enabled']);
      const isEnabled = settings.enabled !== false;
      const isCurrentTabWhitelisted = await this.isCurrentTabWhitelisted();
      const shouldShowDisabled = !isEnabled || isCurrentTabWhitelisted;
      
      const badgeText = shouldShowDisabled ? '' : '';
      const badgeColor = '#ef4444';
      
      await chrome.action.setBadgeText({ text: badgeText });
      if (shouldShowDisabled) {
        await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      }
    }
  }
}

new RelistrBackground();