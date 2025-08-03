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
  private zapperMode: boolean = false;
  private selectedElements: Element[] = [];
  private highlightedElement: Element | null = null;
  private zapperOverlay: HTMLDivElement | null = null;

  constructor() {
    this.currentDomain = this.normalizeDomain(window.location.hostname);
    this.init();
  }

  private async init(): Promise<void> {
    await this.checkEnabled();
    
    this.removedCount = 0;
    this.notifyPageStats();
    
    if (!this.enabled) return;
    
    await this.loadConfig();
    this.setupMutationObserver();
    this.setupStorageListener();
    this.removeExistingElements();
  }

  private async checkEnabled(): Promise<void> {
    try {
      const settings = await chrome.storage.sync.get(['enabled', 'useGlobalSelectors', 'customRules', 'whitelist']);
      
      // Check if current domain is whitelisted
      const whitelist = settings.whitelist || [];
      const isWhitelisted = whitelist.some((domain: string) => 
        this.currentDomain === domain || this.currentDomain.endsWith('.' + domain)
      );
      
      this.enabled = (settings.enabled !== false) && !isWhitelisted;
      
      
      // Store settings for use in scanning
      (this as any).useGlobalSelectors = settings.useGlobalSelectors !== false;
      (this as any).customRules = settings.customRules || {};
      (this as any).whitelist = whitelist;
      
    } catch (error) {
      this.enabled = true;
      (this as any).useGlobalSelectors = true;
      (this as any).customRules = {};
      (this as any).whitelist = [];
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
      if (namespace === 'sync' && (changes.customRules || changes.enabled || changes.useGlobalSelectors || changes.whitelist)) {
        this.checkEnabled().then(() => {
          if (this.enabled && !this.observer) {
            this.loadConfig().then(() => {
              this.setupMutationObserver();
              this.removeExistingElements();
            });
          } else if (this.enabled && this.observer) {
            this.removeExistingElements();
          } else if (!this.enabled && this.observer) {
            this.destroy();
          }
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

    // Remove elements and track count in batch
    const removedCount = elementsToRemove.size;
    if (removedCount > 0) {
      elementsToRemove.forEach(element => {
        this.removeElementWithoutStats(element);
      });
      
      // Update stats with total batch count
      this.removedCount += removedCount;
      this.updateStats(removedCount);
      this.notifyPageStats();
    }
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
      if (attr.value === '*') {
        // Find any element with this attribute, regardless of value
        const selector = `[${attr.name}]`;
        try {
          const found = 'querySelectorAll' in root ? 
            Array.from(root.querySelectorAll(selector)) : [];
          elements.push(...found);
        } catch (error) {
        }
      } else {
        const selector = `[${attr.name}]`;
        try {
          const candidateElements = 'querySelectorAll' in root ? 
            Array.from(root.querySelectorAll(selector)) : [];
          
          const matchingElements = candidateElements.filter(element => {
            const attributeValue = element.getAttribute(attr.name) || '';
            return attributeValue.toLowerCase().includes(attr.value.toLowerCase());
          });
          
          elements.push(...matchingElements);
        } catch (error) {
        }
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

  private removeElement(element: Element, updateStats: boolean = true): void {
    if (element && element.parentNode) {
      (element as HTMLElement).style.display = 'none';
      element.setAttribute('data-relistr-removed', 'true');
      
      if (updateStats) {
        this.removedCount++;
        this.updateStats(1);
        this.notifyPageStats();
      }
      
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 100);
    }
  }

  private removeElementWithoutStats(element: Element): void {
    if (element && element.parentNode) {
      (element as HTMLElement).style.display = 'none';
      element.setAttribute('data-relistr-removed', 'true');
      
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 100);
    }
  }

  private notifyPageStats(): void {
    try {
      chrome.runtime.sendMessage({ action: 'updatePageStats', count: this.removedCount });
    } catch (error) {
      // Ignore if popup is not open
    }
  }

  private async updateStats(count: number = 1): Promise<void> {
    try {
      chrome.runtime.sendMessage({ action: 'incrementStats', count: count });
    } catch (error) {
    }
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.removedCount = 0;
    this.notifyPageStats();
  }

  public async toggle(): Promise<void> {
    await this.checkEnabled();
    if (this.enabled && !this.observer) {
      await this.init();
    } else if (!this.enabled && this.observer) {
      this.destroy();
    }
  }

  public getPageStats(): { removedCount: number; domain: string } {
    return {
      removedCount: this.removedCount,
      domain: this.currentDomain
    };
  }

  public startZapperMode(): void {
    this.zapperMode = true;
    this.selectedElements = [];
    this.createZapperStyles();
    this.addZapperEventListeners();
    document.body.style.cursor = 'crosshair';
    
    // Notify background script
    chrome.runtime.sendMessage({ action: 'zapperStarted' });
  }

  public stopZapperMode(): void {
    this.zapperMode = false;
    this.selectedElements = [];
    this.removeZapperHighlight();
    this.removeZapperEventListeners();
    this.removeZapperStyles();
    document.body.style.cursor = '';
    if (this.zapperOverlay) {
      this.zapperOverlay.remove();
      this.zapperOverlay = null;
    }
    
    // Notify background script
    chrome.runtime.sendMessage({ action: 'zapperStopped' });
  }

  public getSelectedElements(): Element[] {
    return [...this.selectedElements];
  }

  public async saveZapperRules(): Promise<void> {
    if (this.selectedElements.length === 0) return;

    const rules = this.generateConfigFromElements(this.selectedElements);
    await this.saveCustomRules(rules);
    this.stopZapperMode();
  }

  private createZapperStyles(): void {
    const style = document.createElement('style');
    style.id = 'relistr-zapper-styles';
    style.textContent = `
      .relistr-highlight {
        outline: 3px solid #f59e0b !important;
        outline-offset: 2px !important;
        background-color: rgba(245, 158, 11, 0.1) !important;
        position: relative !important;
      }
      .relistr-selected {
        outline: 3px solid #10b981 !important;
        outline-offset: 2px !important;
        background-color: rgba(16, 185, 129, 0.2) !important;
      }
      .relistr-zapper-info {
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        background: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        z-index: 999999 !important;
        max-width: 320px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  private removeZapperStyles(): void {
    const style = document.getElementById('relistr-zapper-styles');
    if (style) style.remove();
    
    document.querySelectorAll('.relistr-highlight, .relistr-selected').forEach(el => {
      el.classList.remove('relistr-highlight', 'relistr-selected');
    });
  }

  private addZapperEventListeners(): void {
    document.addEventListener('mouseover', this.handleZapperMouseOver);
    document.addEventListener('mouseout', this.handleZapperMouseOut);
    document.addEventListener('click', this.handleZapperClick);
    document.addEventListener('keydown', this.handleZapperKeydown);
  }

  private removeZapperEventListeners(): void {
    document.removeEventListener('mouseover', this.handleZapperMouseOver);
    document.removeEventListener('mouseout', this.handleZapperMouseOut);
    document.removeEventListener('click', this.handleZapperClick);
    document.removeEventListener('keydown', this.handleZapperKeydown);
  }

  private handleZapperMouseOver = (e: MouseEvent): void => {
    if (!this.zapperMode) return;
    
    const target = e.target as Element;
    if (target && target !== document.body && target !== document.documentElement) {
      this.highlightElement(target);
    }
  };

  private handleZapperMouseOut = (e: MouseEvent): void => {
    if (!this.zapperMode) return;
    this.removeZapperHighlight();
  };

  private handleZapperClick = (e: MouseEvent): void => {
    if (!this.zapperMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target as Element;
    if (target && target !== document.body && target !== document.documentElement) {
      this.selectElement(target);
    }
  };

  private handleZapperKeydown = (e: KeyboardEvent): void => {
    if (!this.zapperMode) return;
    
    if (e.key === 'Escape') {
      this.stopZapperMode();
      chrome.runtime.sendMessage({ action: 'zapperCancelled' });
    }
  };

  private highlightElement(element: Element): void {
    this.removeZapperHighlight();
    
    // Don't highlight elements that have already been removed by Relistr
    if (element.hasAttribute('data-relistr-removed')) {
      return;
    }
    
    if (!this.selectedElements.includes(element)) {
      element.classList.add('relistr-highlight');
      this.highlightedElement = element;
      this.showElementInfo(element);
    }
  }

  private removeZapperHighlight(): void {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove('relistr-highlight');
      this.highlightedElement = null;
    }
    this.hideElementInfo();
  }

  private selectElement(element: Element): void {
    // Don't select elements that have already been removed by Relistr
    if (element.hasAttribute('data-relistr-removed')) {
      return;
    }
    
    if (this.selectedElements.includes(element)) {
      this.selectedElements = this.selectedElements.filter(el => el !== element);
      element.classList.remove('relistr-selected');
    } else {
      this.selectedElements.push(element);
      element.classList.add('relistr-selected');
    }
    
    element.classList.remove('relistr-highlight');
    this.highlightedElement = null;
    
    chrome.runtime.sendMessage({ 
      action: 'zapperElementsChanged', 
      count: this.selectedElements.length 
    });
  }

  private showElementInfo(element: Element): void {
    this.hideElementInfo();
    
    const info = this.zapperOverlay = document.createElement('div');
    info.className = 'relistr-zapper-info';
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${Array.from(element.classList).join('.')}` : '';
    const id = element.id ? `#${element.id}` : '';
    const attributes = Array.from(element.attributes)
      .filter(attr => attr.name !== 'class' && attr.name !== 'id')
      .map(attr => `${attr.name}="${attr.value}"`)
      .slice(0, 3);
    
    info.innerHTML = `
      <div><strong>Tag:</strong> ${tagName}${id}${className}</div>
      ${attributes.length > 0 ? `<div><strong>Attributes:</strong> ${attributes.join(', ')}</div>` : ''}
      <div><strong>Selected:</strong> ${this.selectedElements.length} elements</div>
      <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">
        Click to select • ESC to exit
      </div>
    `;
    
    document.body.appendChild(info);
  }

  private hideElementInfo(): void {
    if (this.zapperOverlay) {
      this.zapperOverlay.remove();
      this.zapperOverlay = null;
    }
  }

  private generateConfigFromElements(elements: Element[]): DomainConfig {
    const selectors: string[] = [];
    const textMatches: string[] = [];
    const attributes: Array<{ name: string; value: string }> = [];
    
    elements.forEach(element => {
      // Try to generate a unique CSS selector
      const selector = this.generateCSSSelector(element);
      if (selector && !selectors.includes(selector)) {
        selectors.push(selector);
      }
      
      // Extract text patterns
      const text = element.textContent?.trim();
      if (text && text.length < 100) {
        const words = text.split(/\s+/).filter(word => word.length > 3);
        words.forEach(word => {
          if (!textMatches.includes(word) && textMatches.length < 5) {
            textMatches.push(word);
          }
        });
      }
      
      // Extract useful attributes
      Array.from(element.attributes).forEach(attr => {
        if (this.isUsefulAttribute(attr.name, attr.value) && !this.isRelistrAttribute(attr.name, attr.value)) {
          const attrRule = { name: attr.name, value: attr.value };
          if (!attributes.some(a => a.name === attrRule.name && a.value === attrRule.value)) {
            attributes.push(attrRule);
          }
        }
      });
    });
    
    return {
      selectors: selectors.length > 0 ? selectors : undefined,
      textMatches: textMatches.length > 0 ? textMatches : undefined,
      attributes: attributes.length > 0 ? attributes : undefined
    };
  }

  private generateCSSSelector(element: Element): string {
    // Prioritize by ID, then class, then attributes
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = Array.from(element.classList)
        .filter(cls => cls.length > 0)
        .filter(cls => !this.isRelistrClass(cls));
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }
    
    // Try data attributes
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-') && attr.value) {
        return `[${attr.name}="${attr.value}"]`;
      }
    }
    
    // Fallback to tag name with specific attributes
    const tagName = element.tagName.toLowerCase();
    for (const attr of Array.from(element.attributes)) {
      if (this.isUsefulAttribute(attr.name, attr.value)) {
        return `${tagName}[${attr.name}*="${attr.value}"]`;
      }
    }
    
    return `${tagName}`;
  }

  private isUsefulAttribute(name: string, value: string): boolean {
    const usefulAttrs = ['data-testid', 'data-test', 'aria-label', 'role', 'class'];
    const adKeywords = ['ad', 'sponsor', 'promo', 'commercial', 'advertisement'];
    
    return usefulAttrs.includes(name) || 
           adKeywords.some(keyword => value.toLowerCase().includes(keyword));
  }

  private isRelistrClass(className: string): boolean {
    const relistrClasses = ['relistr-highlight', 'relistr-selected', 'relistr-zapper-info'];
    return relistrClasses.includes(className) || className.startsWith('relistr-');
  }

  private isRelistrAttribute(name: string, value: string): boolean {
    // Filter out Relistr's own attributes
    if (name === 'data-relistr-removed') return true;
    if (name === 'class' && value.includes('relistr-')) return true;
    return false;
  }

  private async saveCustomRules(newRules: DomainConfig): Promise<void> {
    try {
      const { customRules = {} } = await chrome.storage.sync.get(['customRules']);
      
      // Merge with existing rules for this domain
      const existingRules = customRules[this.currentDomain] || {};
      const mergedRules: DomainConfig = {
        selectors: [...(existingRules.selectors || []), ...(newRules.selectors || [])],
        textMatches: [...(existingRules.textMatches || []), ...(newRules.textMatches || [])],
        attributes: [...(existingRules.attributes || []), ...(newRules.attributes || [])]
      };
      
      // Remove duplicates
      if (mergedRules.selectors) {
        mergedRules.selectors = [...new Set(mergedRules.selectors)];
      }
      if (mergedRules.textMatches) {
        mergedRules.textMatches = [...new Set(mergedRules.textMatches)];
      }
      if (mergedRules.attributes) {
        mergedRules.attributes = mergedRules.attributes.filter((attr, index, self) => 
          index === self.findIndex(a => a.name === attr.name && a.value === attr.value)
        );
      }
      
      customRules[this.currentDomain] = mergedRules;
      await chrome.storage.sync.set({ customRules });
      
      chrome.runtime.sendMessage({ action: 'zapperRulesSaved', domain: this.currentDomain });
    } catch (error) {
      console.error('Failed to save zapper rules:', error);
    }
  }
}


// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle') {
    sendResponse({ success: true });
  } else if (request.action === 'getPageStats') {
    const stats = relistrInstance?.getPageStats() || { removedCount: 0, domain: window.location.hostname };
    sendResponse(stats);
  } else if (request.action === 'startZapper') {
    relistrInstance?.startZapperMode();
    sendResponse({ success: true });
  } else if (request.action === 'stopZapper') {
    relistrInstance?.stopZapperMode();
    sendResponse({ success: true });
  } else if (request.action === 'saveZapperRules') {
    relistrInstance?.saveZapperRules();
    sendResponse({ success: true });
  }
  return true;
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