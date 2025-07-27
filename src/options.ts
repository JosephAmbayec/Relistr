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

interface CustomRule {
  domain: string;
  selectors?: string[];
  textMatches?: string[];
  attributes?: Array<{
    name: string;
    value: string;
  }>;
}

class RelistrOptions {
  private settings: RelistrSettings = {
    enabled: true,
    useGlobalSelectors: true,
    customRules: {},
    whitelist: [],
    stats: { totalRemoved: 0, lastReset: Date.now() }
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.loadTheme();
    await this.loadSettings();
    this.bindEvents();
    this.updateUI();
    this.setupStorageListener();
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

  private setupStorageListener(): void {
    // Listen for storage changes to keep UI in sync
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        this.loadSettings().then(() => {
          this.updateUI();
        });
      }
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.sync.get();
      // Merge with defaults to ensure all properties exist
      this.settings = {
        enabled: stored.enabled !== undefined ? stored.enabled : true,
        useGlobalSelectors: stored.useGlobalSelectors !== undefined ? stored.useGlobalSelectors : true,
        customRules: stored.customRules || {},
        whitelist: stored.whitelist || [],
        stats: stored.stats || { totalRemoved: 0, lastReset: Date.now() }
      };
    } catch (error) {
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      // Ensure we're saving the complete settings object
      const settingsToSave = {
        enabled: this.settings.enabled,
        useGlobalSelectors: this.settings.useGlobalSelectors,
        customRules: this.settings.customRules,
        whitelist: this.settings.whitelist,
        stats: this.settings.stats
      };
      
      await chrome.storage.sync.set(settingsToSave);
      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      this.showStatus('Failed to save settings', 'error');
    }
  }

  private updateUI(): void {
    const globalSelectorsToggle = document.getElementById('enableGlobalSelectors') as HTMLInputElement;
    if (globalSelectorsToggle) {
      globalSelectorsToggle.checked = this.settings.useGlobalSelectors !== false;
    }

    this.updateCustomRulesList();
    this.updateWhitelistUI();
  }

  private updateCustomRulesList(): void {
    const container = document.getElementById('customRulesList') as HTMLDivElement;
    if (!container) return;

    const rules = this.settings.customRules || {};
    const domains = Object.keys(rules);

    if (domains.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div>No custom rules loaded</div>
        </div>
      `;
      return;
    }

    container.innerHTML = domains.map(domain => `
      <div class="custom-rule-item">
        <div class="rule-info">
          <div class="rule-domain">${domain}</div>
          <div class="rule-summary">${this.getRuleSummary(rules[domain])}</div>
        </div>
        <button class="delete-btn" data-domain="${domain}">
          Delete
        </button>
      </div>
    `).join('');

    // Add event listeners to delete buttons
    const deleteButtons = container.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const domain = (e.target as HTMLButtonElement).getAttribute('data-domain');
        if (domain) {
          this.deleteCustomRule(domain);
        }
      });
    });
  }

  private getRuleSummary(rule: any): string {
    const parts: string[] = [];
    if (rule.selectors?.length) parts.push(`${rule.selectors.length} selectors`);
    if (rule.textMatches?.length) parts.push(`${rule.textMatches.length} text matches`);
    if (rule.attributes?.length) parts.push(`${rule.attributes.length} attributes`);
    return parts.join(', ') || 'No rules defined';
  }

  private updateWhitelistUI(): void {
    const container = document.getElementById('whitelistItems') as HTMLDivElement;
    if (!container) return;

    const whitelist = this.settings.whitelist || [];

    if (whitelist.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌐</div>
          <div>No whitelisted domains</div>
        </div>
      `;
      return;
    }

    container.innerHTML = whitelist.map(domain => `
      <div class="whitelist-item">
        <div class="whitelist-domain">${domain}</div>
        <button class="delete-btn" data-domain="${domain}">
          Remove
        </button>
      </div>
    `).join('');

    // Add event listeners to remove buttons
    const removeButtons = container.querySelectorAll('.delete-btn');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const domain = (e.target as HTMLButtonElement).getAttribute('data-domain');
        if (domain) {
          this.removeFromWhitelist(domain);
        }
      });
    });
  }

  private bindEvents(): void {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Global selectors toggle
    const globalSelectorsToggle = document.getElementById('enableGlobalSelectors') as HTMLInputElement;
    if (globalSelectorsToggle) {
      globalSelectorsToggle.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        this.settings.useGlobalSelectors = target.checked;
        await this.saveSettings();
      });
    }

    // File upload
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const uploadArea = document.getElementById('uploadArea') as HTMLDivElement;
    const chooseFileBtn = document.getElementById('chooseFileBtn') as HTMLButtonElement;

    if (fileInput) {
      fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }

    if (chooseFileBtn) {
      chooseFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput?.click();
      });
    }

    if (uploadArea) {
      uploadArea.addEventListener('click', (e) => {
        // Only trigger file input if clicking the area itself, not the button
        if (e.target === uploadArea || (e.target as HTMLElement).tagName === 'P') {
          fileInput?.click();
        }
      });
      
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          this.processFile(files[0]);
        }
      });
    }

    // Import button
    const importBtn = document.getElementById('importBtn') as HTMLButtonElement;
    if (importBtn) {
      importBtn.addEventListener('click', this.importRules.bind(this));
    }

    // Clear all button
    const clearAllBtn = document.getElementById('clearAllBtn') as HTMLButtonElement;
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', this.clearAllRules.bind(this));
    }

    // Save button (remove since settings auto-save now)
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.style.display = 'none'; // Hide manual save button since we auto-save
    }

    // Whitelist add domain
    const addDomainBtn = document.getElementById('addDomainBtn') as HTMLButtonElement;
    const domainInput = document.getElementById('domainInput') as HTMLInputElement;
    
    if (addDomainBtn && domainInput) {
      addDomainBtn.addEventListener('click', () => {
        this.addToWhitelist(domainInput.value.trim());
        domainInput.value = '';
      });

      domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addToWhitelist(domainInput.value.trim());
          domainInput.value = '';
        }
      });
    }
  }

  private handleFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private processFile(file: File): void {
    if (!file.name.endsWith('.json')) {
      this.showStatus('Please select a JSON file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        this.showJSONPreview(json, content);
      } catch (error) {
        this.showStatus('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  private showJSONPreview(json: any, content: string): void {
    const preview = document.getElementById('jsonPreview') as HTMLDivElement;
    const jsonContent = document.getElementById('jsonContent') as HTMLPreElement;
    
    if (preview && jsonContent) {
      jsonContent.textContent = JSON.stringify(json, null, 2);
      preview.classList.remove('json-preview-hidden');
      
      // Store for import
      (window as any).pendingImport = json;
    }
  }

  private async importRules(): Promise<void> {
    const pendingImport = (window as any).pendingImport;
    if (!pendingImport) {
      this.showStatus('No rules to import', 'error');
      return;
    }

    try {
      
      // Validate and merge rules
      if (pendingImport.domains && typeof pendingImport.domains === 'object') {
        Object.assign(this.settings.customRules, pendingImport.domains);
        
        await this.saveSettings();
        
        
        this.updateCustomRulesList();
        this.showStatus('Rules imported successfully!', 'success');
        
        // Hide preview
        const preview = document.getElementById('jsonPreview') as HTMLDivElement;
        if (preview) {
          preview.classList.add('json-preview-hidden');
        }
        
        delete (window as any).pendingImport;
      } else {
        this.showStatus('Invalid rule format. Expected "domains" object.', 'error');
      }
    } catch (error) {
      this.showStatus('Failed to import rules', 'error');
    }
  }

  public async deleteCustomRule(domain: string): Promise<void> {
    delete this.settings.customRules[domain];
    await this.saveSettings();
    this.updateCustomRulesList();
    this.showStatus(`Deleted rules for ${domain}`, 'success');
  }

  private async clearAllRules(): Promise<void> {
    if (confirm('Are you sure you want to clear all custom rules?')) {
      this.settings.customRules = {};
      await this.saveSettings();
      this.updateCustomRulesList();
      this.showStatus('All custom rules cleared', 'success');
    }
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    const statusDiv = document.getElementById('statusMessage') as HTMLDivElement;
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status-message status-${type}`;
      statusDiv.classList.remove('status-hidden');
      
      setTimeout(() => {
        statusDiv.classList.add('status-hidden');
      }, 3000);
    }
  }

  private normalizeDomain(domain: string): string {
    // Remove protocol and www prefix, convert to lowercase
    return domain.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase().split('/')[0];
  }

  private async addToWhitelist(domain: string): Promise<void> {
    if (!domain) {
      this.showStatus('Please enter a valid domain', 'error');
      return;
    }

    const normalizedDomain = this.normalizeDomain(domain);
    
    if (this.settings.whitelist.includes(normalizedDomain)) {
      this.showStatus('Domain already in whitelist', 'error');
      return;
    }

    this.settings.whitelist.push(normalizedDomain);
    await this.saveSettings();
    this.updateWhitelistUI();
    this.showStatus(`Added ${normalizedDomain} to whitelist`, 'success');
  }

  private async removeFromWhitelist(domain: string): Promise<void> {
    const index = this.settings.whitelist.indexOf(domain);
    if (index > -1) {
      this.settings.whitelist.splice(index, 1);
      await this.saveSettings();
      this.updateWhitelistUI();
      this.showStatus(`Removed ${domain} from whitelist`, 'success');
    }
  }
}

// Make instance globally available for HTML onclick handlers
let relistrOptions: RelistrOptions;

document.addEventListener('DOMContentLoaded', () => {
  relistrOptions = new RelistrOptions();
  (window as any).relistrOptions = relistrOptions;
});