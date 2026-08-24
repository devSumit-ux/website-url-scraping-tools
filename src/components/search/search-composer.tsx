'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, ChevronDown, X, Clock, ShieldCheck, Globe, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchRequest, SearchResponse } from '@/lib/types';

function validateStrictDomain(domain: string): boolean {
  if (!domain || domain.trim() === '') return true;
  const d = domain.trim().toLowerCase();
  if (!/^https?:\/\//.test(d)) return false;
  if (!/^https?:\/\/www\./.test(d)) return false;
  const hostPart = d.replace(/^https?:\/\/www\./, '').split(/[/?#]/)[0];
  if (!hostPart || hostPart.includes('..') || hostPart.includes('--')) return false;
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(hostPart)) return false;
  if (/\d/.test(hostPart)) return false;
  if (hostPart.length < 2 || hostPart.length > 60) return false;
  const parts = hostPart.split('.');
  if (parts.length > 2) return false;
  const tld = parts[1] || '';
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) return false;
  return true;
}

const RESULT_LIMITS = [
  { label: '10 URLs', value: 10 },
  { label: '20 URLs', value: 20 },
  { label: '30 URLs', value: 30 },
  { label: '50 URLs', value: 50 },
  { label: '100 URLs', value: 100 },
  { label: '250 URLs', value: 250 },
  { label: '500 URLs', value: 500 },
  { label: '1,000 URLs', value: 1000 },
  { label: '5,000 URLs', value: 5000 },
  { label: '10,000 URLs', value: 10000 },
  { label: '25,000 URLs', value: 25000 },
  { label: '50,000 URLs', value: 50000 },
  { label: '100,000 URLs (1 Lakh)', value: 100000 },
];

const TIME_FRAMES = [
  { label: '🕒 Any Time (All Dates)', value: 'all' },
  { label: '⚡ Past 24 Hours (1 Day - Newly Created/Indexed)', value: 'd' },
  { label: '📅 Past Week (7 Days)', value: 'w' },
  { label: '🗓️ Past Month (30 Days)', value: 'm' },
  { label: '📆 Past Year (365 Days)', value: 'y' },
];

const COUNTRIES = [
  { label: '🌐 Worldwide (All Countries)', value: '' },
  { label: '🇮🇳 India (Indian Companies & Startups)', value: 'in' },
  { label: '🇺🇸 United States (US Companies & Startups)', value: 'us' },
  { label: '🇬🇧 United Kingdom (UK Companies & Startups)', value: 'uk' },
  { label: '🇨🇦 Canada (Canadian Companies & Startups)', value: 'ca' },
  { label: '🇦🇺 Australia (Australian Companies & Startups)', value: 'au' },
  { label: '🇩🇪 Germany (German Companies & Startups)', value: 'de' },
  { label: '🇫🇷 France (French Companies & Startups)', value: 'fr' },
  { label: '🇯🇵 Japan (Japanese Companies & Startups)', value: 'jp' },
  { label: '🇸🇬 Singapore (Singapore Companies & Startups)', value: 'sg' },
  { label: '🇦🇪 UAE (UAE Companies & Startups)', value: 'ae' },
  { label: '🇸🇦 Saudi Arabia (Saudi Companies & Startups)', value: 'sa' },
  { label: '🇧🇷 Brazil (Brazilian Companies & Startups)', value: 'br' },
  { label: '🇨🇭 Switzerland (Swiss Companies & Startups)', value: 'ch' },
  { label: '🇳🇱 Netherlands (Dutch Companies & Startups)', value: 'nl' },
  { label: '🇸🇪 Sweden (Swedish Companies & Startups)', value: 'se' },
  { label: '🇮🇹 Italy (Italian Companies & Startups)', value: 'it' },
  { label: '🇪🇸 Spain (Spanish Companies & Startups)', value: 'es' },
  { label: '🇰🇷 South Korea (Korean Companies & Startups)', value: 'kr' },
  { label: '🇮🇱 Israel (Israeli Tech & Startups)', value: 'il' },
  { label: '🇮🇪 Ireland (Irish Companies & Startups)', value: 'ie' },
  { label: '🇳🇿 New Zealand (NZ Companies & Startups)', value: 'nz' },
  { label: '🇿🇦 South Africa (SA Companies & Startups)', value: 'za' },
  { label: '🇲🇾 Malaysia (Malaysian Companies & Startups)', value: 'my' },
  { label: '🇹🇭 Thailand (Thai Companies & Startups)', value: 'th' },
  { label: '🇮🇩 Indonesia (Indonesian Companies & Startups)', value: 'id' },
  { label: '🇻🇳 Vietnam (Vietnamese Companies & Startups)', value: 'vn' },
  { label: '🇵🇭 Philippines (Philippine Companies & Startups)', value: 'ph' },
  { label: '🇹🇷 Turkey (Turkish Companies & Startups)', value: 'tr' },
  { label: '🇲🇽 Mexico (Mexican Companies & Startups)', value: 'mx' },
  { label: '🇨🇱 Chile (Chilean Companies & Startups)', value: 'cl' },
  { label: '🇵🇱 Poland (Polish Companies & Startups)', value: 'pl' },
  { label: '🇳🇴 Norway (Norwegian Companies & Startups)', value: 'no' },
  { label: '🇩🇰 Denmark (Danish Companies & Startups)', value: 'dk' },
  { label: '🇫🇮 Finland (Finnish Companies & Startups)', value: 'fi' },
  { label: '🇦🇹 Austria (Austrian Companies & Startups)', value: 'at' },
  { label: '🇪🇬 Egypt (Egyptian Companies & Startups)', value: 'eg' },
  { label: '🇳🇬 Nigeria (Nigerian Companies & Startups)', value: 'ng' },
  { label: '🇰🇪 Kenya (Kenyan Companies & Startups)', value: 'ke' },
  { label: '🇶🇦 Qatar (Qatari Companies & Startups)', value: 'qa' },
  { label: '🇰🇼 Kuwait (Kuwaiti Companies & Startups)', value: 'kw' },
  { label: '🇴🇲 Oman (Omani Companies & Startups)', value: 'om' },
  { label: '🇧🇭 Bahrain (Bahraini Companies & Startups)', value: 'bh' },
];


const POPULAR_TLDS = [
  '.in', '.com', '.co.uk', '.de', '.ai', '.io', '.tech', '.store', '.health', '.fit', '.industries', '.equipment', '.glass', '.toys', '.clothing', '.works', '.solar', '.eco'
];

const CONTENT_TYPES = [
  'Websites', 'Pages', 'Articles', 'News', 'Research', 'Blogs', 'Documentation', 'Products', 'Companies', 'Directories'
];

const SEARCH_TYPES = [
  { label: 'Google Search + Multi-Engine', value: 'auto' },
  { label: 'Websites & Companies', value: 'websites' },
  { label: 'Research & Publications', value: 'research' },
  { label: 'News & Media', value: 'articles' },
  { label: 'Documentation & Tech', value: 'documentation' },
];

const DEFAULT_QUERIES = [
  'top websites',
  'best companies',
  'popular blogs',
  'news websites',
  'technology companies',
  'research institutions',
  'educational resources',
  'business directories',
];

interface SearchComposerProps {
  onSearch: (request: SearchRequest) => Promise<SearchResponse>;
  isSearching?: boolean;
  initialQuery?: string;
  initialRequest?: SearchRequest | null;
}

export function SearchComposer({ onSearch, isSearching, initialQuery = '', initialRequest = null }: SearchComposerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [limit, setLimit] = useState(30);
  const [country, setCountry] = useState('');
  const [area, setArea] = useState('');
  const [tld, setTld] = useState('');
  const [timeFrame, setTimeFrame] = useState('all');
  const [searchType, setSearchType] = useState('auto');
  const [includeDomains, setIncludeDomains] = useState('');
  const [excludeDomains, setExcludeDomains] = useState('');
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [domainLimit, setDomainLimit] = useState(999999);
  const [diversityEnabled, setDiversityEnabled] = useState(true);
  const [estimatedTime, setEstimatedTime] = useState('~5 seconds');
  const [speed] = useState(50);
  const [domainError, setDomainError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Restore saved session search parameters safely on client mount without auto-filling old search text
  useEffect(() => {
    if (initialRequest) {
      if (initialRequest.limit) setLimit(initialRequest.limit);
      if (initialRequest.region !== undefined) setCountry(initialRequest.region || '');
      if (initialRequest.area !== undefined) setArea(initialRequest.area || '');
      if (initialRequest.tld !== undefined) setTld(initialRequest.tld || '');
      if (initialRequest.timeFrame !== undefined) setTimeFrame(initialRequest.timeFrame || 'all');
      if (initialRequest.searchType !== undefined) setSearchType(initialRequest.searchType || 'auto');
      if (initialRequest.includeDomains) setIncludeDomains(initialRequest.includeDomains.join(', '));
      if (initialRequest.excludeDomains) setExcludeDomains(initialRequest.excludeDomains.join(', '));
      if (initialRequest.contentTypes) setSelectedContentTypes(initialRequest.contentTypes);
      if (initialRequest.language !== undefined) setLanguage(initialRequest.language || '');
      return;
    }

    try {
      const saved = sessionStorage.getItem('webscope-last-search');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.limit) setLimit(parsed.limit);
        if (parsed.region !== undefined) setCountry(parsed.region || '');
        if (parsed.area !== undefined) setArea(parsed.area || '');
        if (parsed.tld !== undefined) setTld(parsed.tld || '');
        if (parsed.timeFrame !== undefined) setTimeFrame(parsed.timeFrame || 'all');
        if (parsed.searchType !== undefined) setSearchType(parsed.searchType || 'auto');
        if (parsed.includeDomains?.length) setIncludeDomains(parsed.includeDomains.join(', '));
        if (parsed.excludeDomains?.length) setExcludeDomains(parsed.excludeDomains.join(', '));
        if (parsed.contentTypes?.length) setSelectedContentTypes(parsed.contentTypes);
        if (parsed.language) setLanguage(parsed.language);
      }
    } catch {}
  }, [initialRequest]);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (limit <= 100) {
      setEstimatedTime('~5-10 seconds');
    } else if (limit <= 500) {
      setEstimatedTime('~30-60 seconds');
    } else if (limit <= 1000) {
      setEstimatedTime('~1-2 minutes');
    } else if (limit <= 5000) {
      setEstimatedTime('~5-10 minutes');
    } else if (limit <= 10000) {
      setEstimatedTime('~12-20 minutes');
    } else if (limit <= 50000) {
      setEstimatedTime('~45-75 minutes');
    } else {
      setEstimatedTime('~1.5-2.5 hours');
    }
  }, [limit]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSearching) return;

    const trimmedQuery = query.trim();
    
    const allDomains = [...includeDomains.split(',').map((d: string) => d.trim()).filter(Boolean), ...excludeDomains.split(',').map((d: string) => d.trim()).filter(Boolean)];
    const invalidDomains = allDomains.filter((d: string) => !validateStrictDomain(d));
    if (invalidDomains.length > 0) {
      setDomainError(`Invalid domain format: ${invalidDomains[0]}. Use http://www.domain.com or https://www.domain.com only. No subdomains or numeric values allowed.`);
      return;
    }
    setDomainError('');

    const request: SearchRequest = {
      query: trimmedQuery,
      searchType: searchType as SearchRequest['searchType'],
      timeFrame: timeFrame as SearchRequest['timeFrame'],
      area: area.trim() || undefined,
      tld: tld.trim() || undefined,
      limit,
      includeDomains: includeDomains.split(',').map((d: string) => d.trim()).filter(Boolean),
      excludeDomains: excludeDomains.split(',').map((d: string) => d.trim()).filter(Boolean),
      contentTypes: selectedContentTypes,
      language: language || undefined,
      region: country || undefined,
      domainLimit,
      diversityEnabled,
    };

    try {
      sessionStorage.setItem('webscope-last-search', JSON.stringify(request));
    } catch {}

    await onSearch(request);
  }, [query, limit, country, area, tld, timeFrame, searchType, includeDomains, excludeDomains, selectedContentTypes, language, domainLimit, diversityEnabled, onSearch, isSearching]);

  return (
    <Card className="w-full max-w-3xl mx-auto p-1 shadow-sm border-border/70 bg-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold tracking-tight">Google & Web Search Scraper</h2>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Strict Apex Domains (e.g. example.com)</span>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-6">
            Search live Google index and scrape verified root websites without subdomain clutter.
          </p>

          <div className="space-y-3">
            <div className="relative pt-1">
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search keywords, topic, or leave blank for broad discovery..."
                className="h-12 text-base px-4 pr-10 rounded-lg border border-input shadow-inner focus-visible:ring-1"
                disabled={isSearching}
                id="search-query-input"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-4.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">📍 Area / City:</label>
                <Input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Mumbai, California, London, Tokyo, Berlin..."
                  className="h-9 text-xs rounded-md"
                  disabled={isSearching}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">🌐 Domain TLD:</label>
                <Input
                  type="text"
                  value={tld}
                  onChange={(e) => setTld(e.target.value)}
                  placeholder="e.g. .in, .org, .com, .ai, .io, .co.uk, .de..."
                  className="h-9 text-xs rounded-md"
                  disabled={isSearching}
                />
              </div>
            </div>

            {/* Quick-Select TLD Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-[11px]">Popular & Unique TLDs:</span>
              {POPULAR_TLDS.map((ext) => (
                <button
                  key={ext}
                  type="button"
                  onClick={() => setTld(tld === ext ? '' : ext)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                    tld === ext
                      ? 'bg-primary text-primary-foreground border-primary font-semibold'
                      : 'bg-muted/30 hover:bg-muted/70 text-muted-foreground hover:text-foreground border-border/60'
                  }`}
                  disabled={isSearching}
                >
                  {ext}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">Country:</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
                    disabled={isSearching}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">Time Frame:</label>
                  <select
                    value={timeFrame}
                    onChange={(e) => setTimeFrame(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[160px]"
                    disabled={isSearching}
                  >
                    {TIME_FRAMES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">Count:</label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="h-10 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px]"
                    disabled={isSearching}
                  >
                    {RESULT_LIMITS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground pl-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Est. {estimatedTime}</span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSearching}
                className="px-8 py-2.5 text-sm font-medium ml-auto"
              >
                {isSearching ? 'Scraping Google & Web...' : (query.trim() ? 'Start Search' : 'Discover Websites')}
                {!isSearching && <Search className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {showAdvanced && (
          <div className="space-y-4 px-6 pb-6 border-t border-border pt-4 bg-muted/20">
            {domainError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{domainError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Mode</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                  disabled={isSearching}
                >
                  {SEARCH_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                  disabled={isSearching}
                >
                  <option value="">Any language</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Include domains (comma-separated)</label>
                <Input
                  value={includeDomains}
                  onChange={(e) => setIncludeDomains(e.target.value)}
                  placeholder="arxiv.org, openai.com"
                  disabled={isSearching}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Exclude domains (comma-separated)</label>
                <Input
                  value={excludeDomains}
                  onChange={(e) => setExcludeDomains(e.target.value)}
                  placeholder="example.com"
                  disabled={isSearching}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Content types</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((type) => (
                  <Badge
                    key={type}
                    variant={selectedContentTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedContentTypes.includes(type)) {
                        setSelectedContentTypes(selectedContentTypes.filter(t => t !== type));
                      } else {
                        setSelectedContentTypes([...selectedContentTypes, type]);
                      }
                    }}
                  >
                    {type}
                    {selectedContentTypes.includes(type) && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Strict Root Domain Normalization</label>
                <p className="text-xs text-muted-foreground">Always strips subdomains like jhs.example.co to example.co</p>
              </div>
              <Badge variant="outline" className="bg-background text-xs font-mono">
                Root Only
              </Badge>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 pb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-muted-foreground hover:text-foreground"
            disabled={isSearching}
          >
            {showAdvanced ? 'Hide filters' : 'Advanced filters'}
            <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </form>
    </Card>
  );
}
