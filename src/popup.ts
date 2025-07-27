// Types defined inline to avoid module imports
interface RelistrSettings {
  enabled: boolean;
  customRules: Record<string, any>;
  stats: {
    totalRemoved: number;
    lastReset: number;
  };
}

interface RelistrConfig {
  domains: Record<string, any>;
  globalSelectors: string[];
}

interface MessageRequest {
  action: 'getSettings' | 'updateSettings' | 'incrementStats' | 'getConfig' | 'toggle' | 'updatePageStats' | 'getPageStats';
  settings?: Partial<RelistrSettings>;
  count?: number;
}

class RelistrPopup {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.loadTheme();
    await this.loadSettings();
    await this.updateDomainStatus();
    await this.loadPageStats();
    this.bindEvents();
  }

  private loadTheme(): void {
    const savedTheme = localStorage.getItem('relistr-theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  private updateThemeIcon(theme: string): void {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  private toggleTheme(): void {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('relistr-theme', newTheme);
    this.updateThemeIcon(newTheme);
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get() as RelistrSettings;
      
      const enableToggle = document.getElementById('enableToggle') as HTMLInputElement;
      const globalSelectorsToggle = document.getElementById('globalSelectorsToggle') as HTMLInputElement;
      const totalRemovedSpan = document.getElementById('totalRemoved') as HTMLSpanElement;
      
      if (enableToggle) {
        enableToggle.checked = settings.enabled !== false;
      }
      
      if (globalSelectorsToggle) {
        globalSelectorsToggle.checked = settings.useGlobalSelectors !== false;
      }
      
      if (totalRemovedSpan) {
        totalRemovedSpan.textContent = (settings.stats?.totalRemoved || 0).toString();
      }
    } catch (error) {
    }
  }

  private async loadPageStats(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      // Get page stats from content script via background
      chrome.tabs.sendMessage(tab.id, { action: 'getPageStats' }, (response) => {
        if (chrome.runtime.lastError) {
          this.updatePageStatsDisplay(0);
          return;
        }
        
        const count = response?.removedCount || 0;
        this.updatePageStatsDisplay(count);
      });
    } catch (error) {
      this.updatePageStatsDisplay(0);
    }
  }

  private updatePageStatsDisplay(count: number): void {
    const pageRemovedSpan = document.getElementById('pageRemoved') as HTMLSpanElement;
    if (pageRemovedSpan) {
      pageRemovedSpan.textContent = count.toString();
    }
  }

  private normalizeDomain(hostname: string): string {
    return hostname.replace(/^www\./, '').toLowerCase();
  }

  private async updateDomainStatus(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url) return;
      
      const rawDomain = new URL(tab.url).hostname;
      const domain = this.normalizeDomain(rawDomain);
      
      // Check for whitelist first
      const settings = await chrome.storage.sync.get(['customRules', 'useGlobalSelectors', 'whitelist']);
      const whitelist = settings.whitelist || [];
      const isWhitelisted = whitelist.some((whitelistDomain: string) => 
        domain === whitelistDomain || domain.endsWith('.' + whitelistDomain)
      );
      
      const statusElement = document.getElementById('domainStatus') as HTMLDivElement;
      if (statusElement) {
        if (isWhitelisted) {
          statusElement.className = 'domain-status domain-whitelisted';
          statusElement.innerHTML = `<span class="status-icon">🚫</span><span>${domain} is whitelisted (disabled)</span>`;
          return;
        }
        
        const hasCustomRules = settings.customRules && settings.customRules[domain];
        const globalSelectorsEnabled = settings.useGlobalSelectors !== false;
        
        // Check built-in config
        const config = await this.getConfig();
        const hasBuiltInRules = config?.domains?.[domain] || 
                               Object.keys(config?.domains || {}).some(d => {
                                 const normalizedConfigDomain = this.normalizeDomain(d);
                                 return normalizedConfigDomain.startsWith('*.') 
                                   ? domain.endsWith(normalizedConfigDomain.substring(2))
                                   : normalizedConfigDomain === domain;
                               });
        
        if (hasCustomRules) {
          statusElement.className = 'domain-status domain-supported';
          statusElement.innerHTML = `<span class="status-icon">⭐</span><span>${domain} uses custom rules</span>`;
        } else if (hasBuiltInRules) {
          statusElement.className = 'domain-status domain-supported';
          statusElement.innerHTML = `<span class="status-icon">✅</span><span>${domain} is supported</span>`;
        } else if (globalSelectorsEnabled) {
          statusElement.className = 'domain-status domain-unsupported';
          statusElement.innerHTML = `<span class="status-icon">⚠️</span><span>${domain} uses global rules only</span>`;
        } else {
          statusElement.className = 'domain-status domain-error';
          statusElement.innerHTML = `<span class="status-icon">❌</span><span>${domain} has no blocking rules</span>`;
        }
      }
    } catch (error) {
    }
  }

  private async getConfig(): Promise<RelistrConfig | null> {
    return new Promise((resolve) => {
      const request: MessageRequest = { action: 'getConfig' };
      chrome.runtime.sendMessage(request, resolve);
    });
  }

  private bindEvents(): void {
    const enableToggle = document.getElementById('enableToggle') as HTMLInputElement;
    const globalSelectorsToggle = document.getElementById('globalSelectorsToggle') as HTMLInputElement;
    const resetStatsBtn = document.getElementById('resetStats') as HTMLButtonElement;
    const openOptionsBtn = document.getElementById('openOptions') as HTMLButtonElement;
    const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;

    if (enableToggle) {
      enableToggle.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        try {
          await chrome.storage.sync.set({ enabled: target.checked });
          
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab.id) {
            chrome.tabs.reload(tab.id);
          }
        } catch (error) {
        }
      });
    }

    if (globalSelectorsToggle) {
      globalSelectorsToggle.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        try {
          await chrome.storage.sync.set({ useGlobalSelectors: target.checked });
          
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab.id) {
            chrome.tabs.reload(tab.id);
          }
        } catch (error) {
        }
      });
    }

    if (resetStatsBtn) {
      resetStatsBtn.addEventListener('click', async () => {
        await chrome.storage.sync.set({ 
          stats: { totalRemoved: 0, lastReset: Date.now() }
        });
        
        const totalRemovedSpan = document.getElementById('totalRemoved') as HTMLSpanElement;
        if (totalRemovedSpan) {
          totalRemovedSpan.textContent = '0';
        }
      });
    }

    if (openOptionsBtn) {
      openOptionsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RelistrPopup();
});