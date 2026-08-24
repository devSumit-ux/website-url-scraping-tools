import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { SearchRequest, SearchResult } from '@/lib/types';

const USER_AGENT = 'Mozilla/5.0 (compatible; WebScope/1.0; +https://webscope.dev)';
const TIMEOUT = 20000;
const MAX_CONCURRENT = 4;

const limit = pLimit(MAX_CONCURRENT);
const globalSeen = new Set<string>();

async function fetchWithTimeout(url: string, retries = 2): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
    });
    return res;
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithTimeout(url, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    u.pathname = '/';
    u.hostname = u.hostname.replace(/^www\./, '');
    return u.toString();
  } catch {
    return url;
  }
}

function isBlocked(url: string, request: SearchRequest): boolean {
  const excludeDomains = request.excludeDomains || [];
  const includeDomains = request.includeDomains || [];
  const domain = extractDomain(url);
  if (excludeDomains.length > 0 && excludeDomains.some(d => domain === d || domain.endsWith('.' + d))) return true;
  if (includeDomains.length > 0 && !includeDomains.some(d => domain === d || domain.endsWith('.' + d))) return true;
  const blockedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.zip', '.tar', '.gz', '.mp4', '.mp3'];
  if (blockedExts.some(ext => url.toLowerCase().endsWith(ext))) return true;
  if (domain === 'bing.com' || domain === 'duckduckgo.com' || domain === 'google.com') return true;
  if (url.includes('/ck/a?!') || url.includes('/url?') || url.includes('/search?') || url.includes('/webhp?')) return true;
  if (url.includes('uddg=')) return true;
  const socialDomains = [
    'twitter.com', 'x.com', 'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'snapchat.com',
    'pinterest.com', 'reddit.com', 'tumblr.com', 'linkedin.com', 'youtube.com', 'youtu.be', 'vimeo.com',
    'twitch.tv', 'discord.com', 'discord.gg', 'telegram.org', 't.me', 'whatsapp.com', 'threads.net',
    'mastodon.social', 'bsky.app', 'quora.com', 'medium.com', 'substack.com', 'blogspot.com',
    'wordpress.com', 'wix.com', 'squarespace.com', 'weebly.com', 'likee.com', 'clubhouse.com',
    'periscope.tv', 'mix.com', 'vk.com', 'weibo.com', 'qzone.com', 'renren.com',
    'odnoklassniki.ru', 'naver.com', 'line.me', 'kakao.com', 'viber.com', 'skype.com',
    'zoom.us', 'meet.google.com', 'teams.microsoft.com', 'slack.com', 'notion.so', 'airtable.com',
    'canva.com', 'figma.com', 'producthunt.com', 'kickstarter.com', 'patreon.com', 'onlyfans.com',
    'fiverr.com', 'upwork.com', 'freelancer.com', 'toptal.com', 'peopleperhour.com', '99designs.com',
    'dribbble.com', 'behance.net', 'artstation.com', 'deviantart.com', 'unsplash.com', 'pexels.com',
    'pixabay.com', 'shutterstock.com', 'gettyimages.com', 'istockphoto.com', 'adobe.com', 'picsart.com',
    'snapseed.com', 'lightroom.com', 'photoshop.com', 'illustrator.com', 'indesign.com',
    'premierepro.com', 'aftereffects.com', 'finalcutpro.com', 'davinciresolve.com', 'procreate.com',
    'clipstudio.net', 'medibang.com', 'krita.org', 'gimp.org', 'inkscape.org', 'blender.org',
    'maya.com', '3dsmax.com', 'cinema4d.com', 'houdini.com', 'zbrush.com', 'substance3d.com',
    'quixel.com', 'armorpaint.com',
  ];
  if (socialDomains.some(d => domain === d || domain.endsWith('.' + d))) return true;
  return false;
}

function computeRelevance($: ReturnType<typeof cheerio.load>, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const title = $('h1').first().text().toLowerCase();
  const text = $('body').text().toLowerCase();
  const metaDesc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 10;
    if (metaDesc.includes(term)) score += 5;
    const matches = text.split(term).length - 1;
    score += Math.min(matches, 10);
  }
  return Math.min(score, 100);
}

