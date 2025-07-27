// Types defined inline to avoid module imports
interface DomainConfig {
  selectors?: string[];
  textMatches?: string[];
  attributes?: Array<{
    name: string;
    value: string;
  }>;
}

interface RelistrConfig {
  domains: Record<string, any>;
  globalSelectors: string[];
}

class RelistrDOMManipulator {
  private config: RelistrConfig | null = null;
  private currentDomain: string;
  private observer: MutationObserver | null = null;
  private removedCount: number = 0;
  private enabled: boolean = true;

  constructor() {
    this.currentDomain = this.normalizeDomain(window.location.hostname);
    this.init();
  }

  private async init(): Promise<void> {
    await this.checkEnabled();
    if (!this.enabled) return;
    
    await this.loadConfig();
    this.setupMutationObserver();
    this.setupStorageListener();
    this.removeExistingElements();
  }

  private async checkEnabled(): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['enabled', 'useGlobalSelectors', 'customRules']);
      this.enabled = settings.enabled !== false;
      
      // Store settings for use in scanning
      (this as any).useGlobalSelectors = settings.useGlobalSelectors !== false;
      (this as any).customRules = settings.customRules || {};
      
    } catch (error) {
      this.enabled = true;
      (this as any).useGlobalSelectors = true;
      (this as any).customRules = {};
    }
  }

  private normalizeDomain(hostname: string): string {
    return hostname.replace(/^www\./, '').toLowerCase();
  }

  private async loadConfig(): Promise<void> {
    try {
      const response = await fetch(chrome.runtime.getURL('config.json'));
      this.config = await response.json();
    } catch (error) {
    }
  }

  private getDomainConfig(): DomainConfig | null {
    let domainConfig: DomainConfig | null = null;
    
    // First check custom rules
    const customRules = (this as any).customRules || {};
    
    if (customRules[this.currentDomain]) {
      domainConfig = customRules[this.currentDomain];
    }
    
    // Then check built-in config
    if (!domainConfig && this.config) {
      const exactMatch = this.config.domains[this.currentDomain];
      if (exactMatch) {
        domainConfig = exactMatch;
      } else {
        const wildcardMatch = Object.keys(this.config.domains).find(domain => {
          const normalizedConfigDomain = this.normalizeDomain(domain);
          
          if (normalizedConfigDomain.startsWith('*.')) {
            const baseDomain = normalizedConfigDomain.substring(2);
            return this.currentDomain.endsWith(baseDomain);
          }
          
          return normalizedConfigDomain === this.currentDomain;
        });
        
        if (wildcardMatch) {
          domainConfig = this.config.domains[wildcardMatch];
        }
      }
    }


    return domainConfig;
  }

  private removeExistingElements(): void {
    this.scanAndRemove(document);
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.scanAndRemove(node as Element);
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && (changes.customRules || changes.enabled || changes.useGlobalSelectors)) {
        this.checkEnabled().then(() => {
          // Re-scan the page with updated settings
          this.removeExistingElements();
        });
      }
    });
  }

  private scanAndRemove(root: Document | Element): void {
    if (!this.enabled) return;
    
    const domainConfig = this.getDomainConfig();
    
    const elementsToRemove = new Set<Element>();

    if (domainConfig?.selectors) {
      domainConfig.selectors.forEach(selector => {
        try {
          const elements = 'querySelectorAll' in root ? 
            root.querySelectorAll(selector) : [];
          elements.forEach(el => elementsToRemove.add(el));
        } catch (error) {
        }
      });
    }

    // Only use global selectors if enabled
    if ((this as any).useGlobalSelectors && this.config?.globalSelectors) {
      this.config.globalSelectors.forEach(selector => {
        try {
          const elements = 'querySelectorAll' in root ? 
            root.querySelectorAll(selector) : [];
          elements.forEach(el => elementsToRemove.add(el));
        } catch (error) {
        }
      });
    }

    if (domainConfig?.textMatches) {
      this.findElementsByText(root, domainConfig.textMatches)
        .forEach(el => elementsToRemove.add(el));
    }

    if (domainConfig?.attributes) {
      this.findElementsByAttributes(root, domainConfig.attributes)
        .forEach(el => elementsToRemove.add(el));
    }

    elementsToRemove.forEach(element => {
      this.removeElement(element);
    });
  }

  private findElementsByText(root: Document | Element, textMatches: string[]): Element[] {
    const elements: Element[] = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim() || '';
      if (textMatches.some(match => text.includes(match))) {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          if (this.isLikelyAdContainer(parent, text)) {
            elements.push(parent);
            break;
          }
          parent = parent.parentElement;
        }
      }
    }

    return elements;
  }

  private findElementsByAttributes(
    root: Document | Element, 
    attributes: Array<{ name: string; value: string }>
  ): Element[] {
    const elements: Element[] = [];
    
    attributes.forEach(attr => {
      const selector = attr.value === '*' 
        ? `[${attr.name}]` 
        : `[${attr.name}="${attr.value}"]`;
      
      try {
        const found = 'querySelectorAll' in root ? 
          Array.from(root.querySelectorAll(selector)) : [];
        elements.push(...found);
      } catch (error) {
      }
    });

    return elements;
  }

  // Simple heuristic to check if an element is likely an ad container, not fully accurate
  private isLikelyAdContainer(element: Element, sponsoredText: string): boolean {
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
    const adIndicators = ['ad', 'sponsor', 'promo', 'commercial'];
    const containerTags = ['div', 'article', 'section', 'aside', 'li'];

    return containerTags.includes(tagName) && 
           (adIndicators.some(indicator => 
             className.toLowerCase().includes(indicator) || 
             id.toLowerCase().includes(indicator)
           ) || (element.textContent?.includes(sponsoredText) ?? false));
  }

  private removeElement(element: Element): void {
    if (element && element.parentNode) {
      (element as HTMLElement).style.display = 'none';
      element.setAttribute('data-relistr-removed', 'true');
      this.removedCount++;
      
      // Update stats in storage
      this.updateStats();
      
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 100);
    }
  }

  private async updateStats(): Promise<void> {
    try {
      chrome.runtime.sendMessage({ action: 'incrementStats', count: 1 });
    } catch (error) {
    }
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  public async toggle(): Promise<void> {
    await this.checkEnabled();
    if (this.enabled && !this.observer) {
      await this.init();
    } else if (!this.enabled && this.observer) {
      this.destroy();
    }
  }
}


// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle') {
    // Handle toggle if needed
    sendResponse({ success: true });
  }
});

let relistrInstance: RelistrDOMManipulator;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    relistrInstance = new RelistrDOMManipulator();
    (window as any).relistrInstance = relistrInstance;
  });
} else {
  relistrInstance = new RelistrDOMManipulator();
  (window as any).relistrInstance = relistrInstance;
}