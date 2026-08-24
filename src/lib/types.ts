export interface SearchRequest {
  query: string;
  searchType: 'auto' | 'websites' | 'pages' | 'articles' | 'research' | 'documentation';
  timeFrame?: 'all' | 'd' | 'w' | 'm' | 'y';
  area?: string;
  tld?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  limit: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  contentTypes?: string[];
  language?: string;
  region?: string;
  domainLimit: number;
  diversityEnabled: boolean;
}

export interface SearchResponse {
  jobId: string;
  searchId: string;
  status: 'queued' | 'searching' | 'validating' | 'filtering' | 'ranking' | 'completed' | 'partial' | 'failed' | 'cancelled';
}

export interface JobStatus {
  id: string;
  status: string;
  requested: number;
  candidates: number;
  processed: number;
  accepted: number;
  blocked: number;
  duplicates: number;
  failed: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  domain: string;
  description?: string;
  publishedAt?: string;
  modifiedAt?: string;
  dateSource?: string;
  dateConfidence: string;
  contentType?: string;
  language?: string;
  safetyStatus: string;
  rank: number;
  relevanceScore?: number;
  freshnessScore?: number;
  qualityScore?: number;
  companyName?: string;
  founders?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SearchFilters {
  includeDomains: string[];
  excludeDomains: string[];
  contentTypes: string[];
  language?: string;
  region?: string;
  domainLimit: number;
  diversityEnabled: boolean;
}