function extractDates($: ReturnType<typeof cheerio.load>): { publishedAt?: string; modifiedAt?: string } {
  const result: { publishedAt?: string; modifiedAt?: string } = {};
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="publishedDate"]',
    'meta[name="date"]',
    'time[datetime]',
    'time',
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    const dateStr = el.attr('content') || el.attr('datetime') || el.text();
    if (dateStr && !result.publishedAt) {
      const parsed = new Date(dateStr);
      if (!Number.isNaN(parsed.getTime())) {
        result.publishedAt = parsed.toISOString();
      }
    }
  }
  const modifiedSel = 'meta[property="article:modified_time"]';
  const modifiedEl = $(modifiedSel).first();
  const modifiedStr = modifiedEl.attr('content');
  if (modifiedStr) {
    const parsed = new Date(modifiedStr);
    if (!Number.isNaN(parsed.getTime())) {
      result.modifiedAt = parsed.toISOString();
    }
  }
  return result;
}

async function scrapeUrl(url: string, request: SearchRequest): Promise<{ result: SearchResult | null; links: string[] }> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { result: null, links: [] };
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return { result: null, links: [] };

    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim() || $('title').text().trim() || '';
    const description = $('meta[name="description"]').attr('content')?.trim() || '';
    const domain = extractDomain(url);
    const dates = extractDates($);
    const relevance = computeRelevance($, request.query);

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      try {
        const resolved = new URL(href, url).toString();
        if (resolved.startsWith('http')) links.push(resolved);
      } catch {}
    });

    if (request.searchType !== 'auto') {
      const typeMatch = typeMatches($, request.searchType);
      if (!typeMatch && relevance < 3) return { result: null, links };
    }

    return {
      result: {
        id: crypto.randomUUID(),
        title: title || domain,
        url: normalizeUrl(url),
        domain,
        description: description || undefined,
        publishedAt: dates.publishedAt,
        modifiedAt: dates.modifiedAt,
        dateConfidence: dates.publishedAt ? 'high' : 'low',
        contentType: detectContentType($, contentType),
        relevanceScore: relevance,
        rank: 0,
        safetyStatus: 'safe',
      },
      links,
    };
  } catch {
    return { result: null, links: [] };
  }
}

function typeMatches($: ReturnType<typeof cheerio.load>, type: string): boolean {
  const bodyText = $('body').text().toLowerCase();
  const indicators: Record<string, string[]> = {
    articles: ['article', 'blog', 'news', 'posted on'],
    research: ['research', 'paper', 'journal', 'abstract', 'doi'],
    documentation: ['documentation', 'docs', 'api reference', 'guide', 'tutorial'],
    blogs: ['blog', 'blogspot', 'wordpress', 'medium.com'],
    news: ['news', 'breaking', 'report', 'journalist'],
  };
  const words = indicators[type] || [];
  return words.some(w => bodyText.includes(w));
}

function detectContentType($: ReturnType<typeof cheerio.load>, headerType: string): string {
  if (typeMatches($, 'article')) return 'article';
  if (typeMatches($, 'documentation')) return 'documentation';
  if (typeMatches($, 'research')) return 'research';
  if (typeMatches($, 'blogs')) return 'blog';
  if (typeMatches($, 'news')) return 'news';
  if (headerType.includes('application/pdf')) return 'pdf';
  if (headerType.includes('image')) return 'image';
  return 'page';
}

async function discoverDuckDuckGo(query: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    if (!res.ok) return urls;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result__a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        try {
          urls.push(decodeURIComponent(match[1]));
        } catch {}
      }
    });
  } catch {}
  return urls.slice(0, limit);
}

async function discoverBing(query: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(`https://www.bing.com/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return urls;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.b_algo h2 a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('http')) urls.push(href);
    });
  } catch {}
  return urls.slice(0, limit);
}

async function discoverWikipedia(query: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`);
    if (!res.ok) return urls;
    const data = await res.json();
    const titles = data[1] || [];
    for (const title of titles) {
      const encoded = encodeURIComponent(title.replace(/ /g, '_'));
      urls.push(`https://en.wikipedia.org/wiki/${encoded}`);
    }
  } catch {}
  return urls.slice(0, limit);
}

async function discoverGitHub(query: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(`https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`);
    if (!res.ok) return urls;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('a[data-testid="results-list"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('/')) urls.push(`https://github.com${href}`);
    });
    if (urls.length === 0) {
      $('.search-title a').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.startsWith('/')) urls.push(`https://github.com${href}`);
      });
    }
  } catch {}
  return urls.slice(0, limit);
}

async function discoverHackerNews(query: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`);
    if (!res.ok) return urls;
    const data = await res.json();
    for (const hit of data.hits || []) {
      if (hit.url) urls.push(hit.url);
    }
  } catch {}
  return urls.slice(0, limit);
}

async function discoverReddit(query: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`);
    if (!res.ok) return urls;
    const data = await res.json();
    const posts = data.data?.children || [];
    for (const post of posts) {
      const url = post.data?.url;
      if (url && url.startsWith('http')) urls.push(url);
    }
  } catch {}
  return urls.slice(0, limit);
}

