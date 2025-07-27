export interface DomainConfig {
  selectors?: string[];
  textMatches?: string[];
  attributes?: Array<{
    name: string;
    value: string;
  }>;
}

export interface RelistrConfig {
  domains: Record<string, DomainConfig>;
  globalSelectors: string[];
}

export interface RelistrSettings {
  enabled: boolean;
  customRules: Record<string, DomainConfig>;
  stats: {
    totalRemoved: number;
    lastReset: number;
  };
}

export interface MessageRequest {
  action: 'getSettings' | 'updateSettings' | 'incrementStats' | 'getConfig' | 'toggle';
  settings?: Partial<RelistrSettings>;
  count?: number;
}