async function discoverSitemap(url: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const base = new URL(url).origin;
    const res = await fetchWithTimeout(`${base}/sitemap.xml`);
    if (!res.ok) return urls;
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    $('loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc && urls.length < limit) urls.push(loc);
    });
  } catch {}
  return urls;
}

async function discoverLinks(url: string, limit: number): Promise<string[]> {
  const urls: string[] = [];
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return urls;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      try {
        const resolved = new URL(href, url).toString();
        if (resolved.startsWith('http') && urls.length < limit) {
          urls.push(resolved);
        }
      } catch {}
    });
  } catch {}
  return urls;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function searchUrls(request: SearchRequest, onProgress?: (p: { candidates: number; processed: number; accepted: number; blocked: number; duplicates: number; failed: number }) => void): Promise<SearchResult[]> {
  const seen = globalSeen;
  const usedDomains = new Set<string>();
  const results: SearchResult[] = [];
  let candidates: string[] = [];

  try {
    if (request.query.includes('.') && request.query.includes(' ')) {
      const direct = request.query.split(' ').filter(t => t.includes('.') && !t.includes(' '));
      candidates.push(...direct);
    }

    const perSource = Math.ceil(request.limit * 2);
    candidates.push(...(await discoverDuckDuckGo(request.query, perSource)));
    candidates.push(...(await discoverBing(request.query, perSource)));
    candidates.push(...(await discoverWikipedia(request.query, perSource)));
    candidates.push(...(await discoverGitHub(request.query, perSource)));
    candidates.push(...(await discoverHackerNews(request.query, perSource)));
    candidates.push(...(await discoverReddit(request.query, perSource)));

    if (candidates.length === 0) {
      const seed = `https://${request.query.replace(/\s+/g, '').toLowerCase()}.com`;
      candidates.push(...(await discoverSitemap(seed, perSource)));
      if (candidates.length === 0) {
        candidates.push(...(await discoverLinks(seed, perSource)));
      }
    }

    if (candidates.length === 0) {
      const fallbackTerms = request.query.split(/\s+/).filter(Boolean);
      for (const term of fallbackTerms) {
        candidates.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(term)}`);
        candidates.push(`https://github.com/search?q=${encodeURIComponent(term)}&type=repositories`);
      }
    }
  } catch (error) {
    console.error('Discovery phase error:', error);
  }

  candidates = [...new Set(candidates)].filter(u => !isBlocked(u, request));
  candidates = candidates.filter(u => !usedDomains.has(extractDomain(u)));
  candidates = shuffleArray(candidates);

  let processed = 0;
  let accepted = 0;
  let blocked = 0;
  let duplicates = 0;
  let failed = 0;
  let discoveredLinks: string[] = [];

  while (results.length < request.limit && (candidates.length > 0 || discoveredLinks.length > 0)) {
    const url = candidates.shift() || discoveredLinks.shift();
    if (!url) break;

    const domain = extractDomain(url);
    if (usedDomains.has(domain)) {
      duplicates++;
      continue;
    }

    const normalized = normalizeUrl(url);
    if (seen.has(normalized)) {
      duplicates++;
      continue;
    }
    seen.add(normalized);

    processed++;
    onProgress?.({ candidates: candidates.length + discoveredLinks.length, processed, accepted, blocked, duplicates, failed });

    let resultData: { result: SearchResult | null; links: string[] };
    try {
      resultData = await limit(() => scrapeUrl(normalized, request));
    } catch {
      failed++;
      continue;
    }

    if (!resultData.result) {
      failed++;
      continue;
    }

    if (isBlocked(resultData.result.url, request)) {
      blocked++;
      continue;
    }

    accepted++;
    usedDomains.add(domain);
    results.push(resultData.result);

    onProgress?.({ candidates: candidates.length + discoveredLinks.length, processed, accepted, blocked, duplicates, failed });

    const newLinks = resultData.links
      .map(l => normalizeUrl(l))
      .filter(l => !seen.has(l) && !isBlocked(l, request))
      .filter(l => {
        const d = extractDomain(l);
        return !usedDomains.has(d);
      });

    discoveredLinks.push(...newLinks);
    discoveredLinks = [...new Set(discoveredLinks)];

    if (discoveredLinks.length > request.limit * 3) {
      discoveredLinks = shuffleArray(discoveredLinks).slice(0, request.limit * 3);
    }
  }

  results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  return results.slice(0, request.limit);
}
