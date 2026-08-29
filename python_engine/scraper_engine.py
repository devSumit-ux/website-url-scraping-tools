#!/usr/bin/env python3
"""
WebScope Advanced Python Scraping Engine
========================================
A high-throughput, clean, resilient asynchronous website scraper and validator.
Features:
- Multi-source parallel search discovery (DDG, Bing, Yahoo, Wikipedia, HackerNews, GitHub, Reddit, Brave)
- Strict apex root domain parsing & second-level TLD support
- Domain validation, anti-bot/parked/adult/scam filtering
- Live asynchronous HTTP validation and deep page inspection
- Dynamic query variations and real-time candidate queue for 100% target satisfaction
- Persistent history logging and session auditing
"""

import os
import sys
import json
import re
import ssl
import socket
import time
import random
import string
import hashlib
import asyncio
import aiohttp
import urllib.parse
import base64
from typing import List, Dict, Optional, Tuple, Callable, Any, Set
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from bs4 import BeautifulSoup

try:
    from mongo_storage import MongoCacheStorage
except ImportError:
    MongoCacheStorage = None

# ==============================================================================
# Configuration & Constants
# ==============================================================================

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
]

DEFAULT_QUERIES = [
    'top technology companies', 'innovative startups', 'business directories',
    'software platforms', 'developer tools', 'ecommerce websites',
    'research organizations', 'open source tools', 'design agencies',
    'cloud infrastructure services', 'data analytics platforms', 'ai startups',
]

RANDOM_SECTORS = [
    'commercial gym fitness equipment manufacturers',
    'laboratory scientific glassware manufacturers',
    'industrial automation robotics machinery',
    'cnc machining metal fabrication engineering',
    'precision tooling foundry casting components',
    'packaging machinery bottling equipment',
    'solar renewable energy clean technology',
    'semiconductor electronic components manufacturing',
    'chemical processing industrial raw materials',
    'construction building materials infrastructure',
    'automotive electric vehicle parts manufacturing',
    'agricultural machinery agritech farming',
    'food beverage processing packaging equipment',
    'aerospace defense engineering components',
    'water treatment environmental engineering',
    'logistics supply chain warehouse automation',
    'medical devices hospital equipment',
    'pharmaceutical manufacturers healthcare',
    'telemedicine digital health platforms',
    'textile manufacturing mills weaving',
    'garment apparel fashion manufacturing',
    'technical textiles industrial fabrics',
    'enterprise software cloud platforms',
    'cybersecurity data intelligence tools',
]

SECOND_LEVEL_TLDS: Set[str] = {
    'co.uk', 'org.uk', 'me.uk', 'net.uk', 'ltd.uk', 'plc.uk', 'ac.uk', 'gov.uk',
    'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in', 'nic.in', 'ac.in', 'edu.in', 'res.in', 'gov.in',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
    'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz',
    'co.za', 'org.za', 'net.za', 'ac.za', 'gov.za',
    'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
    'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp', 'ed.jp',
    'co.kr', 'ne.kr', 'or.kr', 're.kr', 'pe.kr', 'go.kr',
    'com.mx', 'org.mx', 'net.mx', 'edu.mx', 'gob.mx',
    'com.sg', 'net.sg', 'org.sg', 'edu.sg', 'gov.sg',
    'com.tr', 'net.tr', 'org.tr', 'edu.tr', 'gov.tr',
    'com.tw', 'org.tw', 'net.tw', 'edu.tw', 'gov.tw',
    'com.hk', 'org.hk', 'net.hk', 'edu.hk', 'gov.hk',
    'co.il', 'org.il', 'net.il', 'ac.il', 'gov.il',
    'co.id', 'net.id', 'or.id', 'ac.id', 'go.id',
    'com.my', 'net.my', 'org.my', 'edu.my', 'gov.my',
    'com.ph', 'net.ph', 'org.ph', 'edu.ph', 'gov.ph',
    'com.pk', 'net.pk', 'org.pk', 'edu.pk', 'gov.pk',
    'com.ng', 'org.ng', 'net.ng', 'edu.ng', 'gov.ng',
    'com.eg', 'org.eg', 'net.eg', 'edu.eg', 'gov.eg',
    'com.sa', 'net.sa', 'org.sa', 'edu.sa', 'gov.sa',
    'com.ar', 'net.ar', 'org.ar', 'gov.ar', 'edu.ar',
    'com.cl', 'co.cl', 'com.co', 'com.pe', 'com.ve', 'com.ec',
    'co.ke', 'or.ke', 'ac.ke', 'go.ke', 'co.ug', 'co.tz', 'co.zm', 'co.zw',
    'com.qa', 'net.qa', 'org.qa', 'gov.qa', 'com.kw', 'net.kw', 'com.om', 'com.bh',
    'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn',
    'com.es', 'com.it', 'com.nl', 'com.se', 'com.no', 'com.dk', 'com.fi', 'com.pl',
}

COUNTRY_KEYWORDS: Dict[str, str] = {
    'in': 'India', 'us': 'USA', 'uk': 'UK', 'ca': 'Canada', 'au': 'Australia',
    'de': 'Germany', 'fr': 'France', 'jp': 'Japan', 'sg': 'Singapore', 'ae': 'UAE',
    'sa': 'Saudi Arabia', 'br': 'Brazil', 'ch': 'Switzerland', 'nl': 'Netherlands',
    'se': 'Sweden', 'it': 'Italy', 'es': 'Spain', 'kr': 'South Korea', 'il': 'Israel',
    'ie': 'Ireland', 'nz': 'New Zealand', 'za': 'South Africa', 'my': 'Malaysia',
    'th': 'Thailand', 'id': 'Indonesia', 'vn': 'Vietnam', 'ph': 'Philippines',
    'tr': 'Turkey', 'mx': 'Mexico', 'cl': 'Chile', 'pl': 'Poland', 'no': 'Norway',
    'dk': 'Denmark', 'fi': 'Finland', 'at': 'Austria', 'eg': 'Egypt', 'ng': 'Nigeria',
    'ke': 'Kenya', 'qa': 'Qatar', 'kw': 'Kuwait', 'om': 'Oman', 'bh': 'Bahrain',
    'cn': 'China', 'tw': 'Taiwan', 'hk': 'Hong Kong', 'pk': 'Pakistan', 'bd': 'Bangladesh',
}

SUBDOMAIN_HOSTS: Set[str] = {
    'wordpress.com', 'blogspot.com', 'wixsite.com', 'squarespace.com', 'myshopify.com',
    'webflow.io', 'github.io', 'gitlab.io', 'netlify.app', 'vercel.app', 'herokuapp.com',
    'firebaseapp.com', 'pages.dev', 'surge.sh', 'carrd.co', 'weebly.com', 'jimdosite.com',
    'godaddysites.com', 'site123.me', 'mystrikingly.com', 'tumblr.com', 'medium.com',
    'substack.com', 'gitbook.io', 'notion.site', 'bitbucket.io'
}

SOCIAL_DOMAINS: Set[str] = {
    'twitter.com', 'x.com', 'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com',
    'snapchat.com', 'pinterest.com', 'reddit.com', 'tumblr.com', 'linkedin.com',
    'youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'discord.com', 'discord.gg',
    'telegram.org', 't.me', 'whatsapp.com', 'threads.net', 'mastodon.social',
    'bsky.app', 'vk.com', 'weibo.com'
}

RESTRICTED_DOMAINS: Set[str] = {
    'tiktok.com', 'tiktokv.com', 'musical.ly', 'kwai.com', 'likee.video',
    'ucweb.com', 'uc.cn', 'clubfactory.com', 'wechat.com', 'vigo.video',
    'heloshare.com', 'shareit.one', 'xender.com', 'camscanner.com',
    'bigo.tv', 'likee.com', 'romwe.com', 'shein.com'
}

FAMOUS_BRAND_STEMS: Set[str] = {
    # Tech Giants & Platforms
    'google', 'youtube', 'facebook', 'meta', 'instagram', 'whatsapp', 'twitter', 'x',
    'tiktok', 'netflix', 'spotify', 'amazon', 'apple', 'microsoft', 'yahoo', 'bing',
    'baidu', 'yandex', 'duckduckgo', 'adobe', 'salesforce', 'oracle', 'ibm', 'cisco',
    'intel', 'nvidia', 'amd', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'samsung', 'sony',
    'huawei', 'xiaomi', 'lg', 'panasonic', 'toshiba', 'hitachi', 'zoom', 'slack', 'dropbox',
    'box', 'canva', 'notion', 'figma', 'atlassian', 'jira', 'trello', 'asana', 'monday',
    'miro', 'airtable', 'gitlab', 'bitbucket', 'github', 'stackoverflow', 'stackexchange',
    'quora', 'reddit', 'medium', 'substack', 'claude', 'chatgpt', 'openai', 'anthropic',
    'gemini', 'perplexity', 'midjourney', 'huggingface', 'replicate', 'cohere', 'deepmind',
    'threads', 'mastodon', 'bluesky', 'snapchat', 'pinterest', 'tumblr', 'linkedin',

    # Cybersecurity & IT Mega-Conglomerates
    'kaspersky', 'norton', 'mcafee', 'symantec', 'bitdefender', 'avast', 'avg', 'sophos',
    'crowdstrike', 'paloaltonetworks', 'fortinet', 'trendmicro', 'checkpoint', 'zscaler',
    'cloudflare', 'fastly', 'akamai', 'splunk', 'datadog', 'dynatrace', 'okta', 'cyberark',
    'sentinelone', 'rapid7', 'qualys', 'darktrace', 'mandiant', 'fireeye', 'snyk',

    # Consultancies, IT Outsourcing & Mega-Corporations
    'accenture', 'deloitte', 'pwc', 'ey', 'kpmg', 'mckinsey', 'bcg', 'bain', 'infosys',
    'tcs', 'wipro', 'hcl', 'hcltech', 'cognizant', 'capgemini', 'techmahindra', 'lnt', 'lt',
    'tata', 'reliance', 'adani', 'mahindra', 'birla', 'godrej', 'larsen',

    # Media, News, Traffic Portals & Research Conglomerates
    'bbc', 'cnn', 'nytimes', 'washingtonpost', 'theguardian', 'forbes', 'bloomberg',
    'reuters', 'wsj', 'wallstreetjournal', 'cnbc', 'businessinsider', 'techcrunch',
    'theverge', 'wired', 'engadget', 'cnet', 'mashable', 'huffpost', 'independent',
    'dailymail', 'usatoday', 'latimes', 'economist', 'time', 'newsweek', 'vox',
    'aljazeera', 'ndtv', 'indiatimes', 'thehindu', 'hindustantimes', 'indianexpress',
    'moneycontrol', 'livemint', 'timesofindia', 'zeenews', 'indiatoday', 'pcmag',
    'techradar', 'tomsguide', 'tomshardware', 'digitaltrends', 'zdnet', 'arstechnica',
    'venturebeat', 'failory', 'crunchbase', 'pitchbook', 'semrush', 'ahrefs', 'similarweb',
    'moz', 'statista', 'gartner', 'forrester', 'ibef', 'worldbank', 'imf', 'weforum',
    'msspalert', 'nextgov', 'techmeme', 'slashdot', 'thestreet', 'marketwatch', 'fool',
    'investing', 'seekingalpha', 'benzinga', 'barrons', 'kiplinger', 'foxnews', 'nbcnews',
    'cbsnews', 'abcnews', 'usnews', 'politico', 'theatlantic', 'slate', 'salon', 'dailybeast',
    'buzzfeed', 'vice', 'complex', 'polygon', 'kotaku', 'ign', 'gamespot', 'eurogamer',
    'pcgamer', 'extremetech', 'bleepingcomputer', 'threatpost', 'darkreading', 'securityweek',
    'helpnetsecurity', 'infosecurity-magazine', 'csoonline', 'scmagazine', 'gigaom',
    'readwrite', 'theinformation', 'protocol', 'techrepublic', 'informationweek',

    # Reference, Wikis, Universities & EdTech
    'wikipedia', 'wikimedia', 'wikidata', 'wiktionary', 'wikihow', 'wikiwand',
    'britannica', 'investopedia', 'dictionary', 'thesaurus', 'merriam-webster',
    'cambridge', 'oxford', 'harvard', 'mit', 'stanford', 'berkeley', 'yale', 'princeton',
    'columbia', 'cornell', 'coursera', 'udemy', 'edx', 'khanacademy', 'skillshare',
    'udacity', 'codecademy', 'pluralsight', 'datacamp', 'duolingo', 'byjus', 'unacademy',
    'vedantu', 'testbook', 'sarkariresult', 'physicswallah', 'geeksforgeeks', 'w3schools',
    'tutorialspoint', 'javatpoint',

    # Retail, Commerce & Marketplaces
    'walmart', 'target', 'bestbuy', 'costco', 'homedepot', 'lowes', 'kroger', 'walgreens',
    'cvs', 'ebay', 'aliexpress', 'alibaba', 'taobao', 'tmall', 'jd', 'pinduoduo', 'temu',
    'shein', 'rakuten', 'mercadolibre', 'flipkart', 'myntra', 'meesho', 'indiamart',
    'tradeindia', 'etsy', 'craigslist', 'olx', 'snapdeal', 'nykaa', 'ajio', 'shopify',
    'bigcommerce', 'woocommerce', 'magento', 'carters', 'wayfair', 'ikea', 'zara', 'hm',
    'uniqlo', 'nike', 'adidas', 'puma', 'underarmour', 'lululemon',

    # Food, Delivery & Travel
    'zomato', 'swiggy', 'zepto', 'blinkit', 'instacart', 'doordash', 'ubereats', 'grubhub',
    'deliveroo', 'just-eat', 'uber', 'lyft', 'grab', 'didi', 'ola', 'rapido', 'airbnb',
    'booking', 'expedia', 'tripadvisor', 'kayak', 'agoda', 'trivago', 'hotels', 'marriott',
    'hilton', 'hyatt', 'accor', 'ihg', 'starbucks', 'mcdonalds', 'kfc', 'dominos', 'subway',
    'pizzahut', 'burgerking',

    # Telecom, Cloud & Web Infrastructure
    'jio', 'airtel', 'vodafone', 'vi', 'bsnl', 'verizon', 'att', 'tmobile', 'sprint',
    'comcast', 'charter', 'spectrum', 'docomo', 'softbank', 'orange', 'telefonica', 'bt',
    'virginmedia', 'aws', 'azure', 'digitalocean', 'linode', 'ovh', 'hetzner', 'godaddy',
    'namecheap', 'hostinger', 'bluehost', 'dreamhost', 'siteground', 'vultr',

    # Finance, Banking & Payments
    'jpmorgan', 'chase', 'goldmansachs', 'morganstanley', 'citigroup', 'citi', 'wellsfargo',
    'bankofamerica', 'hsbc', 'barclays', 'santander', 'ubs', 'standardchartered',
    'deutschebank', 'sbi', 'hdfc', 'hdfcbank', 'icici', 'icicibank', 'axisbank', 'kotak',
    'paytm', 'phonepe', 'razorpay', 'billdesk', 'cred', 'slice', 'stripe', 'paypal',
    'square', 'block', 'visa', 'mastercard', 'amex', 'americanexpress', 'discover',
    'westernunion', 'klarna', 'affirm', 'afterpay', 'revolut', 'wise', 'transferwise',
    'coinbase', 'binance', 'kraken', 'robinhood', 'fidelity', 'vanguard', 'schwab',
    'zerodha', 'groww', 'angelone', 'upstox',

    # Automotive & Heavy Industries
    'tesla', 'toyota', 'honda', 'ford', 'gm', 'chevrolet', 'bmw', 'mercedes', 'benz',
    'daimler', 'volkswagen', 'vw', 'audi', 'porsche', 'hyundai', 'kia', 'nissan',
    'renault', 'stellantis', 'fiat', 'chrysler', 'jeep', 'volvo', 'siemens', 'bosch',
    'philips', 'ge', 'schneider', 'abb', 'honeywell', '3m', 'caterpillar', 'komatsu',
    'lockheed', 'boeing', 'airbus', 'raytheon', 'northrop'
}

FAMOUS_COMMON_DOMAINS: Set[str] = {
    'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'linkedin.com', 'github.com', 'reddit.com', 'wikipedia.org',
    'amazon.com', 'apple.com', 'microsoft.com', 'netflix.com', 'spotify.com',
    'yahoo.com', 'bing.com', 'duckduckgo.com', 'baidu.com', 'yandex.com',
    'adobe.com', 'salesforce.com', 'oracle.com', 'ibm.com', 'cisco.com',
    'intel.com', 'nvidia.com', 'dell.com', 'hp.com', 'zoom.us', 'slack.com',
    'dropbox.com', 'canva.com', 'notion.so', 'figma.com', 'atlassian.com',
    'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
    'pypi.org', 'rfc-editor.org', 'acm.org', 'cdw.com', 'archive.org',
    'bbc.com', 'bbc.co.uk', 'cnn.com', 'nytimes.com', 'washingtonpost.com',
    'theguardian.com', 'forbes.com', 'bloomberg.com', 'reuters.com', 'wsj.com',
    'cnbc.com', 'businessinsider.com', 'techcrunch.com', 'theverge.com', 'wired.com',
    'engadget.com', 'cnet.com', 'mashable.com', 'huffpost.com', 'independent.co.uk',
    'dailymail.co.uk', 'usatoday.com', 'latimes.com', 'economist.com', 'time.com',
    'newsweek.com', 'vox.com', 'aljazeera.com', 'ndtv.com', 'indiatimes.com',
    'thehindu.com', 'hindustantimes.com', 'indianexpress.com', 'moneycontrol.com',
    'livemint.com', 'timesofindia.com', 'pcmag.com', 'techradar.com',
    'wikimedia.org', 'wiktionary.org', 'wikidata.org', 'wikihow.com', 'wikiwand.com',
    'britannica.com', 'investopedia.com', 'dictionary.com', 'thesaurus.com',
    'merriam-webster.com', 'quora.com', 'medium.com', 'substack.com',
    'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'skillshare.com',
    'geeksforgeeks.org', 'tutorialspoint.com', 'w3schools.com', 'javatpoint.com',
    'shiksha.com', 'collegedunia.com', 'testbook.com', 'sarkariresult.com',
    'indeed.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com', 'naukri.com',
    'ebay.com', 'aliexpress.com', 'walmart.com', 'target.com', 'bestbuy.com',
    'etsy.com', 'craigslist.org', 'olx.in', 'olx.com', 'flipkart.com', 'myntra.com',
    'tripadvisor.com', 'yelp.com', 'yellowpages.com', 'trustpilot.com', 'g2.com',
    'capterra.com', 'producthunt.com', 'imdb.com', 'rottentomatoes.com',
    'claude.ai', 'chatgpt.com', 'openai.com', 'anthropic.com', 'gemini.google.com',
    'perplexity.ai', 'midjourney.com', 'huggingface.co', 'speedtest.net', 'fast.com',
    'failory.com', 'worldbank.org', 'ibef.org', 'kaspersky.com', 'kaspersky.co.in',
    'ft.com', 'thenextweb.com', 'solarwinds.com', 'ccleaner.com'
}

PARKED_INDICATORS = [
    'domain is for sale', 'buy this domain', 'this domain is parked',
    'domain parking', 'sedo parking', 'purchase this domain',
    'hugedomains.com', 'dan.com', 'godaddy.com/park', 'parkingcrew.com',
    'bodis.com', 'afternic.com', 'namecheap parked', 'inquire about this domain',
    'this page is parked', 'is for sale at', 'make an offer on this domain',
    'domain name may be for sale', 'uniregistry.com', 'domain expired', 'account suspended'
]

ADULT_PATTERNS = [
    'porn', 'xxx', 'sex', 'nude', 'erotic', 'adult', 'xvideos', 'pornhub',
    'onlyfans', 'escort', 'dating', 'fetish', 'cams', 'cam4', 'chaturbate',
    'redtube', 'youporn', 'brazzers', 'xhamster', 'nsfw', 'hentai',
    'casino', 'betting', 'gambling'
]

HISTORY_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scraped_history.json')
SESSIONS_LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sessions_history.jsonl')


# ==============================================================================
# Data Models
# ==============================================================================

@dataclass
class ScrapedResult:
    url: str
    domain: str
    title: str
    description: str
    content_type: str = 'webpage'
    authority_score: float = 0.0
    relevance_score: float = 0.0
    status_code: int = 200
    is_alive: bool = True
    published_at: Optional[str] = None
    modified_at: Optional[str] = None
    word_count: int = 0
    links_found: int = 0
    company_name: Optional[str] = None
    founders: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


# ==============================================================================
# Domain Validator & Normalizer
# ==============================================================================

class DomainValidator:
    """Validates domains for authenticity, structure, and fraud detection."""

    @staticmethod
    def extract_root_domain(domain_or_url: str) -> str:
        """
        Extract strictly the registered apex root domain (e.g. 'example.com' or 'example.co.uk').
        Strips subdomains, ports, paths, protocols, and redundant www prefixes.
        """
        if not domain_or_url:
            return ""

        domain = str(domain_or_url).strip().lower()
        if '://' in domain:
            try:
                parsed = urllib.parse.urlparse(domain)
                domain = parsed.netloc or parsed.path
            except Exception:
                domain = domain.split('://', 1)[-1]

        domain = domain.split('/')[0].split('?')[0].split('#')[0].split(':')[0].strip()
        domain = re.sub(r'\.+', '.', domain).strip('.')

        while domain.startswith('www.'):
            domain = domain[4:]

        domain = re.sub(r'[^\w.-]', '', domain).strip('.')
        if not domain or '.' not in domain:
            return ""

        parts = [p for p in domain.split('.') if p]
        if len(parts) < 2:
            return ""

        # Reject multi-tenant subdomain host platforms
        for subhost in SUBDOMAIN_HOSTS:
            if domain == subhost or domain.endswith(f".{subhost}"):
                return ""

        # Check for duplicated domain repetition (e.g. example.com.example.com)
        if len(parts) >= 4 and parts[-2:] == parts[-4:-2]:
            parts = parts[:-2]

        # Multi-part second level TLDs (e.g. co.uk, co.in, com.au)
        suffix_2 = f"{parts[-2]}.{parts[-1]}"
        if suffix_2 in SECOND_LEVEL_TLDS or (len(parts) >= 3 and len(parts[-1]) == 2 and len(parts[-2]) <= 3):
            if len(parts) >= 3:
                return f"{parts[-3]}.{suffix_2}"
            return ""

        return f"{parts[-2]}.{parts[-1]}"

    @classmethod
    def normalize(cls, domain: str) -> str:
        return cls.extract_root_domain(domain)

    @staticmethod
    def extract_name_stem(domain: str) -> str:
        """Extract the core name / brand stem (e.g. 'example' from 'example.co.in')."""
        if not domain:
            return ""
        d = domain.split('/')[0].split('?')[0].strip().lower()
        parts = [p for p in d.split('.') if p]
        return parts[0] if parts else ""

    @staticmethod
    def is_suspicious(domain: str) -> Tuple[bool, str]:
        """Detect obviously malformed, numeric, robotic pattern, or adult domains."""
        if not domain:
            return True, "empty domain"
        
        name = domain.split('.')[0]
        if any(c.isdigit() for c in name):
            return True, "numeric values not allowed in domain stem"
        if len(name) < 2:
            return True, "domain stem too short"
        if len(name) > 60:
            return True, "excessive length"
        if '..' in domain or '--' in domain:
            return True, "malformed domain"

        # Sequential alphabet patterns (e.g. abcde, cdefg)
        alphabet = 'abcdefghijklmnopqrstuvwxyz'
        if len(name) >= 4:
            for i in range(len(alphabet) - 3):
                if alphabet[i:i+4] in name:
                    return True, "sequential alphabet pattern"

        # Disallow adult and gambling terms
        domain_lower = domain.lower()
        if any(p in domain_lower for p in ADULT_PATTERNS):
            return True, "adult/gambling keywords detected"

        return False, ""

    @staticmethod
    def get_tld(domain: str) -> str:
        parts = domain.split('.')
        return parts[-1] if parts else ''

    @classmethod
    def is_famous(cls, domain: str) -> bool:
        """Check if domain belongs to a famous corporation, tech monopoly, or mega conglomerate."""
        if not domain:
            return False
        d = domain.lower().strip()
        if d in FAMOUS_COMMON_DOMAINS:
            return True
        stem = cls.extract_name_stem(d)
        if stem in FAMOUS_BRAND_STEMS:
            return True
        for b in FAMOUS_BRAND_STEMS:
            if len(b) >= 4 and (stem == b or stem.startswith(f"{b}-") or stem.endswith(f"-{b}") or stem == f"{b}india" or stem == f"{b}global" or stem == f"{b}tech" or stem == f"{b}group"):
                return True
        return False

    @classmethod
    def is_authorized(cls, domain: str, country: Optional[str] = None, tld: Optional[str] = None) -> bool:
        """Verify whether domain is eligible for inclusion based on TLD, authority, quality rules, and famous company exclusion."""
        domain = cls.normalize(domain)
        if not domain:
            return False

        # Specific TLD filter match
        if tld:
            clean_tld = tld.strip().lower()
            if not clean_tld.startswith('.'):
                clean_tld = f".{clean_tld}"
            if not domain.endswith(clean_tld):
                return False

        dom_tld = cls.get_tld(domain)
        if not dom_tld or len(dom_tld) < 2 or not dom_tld.isalnum():
            return False

        # Exclude general educational and governmental directories unless explicitly requested
        if not tld and (domain.endswith('.edu') or domain.endswith('.gov') or domain.endswith('.ac.in') or domain.endswith('.gov.in')):
            return False

        # Strictly exclude famous companies, tech giants, conglomerates and social networks
        if cls.is_famous(domain) or domain in SOCIAL_DOMAINS or domain in RESTRICTED_DOMAINS:
            return False

        is_susp, _ = cls.is_suspicious(domain)
        if is_susp:
            return False

        return True

    @staticmethod
    def check_dns(domain: str, timeout: float = 2.0) -> bool:
        try:
            socket.setdefaulttimeout(timeout)
            socket.gethostbyname(domain)
            return True
        except Exception:
            return False

    @staticmethod
    async def check_dns_async(domain: str, timeout: float = 2.0) -> bool:
        loop = asyncio.get_event_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(None, socket.gethostbyname, domain),
                timeout=timeout
            )
            return True
        except Exception:
            return False


# ==============================================================================
# Site Quality Checker & Metadata Extractor
# ==============================================================================

class SiteChecker:
    """Performs HTTP accessibility verification, HTML metadata extraction, and authority scoring."""

    RE_TITLE = re.compile(r'<title[^>]*>(.*?)</title>', re.IGNORECASE | re.DOTALL)
    RE_DESCRIPTION = re.compile(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', re.IGNORECASE)
    RE_DATE_PATTERNS = [
        re.compile(r'<meta[^>]+property=["\'](?:article:published_time|og:published_time|og:updated_time)["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE),
        re.compile(r'<meta[^>]+name=["\'](?:pubdate|publishdate|date|dc\.date)["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE),
        re.compile(r'<time[^>]+datetime=["\']([^"\']+)["\']', re.IGNORECASE),
        re.compile(r'"datePublished"\s*:\s*"([^"]+)"', re.IGNORECASE),
        re.compile(r'"dateCreated"\s*:\s*"([^"]+)"', re.IGNORECASE),
    ]
    RE_DATE_EXTRACT = re.compile(r'\b(20\d{2}[-/]\d{2}[-/]\d{2})\b')
    RE_TAG_STRIP = re.compile(r'<[^>]+>')
    RE_LINKS = re.compile(r'href=["\'](https?://[^"\'\s>]+|/[^"\'\s>]+)["\']', re.IGNORECASE)
    RE_WHOIS_DATE = re.compile(r'(?:Creation Date|Created On|Registration Time|Created Date|created|Registration Date|Domain Create Date):\s*([0-9]{4}-[0-9]{2}-[0-9]{2})', re.IGNORECASE)

    RESTRICTED_PAGE_INDICATORS = [
        'blocked as per directions', 'department of telecommunications',
        'ministry of electronics and information technology',
        'order of the hon\'ble high court', 'access to this website has been blocked',
        'access denied as per dot', 'access denied by law', 'url is blocked in compliance with',
        'court order', 'prohibited by government order', 'this site can’t be reached',
        'site not available in your region', 'this website is not available in your country',
        'service not available in your country', '451 unavailable for legal reasons',
        'error 1020 access denied', 'error 1006 access denied', 'attention required! | cloudflare',
        'just a moment... enable javascript and cookies to continue', 'cf-chl-bypass'
    ]

    JUNK_SERVER_PHRASES = [
        'welcome to nginx!', 'apache2 ubuntu default page: it works!',
        'iis windows server', 'test page for the apache http server',
        'plesk default page', 'cpanel default page', 'directadmin web control panel',
        'litespeed web server', 'domain registered at namecheap',
        'future home of something quite cool', 'site created with godaddy',
        'website coming soon', 'account has been suspended', 'default website page',
        'this page is under construction', 'website is temporarily unavailable',
        'database connection error', 'error establishing a database connection',
        '502 bad gateway', '503 service unavailable', '504 gateway timeout',
        '403 forbidden', '404 not found'
    ]

    WHOIS_CACHE: Dict[str, Optional[str]] = {}

    @classmethod
    def extract_title(cls, html: str) -> str:
        m = cls.RE_TITLE.search(html)
        if m:
            clean = cls.RE_TAG_STRIP.sub(' ', m.group(1)).strip()
            return re.sub(r'\s+', ' ', clean)[:200]
        return ''

    @classmethod
    def extract_description(cls, html: str) -> str:
        m = cls.RE_DESCRIPTION.search(html)
        if m:
            return m.group(1).strip()[:300]
        return ''

    @classmethod
    def extract_date(cls, html: str) -> Optional[str]:
        if not html:
            return None
        for pat in cls.RE_DATE_PATTERNS:
            m = pat.search(html)
            if m:
                d_str = m.group(1).strip()
                date_match = cls.RE_DATE_EXTRACT.search(d_str)
                if date_match:
                    return date_match.group(1).replace('/', '-')
        return None

    @classmethod
    def count_words(cls, html: str) -> int:
        text = cls.RE_TAG_STRIP.sub(' ', html)
        return len(text.split())

    @classmethod
    def is_parked_domain(cls, html: str) -> bool:
        if not html:
            return False
        html_lower = html[:30000].lower()
        return any(ind in html_lower for ind in PARKED_INDICATORS)

    @classmethod
    def is_adult_content(cls, html: str) -> bool:
        if not html:
            return False
        html_sample = html[:25000].lower()
        adult_signals = [
            '18+ only', 'adult content', 'are you 18', 'explicit content',
            'pornography', 'xxx videos', 'online casino', 'sports betting'
        ]
        return any(signal in html_sample for signal in adult_signals)

    @classmethod
    def is_restricted_page(cls, html: str) -> bool:
        if not html:
            return False
        html_lower = html[:25000].lower()
        if any(ind in html_lower for ind in cls.RESTRICTED_PAGE_INDICATORS):
            return True
        if any(ind in html_lower for ind in cls.JUNK_SERVER_PHRASES):
            return True
        return False

    @classmethod
    def is_thin_content(cls, html: str) -> bool:
        if not html or len(html.strip()) < 100:
            return True
        clean_text = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
        clean_text = re.sub(r'<style[^>]*>.*?</style>', ' ', clean_text, flags=re.DOTALL | re.IGNORECASE)
        text_content = re.sub(r'<[^>]+>', ' ', clean_text)
        text_content = re.sub(r'\s+', ' ', text_content).strip().lower()

        if len(text_content) < 45:
            return True

        if len(text_content) < 350:
            thin_phrases = ['coming soon', 'under construction', 'page is blank', 'site not configured', 'it works!', 'domain parked']
            if any(phrase in text_content for phrase in thin_phrases):
                return True

        return False

    HIGH_TRAFFIC_AD_SIGNALS = [
        'securepubads.g.doubleclick.net', 'googletagservices.com/tag/js/gpt.js',
        'c.amazon-adsystem.com', 'adthrive.com', 'mediavine.com',
        'taboola.com', 'outbrain.com', 'rubiconproject.com', 'casalemedia.com',
        'openx.net', 'pubmatic.com', 'criteo.net', 'yieldmo.com', 'teads.tv',
        'prebid.js', 'advertising.com', 'adsafeprotected.com', 'quantserve.com'
    ]

    HIGH_TRAFFIC_CONGLOMERATE_SIGNALS = [
        'dotdash meredith', 'hearst magazine', 'condé nast', 'future plc',
        'ziff davis', 'red ventures', 'penske media', 'gannett', 'reach plc',
        'a division of', 'licensed from reuters', 'associated press all rights',
        'over 10 million monthly', 'over 20 million', 'millions of monthly readers',
        'highest-traffic', 'top 1,000 websites'
    ]

    @classmethod
    def is_high_traffic_or_mega_portal(cls, html: str, links_count: int) -> bool:
        """
        Detects if a website is an ultra-high-traffic publisher, news aggregator,
        or massive ad-monetized content portal.
        """
        if not html:
            return False

        html_sample = html[:35000].lower()

        # 1. Check for heavy programmatic ad server swarms (typical of top 50k high-traffic media sites)
        ad_signal_matches = sum(1 for ad in cls.HIGH_TRAFFIC_AD_SIGNALS if ad in html_sample)
        if ad_signal_matches >= 2:
            return True

        # 2. Check for conglomerate publishing house signatures
        if any(sig in html_sample for sig in cls.HIGH_TRAFFIC_CONGLOMERATE_SIGNALS):
            return True

        # 3. Aggressive link farms / massive aggregator indices (>140 outlinks on homepage)
        if links_count > 140:
            return True

        return False

    @classmethod
    def is_famous_presence(cls, title: str, description: str, domain: str) -> bool:
        """Strictly detect if page title or description indicates a famous company or mega conglomerate presence."""
        if not title:
            return False
        t_clean = title.lower()
        t_norm = re.sub(r'[^a-z0-9]', '', t_clean)

        for b in FAMOUS_BRAND_STEMS:
            if len(b) < 4:
                continue
            pattern = rf"\b{re.escape(b)}\b"
            if re.search(pattern, t_clean):
                return True
            # Match compound / multi-word patterns (e.g. "World Bank" matching "worldbank", "Wall Street Journal" matching "wallstreetjournal")
            if len(b) >= 6 and b in t_norm:
                return True
        return False

    @classmethod
    def extract_links(cls, html: str, base_url: str) -> List[str]:
        links = []
        for match in cls.RE_LINKS.finditer(html):
            href = match.group(1)
            try:
                absolute = href if href.startswith('http') else urllib.parse.urljoin(base_url, href)
                parsed = urllib.parse.urlparse(absolute)
                if parsed.scheme not in ['http', 'https'] or not parsed.netloc:
                    continue
                domain = parsed.netloc.lower().replace('www.', '')
                if '.' not in domain or len(domain.split('.')) > 3:
                    continue
                links.append(f"{parsed.scheme}://{parsed.netloc}/")
            except Exception:
                pass
        return links

    @staticmethod
    def calculate_authority_score(
        domain: str,
        status_code: int,
        response_time: float,
        word_count: int,
        has_sitemap: bool = False
    ) -> float:
        score = 0.0
        if status_code == 200:
            score += 20
        elif status_code in [301, 302, 307, 308]:
            score += 12

        if response_time > 0:
            if response_time < 0.6:
                score += 20
            elif response_time < 1.2:
                score += 15
            elif response_time < 2.5:
                score += 10
            else:
                score += 5

        if word_count > 2000:
            score += 30
        elif word_count > 1000:
            score += 24
        elif word_count > 500:
            score += 18
        elif word_count > 150:
            score += 12
        else:
            score += 5

        tld = domain.split('.')[-1] if '.' in domain else ''
        trusted_tlds = {'com', 'org', 'net', 'io', 'co', 'ai', 'dev', 'in', 'uk', 'de'}
        if tld in trusted_tlds:
            score += 15
        else:
            score += 8

        name = domain.split('.')[0]
        if 3 <= len(name) <= 15:
            score += 15
        else:
            score += 8

        return min(round(score, 1), 100.0)

    @classmethod
    async def get_whois_creation_date(cls, domain: str, timeout: float = 0.8) -> Optional[str]:
        if domain in cls.WHOIS_CACHE:
            return cls.WHOIS_CACHE[domain]
        try:
            parts = domain.lower().split('.')
            tld = parts[-1]
            servers = {
                'com': 'whois.verisign-grs.com', 'net': 'whois.verisign-grs.com',
                'org': 'whois.publicinterestregistry.org', 'in': 'whois.registry.in',
                'io': 'whois.nic.io', 'ai': 'whois.nic.ai', 'co': 'whois.nic.co',
                'uk': 'whois.nic.uk', 'ca': 'whois.cira.ca', 'de': 'whois.denic.de',
            }
            server = servers.get(tld, f'whois.nic.{tld}')
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(server, 43),
                timeout=timeout
            )
            query_str = f'domain {domain}\r\n' if tld in ['com', 'net'] else f'{domain}\r\n'
            writer.write(query_str.encode())
            await writer.drain()
            data = await asyncio.wait_for(reader.read(4096), timeout=timeout)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            txt = data.decode('utf-8', errors='ignore')
            m = cls.RE_WHOIS_DATE.search(txt)
            if m:
                res = m.group(1)
                cls.WHOIS_CACHE[domain] = res
                return res
        except Exception:
            pass
        cls.WHOIS_CACHE[domain] = None
        return None


# ==============================================================================
# Persistent History & Session Logger
# ==============================================================================

class HistoryLogger:
    """Manages persistent history in MongoDB Atlas cloud cache and local scraped_history.json."""

    _cached_history: Optional[Dict[str, Set[str]]] = None
    _last_history_load_time: float = 0.0

    @classmethod
    def load_history(cls, force_reload: bool = False) -> Dict[str, Set[str]]:
        now = time.time()
        if not force_reload and cls._cached_history is not None and (now - cls._last_history_load_time < 30.0):
            return cls._cached_history

        domains = set()
        filtered = set()
        stems = set()
        urls = set()

        # 1. Load from local file if exists
        if os.path.exists(HISTORY_FILE_PATH):
            try:
                with open(HISTORY_FILE_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    domains = set(data.get('domains', []))
                    filtered = set(data.get('filtered_domains', []))
                    stems = set(data.get('stems', []))
                    urls = set(data.get('urls', []))
            except Exception:
                pass

        # 2. Merge with MongoDB Atlas cloud cache if available
        if MongoCacheStorage:
            try:
                storage = MongoCacheStorage.get_instance()
                if storage.is_connected():
                    mongo_domains = storage.load_approved_domains()
                    mongo_urls = storage.load_approved_urls()
                    if mongo_domains:
                        domains |= mongo_domains
                    if mongo_urls:
                        urls |= mongo_urls
            except Exception:
                pass

        res = {
            'domains': domains,
            'filtered_domains': filtered,
            'all_known_domains': domains | filtered,
            'stems': stems,
            'urls': urls,
        }
        cls._cached_history = res
        cls._last_history_load_time = now
        return res

    @staticmethod
    def save_accepted_domain(url: str, domain: str, query: str = ""):
        history = HistoryLogger.load_history()
        if url:
            history['urls'].add(url)
        if domain:
            history['domains'].add(domain)
            stem = domain.split('.')[0]
            if stem:
                history['stems'].add(stem)

        # Save to local
        try:
            with open(HISTORY_FILE_PATH, 'w', encoding='utf-8') as f:
                json.dump({
                    'domains': sorted(list(history['domains'])),
                    'filtered_domains': sorted(list(history['filtered_domains'])),
                    'stems': sorted(list(history['stems'])),
                    'urls': sorted(list(history['urls'])),
                    'total_unique': len(history['domains']),
                    'total_filtered': len(history['filtered_domains']),
                    'last_updated': datetime.now(timezone.utc).isoformat()
                }, f, indent=2)
        except Exception:
            pass

        # Save to MongoDB Atlas
        if MongoCacheStorage:
            try:
                storage = MongoCacheStorage.get_instance()
                if storage.is_connected() and domain:
                    storage.save_approved_results([{
                        'url': url or f"https://www.{domain}",
                        'domain': domain,
                        'title': domain.capitalize()
                    }], query=query)
            except Exception:
                pass

    @staticmethod
    def save_new_results(results: List[Dict], filtered_domains: Optional[Set[str]] = None, query: Optional[str] = None, elapsed: Optional[float] = None):
        if not results and not filtered_domains:
            return
        history = HistoryLogger.load_history()
        for r in results:
            url = r.get('url') if isinstance(r, dict) else getattr(r, 'url', None)
            domain = r.get('domain') if isinstance(r, dict) else getattr(r, 'domain', None)
            if url:
                history['urls'].add(url)
            if domain:
                history['domains'].add(domain)
                stem = domain.split('.')[0]
                if stem:
                    history['stems'].add(stem)

        if filtered_domains:
            for fd in filtered_domains:
                if fd and fd not in history['domains']:
                    history['filtered_domains'].add(fd)

        try:
            with open(HISTORY_FILE_PATH, 'w', encoding='utf-8') as f:
                json.dump({
                    'domains': sorted(list(history['domains'])),
                    'filtered_domains': sorted(list(history['filtered_domains'])),
                    'stems': sorted(list(history['stems'])),
                    'urls': sorted(list(history['urls'])),
                    'total_unique': len(history['domains']),
                    'total_filtered': len(history['filtered_domains']),
                    'last_updated': datetime.now(timezone.utc).isoformat()
                }, f, indent=2)
        except Exception:
            pass

        # Persist to MongoDB Atlas cloud database
        if MongoCacheStorage:
            try:
                storage = MongoCacheStorage.get_instance()
                if storage.is_connected():
                    if results:
                        storage.save_approved_results(results, query=query or "")
                    if filtered_domains:
                        storage.save_filtered_domains(filtered_domains, query=query or "")
                    if query and results:
                        storage.log_search_session(query, results, elapsed or 0.0)
            except Exception:
                pass

        if results and query:
            try:
                session_entry = {
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'query': query,
                    'limit': len(results),
                    'accepted_count': len(results),
                    'elapsed_seconds': round(elapsed, 2) if elapsed else None,
                    'total_history_domains': len(history['domains']),
                    'sample_urls': [r.get('url') for r in results[:10] if isinstance(r, dict)]
                }
                with open(SESSIONS_LOG_FILE, 'a', encoding='utf-8') as sf:
                    sf.write(json.dumps(session_entry) + '\n')
            except Exception:
                pass

    @staticmethod
    def get_recent_sessions(limit: int = 50) -> List[Dict]:
        if not os.path.exists(SESSIONS_LOG_FILE):
            return []
        sessions = []
        try:
            with open(SESSIONS_LOG_FILE, 'r', encoding='utf-8') as sf:
                for line in sf:
                    line = line.strip()
                    if line:
                        sessions.append(json.loads(line))
        except Exception:
            pass
        return sessions[-limit:]

    @staticmethod
    def clear_history():
        try:
            if os.path.exists(HISTORY_FILE_PATH):
                os.remove(HISTORY_FILE_PATH)
            if os.path.exists(SESSIONS_LOG_FILE):
                os.remove(SESSIONS_LOG_FILE)
        except Exception:
            pass
        GlobalDomainRegistry.clear()

    @staticmethod
    def get_stats() -> Dict:
        stats = {
            'total_unique_approved': 0,
            'total_unique': 0,
            'total_filtered_domains': 0,
            'total_known_domains': 0,
            'total_urls': 0,
            'history_file': HISTORY_FILE_PATH,
            'sessions_file': SESSIONS_LOG_FILE,
            'cloud_connected': False,
            'mongodb_cluster': 'cluster0.usvfwut.mongodb.net'
        }
        if MongoCacheStorage:
            try:
                storage = MongoCacheStorage.get_instance()
                if storage.is_connected():
                    m_stats = storage.get_stats()
                    stats['cloud_connected'] = m_stats.get('cloud_connected', False)
                    stats['mongodb_approved'] = m_stats.get('total_unique_approved', 0)
                    stats['mongodb_filtered'] = m_stats.get('total_filtered_domains', 0)
                    stats['mongodb_sessions'] = m_stats.get('total_sessions', 0)
                    stats['total_unique'] = stats['mongodb_approved']
                    stats['total_unique_approved'] = stats['mongodb_approved']
                    stats['total_filtered_domains'] = stats['mongodb_filtered']
                    stats['total_known_domains'] = stats['mongodb_approved'] + stats['mongodb_filtered']
                    stats['total_urls'] = stats['mongodb_approved']
                    return stats
            except Exception:
                pass

        history = HistoryLogger.load_history()
        stats['total_unique_approved'] = len(history['domains'])
        stats['total_unique'] = len(history['domains'])
        stats['total_filtered_domains'] = len(history['filtered_domains'])
        stats['total_known_domains'] = len(history['all_known_domains'])
        stats['total_urls'] = len(history['urls'])
        return stats


class GlobalDomainRegistry:
    """
    Centralized, thread-safe, multi-user real-time domain registry.
    Ensures that when multiple users, browser sessions, or devices search simultaneously online,
    no two users/browsers ever receive the same discovered domain or URL.
    """
    _lock = asyncio.Lock()
    _in_flight_domains: Set[str] = set()
    _delivered_domains: Set[str] = set()
    _delivered_urls: Set[str] = set()
    _initialized = False

    @classmethod
    def initialize(cls):
        if not cls._initialized:
            history = HistoryLogger.load_history()
            cls._delivered_domains = set(history.get('domains', []))
            cls._delivered_urls = set(history.get('urls', []))
            cls._initialized = True

    @classmethod
    async def is_already_discovered(cls, domain: str) -> bool:
        cls.initialize()
        if not domain:
            return True
        d = domain.lower().strip()
        async with cls._lock:
            return (d in cls._delivered_domains or d in cls._in_flight_domains)

    @classmethod
    async def try_claim_domain(cls, domain: str) -> bool:
        """
        Atomically reserve a domain across all concurrent user searches.
        Returns True if claimed successfully, False if already discovered/claimed by another user.
        """
        cls.initialize()
        if not domain:
            return False
        d = domain.lower().strip()
        async with cls._lock:
            if d in cls._delivered_domains or d in cls._in_flight_domains:
                return False
            cls._in_flight_domains.add(d)
            return True

    @classmethod
    async def mark_delivered(cls, url: str, domain: str, query: str = ""):
        """Mark domain and URL as permanently delivered across all users and save to persistent history."""
        cls.initialize()
        if not domain:
            return
        d = domain.lower().strip()
        async with cls._lock:
            cls._in_flight_domains.discard(d)
            cls._delivered_domains.add(d)
            if url:
                cls._delivered_urls.add(url.strip())
        HistoryLogger.save_accepted_domain(url, d, query)

    @classmethod
    async def release_domain(cls, domain: str, is_filtered: bool = False):
        """Release domain if invalid/dead or not accepted so other searches can evaluate it."""
        cls.initialize()
        if not domain:
            return
        d = domain.lower().strip()
        async with cls._lock:
            cls._in_flight_domains.discard(d)

    @classmethod
    def clear(cls):
        cls._in_flight_domains.clear()
        cls._delivered_domains.clear()
        cls._delivered_urls.clear()
        cls._initialized = False


# ==============================================================================
# Search Providers
# ==============================================================================

class SearchProviders:
    """Asynchronous search providers for multi-source URL candidate discovery."""

    @staticmethod
    async def search_duckduckgo(session: aiohttp.ClientSession, query: str, limit: int = 35, on_url: Optional[Callable] = None) -> List[str]:
        urls = []
        try:
            headers = {
                'User-Agent': random.choice(USER_AGENTS),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
            async with session.post(
                'https://lite.duckduckgo.com/lite/',
                data={'q': query},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=2.5)
            ) as response:
                if response.status == 200:
                    html = await response.text()
                    for match in re.finditer(r'href=[\"\']([^\"\']+)[\"\']', html):
                        href = match.group(1)
                        if 'uddg=' in href:
                            m_u = re.search(r'uddg=([^&\"\'>\s]+)', href)
                            if m_u:
                                href = urllib.parse.unquote(m_u.group(1))
                        if href.startswith('http') and 'duckduckgo.' not in href:
                            urls.append(href)
                            if on_url:
                                asyncio.create_task(on_url(href))
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_bing(session: aiohttp.ClientSession, query: str, limit: int = 35, time_frame: Optional[str] = None, on_url: Optional[Callable] = None) -> List[str]:
        urls = []
        try:
            time_filter = ""
            if time_frame == 'd':
                time_filter = "&qft=+filterui:age-1d"
            elif time_frame == 'w':
                time_filter = "&qft=+filterui:age-7d"
            elif time_frame == 'm':
                time_filter = "&qft=+filterui:age-30d"
            elif time_frame == 'y':
                time_filter = "&qft=+filterui:age-365d"

            headers = {
                'User-Agent': random.choice(USER_AGENTS),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }

            async def fetch_page(first: int):
                p_urls = []
                try:
                    async with session.get(
                        f'https://www.bing.com/search?q={urllib.parse.quote(query)}{time_filter}&setlang=en-US&first={first}',
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=2.5)
                    ) as response:
                        if response.status == 200:
                            html = await response.text()
                            for match in re.finditer(r'<h2[^>]*>\s*<a[^>]+href="([^"]+)"', html):
                                link = match.group(1)
                                if 'bing.com/ck/a' in link:
                                    ck_m = re.search(r'(?:\?|&amp;|&)u=([a-zA-Z0-9_\-]+)', link)
                                    if ck_m:
                                        enc = ck_m.group(1)
                                        if enc.startswith('a1'):
                                            raw_b64 = enc[2:]
                                            pad = len(raw_b64) % 4
                                            padded = raw_b64 + ('=' * ((4 - pad) % 4))
                                            try:
                                                link = base64.urlsafe_b64decode(padded).decode('utf-8', errors='ignore')
                                            except Exception:
                                                continue
                                if link.startswith('http') and 'bing.com' not in link and 'microsoft.com' not in link:
                                    p_urls.append(link)
                                    if on_url:
                                        try:
                                            res = on_url(link)
                                            if asyncio.iscoroutine(res):
                                                asyncio.create_task(res)
                                        except Exception:
                                            pass
                except Exception:
                    pass
                return p_urls

            pages = await asyncio.gather(*[fetch_page(first) for first in [1, 11, 21]], return_exceptions=True)
            for p in pages:
                if isinstance(p, list):
                    urls.extend(p)
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_yahoo(session: aiohttp.ClientSession, query: str, limit: int = 30, time_frame: Optional[str] = None, on_url: Optional[Callable] = None) -> List[str]:
        urls = []
        try:
            age_filter = f"&age=1{time_frame}" if time_frame in ['d', 'w', 'm', 'y'] else ""
            headers = {
                'User-Agent': random.choice(USER_AGENTS),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
            async with session.get(
                f'https://search.yahoo.com/search?p={urllib.parse.quote(query)}&n={min(limit, 40)}{age_filter}',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=2.2)
            ) as response:
                if response.status == 200:
                    html = await response.text()
                    for match in re.finditer(r'/RU=([^/]+)/', html):
                        try:
                            decoded = urllib.parse.unquote(match.group(1))
                            if decoded.startswith('http') and not any(x in decoded for x in ['yahoo.', 'yimg.', 'advertising.com']):
                                urls.append(decoded)
                                if on_url:
                                    try:
                                        res = on_url(decoded)
                                        if asyncio.iscoroutine(res):
                                            asyncio.create_task(res)
                                    except Exception:
                                        pass
                        except Exception:
                            pass
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_wikipedia(session: aiohttp.ClientSession, query: str, limit: int = 40, on_url: Optional[Callable] = None) -> List[str]:
        urls = []
        try:
            wiki_headers = {'User-Agent': 'WebScopeBot/2.0 (info@webscope.dev)'}
            async with session.get(
                f'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query[:40])}&utf8=&format=json&srlimit=5',
                headers=wiki_headers,
                timeout=aiohttp.ClientTimeout(total=2.5)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    page_ids = [str(item['pageid']) for item in data.get('query', {}).get('search', []) if 'pageid' in item]
                    if page_ids:
                        pids = '|'.join(page_ids[:5])
                        async with session.get(
                            f'https://en.wikipedia.org/w/api.php?action=query&pageids={pids}&prop=extlinks&ellimit=50&format=json',
                            headers=wiki_headers,
                            timeout=aiohttp.ClientTimeout(total=2.5)
                        ) as ext_resp:
                            if ext_resp.status == 200:
                                ext_data = await ext_resp.json()
                                for pid, pdata in ext_data.get('query', {}).get('pages', {}).items():
                                    for el in pdata.get('extlinks', []):
                                        raw_url = el.get('*')
                                        if raw_url:
                                            if raw_url.startswith('//'):
                                                raw_url = 'https:' + raw_url
                                            if raw_url.startswith('http') and not any(x in raw_url for x in ['wikipedia.org', 'wikimedia.org', 'wikidata.org', 'archive.org', 'doi.org', 'w3.org']):
                                                urls.append(raw_url)
                                                if on_url:
                                                    try:
                                                        res = on_url(raw_url)
                                                        if asyncio.iscoroutine(res):
                                                            asyncio.create_task(res)
                                                    except Exception:
                                                        pass
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_hackernews(session: aiohttp.ClientSession, query: str, limit: int = 35, time_frame: Optional[str] = None, on_url: Optional[Callable] = None) -> List[str]:
        urls = []
        try:
            numeric_filters = ""
            if time_frame == 'd':
                cutoff = int(time.time()) - 86400
                numeric_filters = f"&numericFilters=created_at_i>{cutoff}"
            elif time_frame == 'w':
                cutoff = int(time.time()) - 604800
                numeric_filters = f"&numericFilters=created_at_i>{cutoff}"
            elif time_frame == 'm':
                cutoff = int(time.time()) - 2592000
                numeric_filters = f"&numericFilters=created_at_i>{cutoff}"
            elif time_frame == 'y':
                cutoff = int(time.time()) - 31536000
                numeric_filters = f"&numericFilters=created_at_i>{cutoff}"

            endpoint = "search_by_date" if time_frame else "search"
            url = f'https://hn.algolia.com/api/v1/{endpoint}?query={urllib.parse.quote(query[:40])}&tags=story&hitsPerPage={min(limit, 50)}{numeric_filters}'
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=2.2)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    for hit in data.get('hits', []):
                        raw = hit.get('url')
                        if raw and raw.startswith('http') and not any(x in raw for x in ['ycombinator.com', 'github.com', 'twitter.com', 'x.com']):
                            urls.append(raw)
                            if on_url:
                                asyncio.create_task(on_url(raw))
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_github(session: aiohttp.ClientSession, query: str, limit: int = 20) -> List[str]:
        urls = []
        try:
            gh_headers = {
                'User-Agent': random.choice(USER_AGENTS),
                'Accept': 'application/vnd.github.v3+json'
            }
            async with session.get(
                f'https://api.github.com/search/repositories?q={urllib.parse.quote(query[:35])}&per_page=25',
                headers=gh_headers,
                timeout=aiohttp.ClientTimeout(total=2.0)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    for item in data.get('items', []):
                        hp = item.get('homepage')
                        if hp and hp.startswith('http') and 'github.com' not in hp:
                            urls.append(hp)
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_reddit(session: aiohttp.ClientSession, query: str, limit: int = 20) -> List[str]:
        urls = []
        try:
            async with session.get(
                f'https://www.reddit.com/search.json?q={urllib.parse.quote(query[:35])}&limit=30&sort=relevance',
                headers={'User-Agent': random.choice(USER_AGENTS)},
                timeout=aiohttp.ClientTimeout(total=3.0)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    for post in data.get('data', {}).get('children', []):
                        post_url = post.get('data', {}).get('url')
                        if post_url and post_url.startswith('http') and not any(x in post_url for x in ['reddit.com', 'redd.it']):
                            urls.append(post_url)
        except Exception:
            pass
        return urls[:limit]

    @staticmethod
    async def search_brave(session: aiohttp.ClientSession, query: str, limit: int = 20) -> List[str]:
        urls = []
        try:
            headers = {
                'User-Agent': random.choice(USER_AGENTS),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
            async with session.get(
                f'https://search.brave.com/search?q={urllib.parse.quote(query[:35])}',
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=2.0)
            ) as response:
                if response.status == 200:
                    html = await response.text()
                    for match in re.finditer(r'href="(https?://[^"\'<>\s]+)"', html):
                        link = match.group(1)
                        if link.startswith('http') and 'brave.com' not in link:
                            urls.append(link)
        except Exception:
            pass
        return urls[:limit]


# ==============================================================================
# Main Scraping Engine
# ==============================================================================

class ScrapingEngine:
    """High-speed asynchronous multi-source web scraper and validator."""

    def __init__(self, max_concurrent: int = 1000, exclude_history: bool = True):
        self.max_concurrent = max(max_concurrent, 500)
        self.session: Optional[aiohttp.ClientSession] = None
        self.validator = DomainValidator()
        self.checker = SiteChecker()

        GlobalDomainRegistry.initialize()
        history = HistoryLogger.load_history()
        self.history_domains = set(history.get('domains', []))
        self.history_urls = set(history.get('urls', []))

        self.filtered_domains: Set[str] = set()
        self.used_domains: Set[str] = set()
        self.seen_urls: Set[str] = set()
        self.session_stems: Set[str] = set()
        self.dynamic_candidates: Set[str] = set()

        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        self.start_time = 0.0
        self.total_discovered = 0
        self.total_processed = 0
        self.pending_results_buffer: List[Dict] = []
        self.pending_filtered_buffer: Set[str] = set()

    async def __aenter__(self):
        if not self.session or self.session.closed:
            connector = aiohttp.TCPConnector(
                family=socket.AF_INET,
                limit=max(self.max_concurrent, 2000),
                limit_per_host=150,
                ttl_dns_cache=3600,
                use_dns_cache=True,
                enable_cleanup_closed=True,
                keepalive_timeout=60,
                ssl=False
            )
            self.session = aiohttp.ClientSession(
                connector=connector,
                headers={
                    'User-Agent': random.choice(USER_AGENTS),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout=aiohttp.ClientTimeout(total=8),
                raise_for_status=False
            )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session and not self.session.closed:
            await self.session.close()
            # Wait brief moment to allow underlying connections to close
            await asyncio.sleep(0.01)

    async def discover_urls(
        self,
        query: str,
        limit: int = 100,
        country: Optional[str] = None,
        page: int = 0,
        time_frame: Optional[str] = None,
        area: Optional[str] = None,
        tld: Optional[str] = None
    ) -> List[str]:
        """Discover URLs across multiple search engines concurrently."""
        effective_query = query.strip() if query and query.strip() else random.choice(RANDOM_SECTORS)
        search_query = effective_query

        if area and area.strip():
            a_clean = area.strip()
            if a_clean.lower() not in search_query.lower():
                search_query = f"{search_query} {a_clean}"

        if tld and tld.strip():
            clean_tld = tld.strip().lstrip('.').lower()
            search_query = f"{search_query} site:{clean_tld}"

        if country and country.lower() == 'in':
            if 'india' not in search_query.lower() and not area:
                search_query = f"{search_query} India"
        elif country and country.lower() in COUNTRY_KEYWORDS:
            c_name = COUNTRY_KEYWORDS[country.lower()]
            if c_name.lower() not in search_query.lower() and not area:
                search_query = f"{search_query} {c_name}"

        tasks = [
            SearchProviders.search_bing(self.session, search_query, max(20, limit // 3), time_frame=time_frame),
            SearchProviders.search_duckduckgo(self.session, search_query, max(20, limit // 3)),
            SearchProviders.search_yahoo(self.session, search_query, max(15, limit // 4), time_frame=time_frame),
            SearchProviders.search_wikipedia(self.session, effective_query, max(20, limit // 3)),
            SearchProviders.search_hackernews(self.session, effective_query, max(15, limit // 4), time_frame=time_frame),
            SearchProviders.search_github(self.session, effective_query, max(10, limit // 5)),
            SearchProviders.search_reddit(self.session, effective_query, max(10, limit // 5)),
            SearchProviders.search_brave(self.session, search_query, max(15, limit // 4)),
        ]

        async def _safe(coro):
            try:
                return await asyncio.wait_for(coro, timeout=3.5)
            except Exception:
                return []

        results = await asyncio.gather(*[_safe(t) for t in tasks], return_exceptions=True)
        raw_urls = []
        for r in results:
            if isinstance(r, list):
                raw_urls.extend(r)

        seen = set()
        clean_urls = []
        for u in raw_urls:
            root = self.validator.extract_root_domain(u)
            if not root or root in seen or root in self.used_domains or root in self.history_domains:
                continue
            if not self.validator.is_authorized(root, country=country, tld=tld):
                self.history_domains.add(root)
                self.filtered_domains.add(root)
                continue
            seen.add(root)
            clean_urls.append(f"https://www.{root}")

        random.shuffle(clean_urls)
        return clean_urls[:limit * 3]

    def _calculate_relevance(self, title: str, description: str, html: str, query: str, area: Optional[str] = None) -> float:
        if not query or not query.strip():
            return 50.0

        raw_words = [w for w in re.split(r'\s+', query.strip().lower()) if len(w) > 2]
        stopwords = {
            'innovative', 'best', 'top', 'new', 'latest', 'leading', 'great', 'modern', 'free',
            'online', 'good', 'find', 'get', 'website', 'websites', 'software', 'platform',
            'tools', 'solutions', 'companies', 'services', 'technology', 'technologies'
        }
        meaningful = [w for w in raw_words if w not in stopwords] or raw_words

        doc_text = f"{title} {description}".lower()
        html_sample = html.lower()[:25000]

        matched_meta = sum(1 for w in meaningful if w in doc_text)
        matched_body = sum(1 for w in meaningful if w in html_sample)

        if matched_meta == 0 and matched_body == 0:
            return 0.0

        score = (matched_meta * 35.0) + (matched_body * 15.0)
        if area and area.strip().lower() in f"{doc_text} {html_sample}":
            score += 20.0

        return min(max(score, 10.0), 100.0)

    async def _validate_and_scrape(
        self,
        url: str,
        query: str,
        country: Optional[str] = None,
        time_frame: Optional[str] = None,
        area: Optional[str] = None,
        tld: Optional[str] = None,
        on_candidate_found: Optional[Callable] = None,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None
    ) -> Optional[ScrapedResult]:
        """Validate live accessibility and extract rich metadata from a domain URL."""
        async with self.semaphore:
            domain = self.validator.extract_root_domain(url)
            if not domain or domain in self.used_domains or domain in self.history_domains:
                return None

            # Atomically claim domain in the global registry across all concurrent user searches/browsers
            if not await GlobalDomainRegistry.try_claim_domain(domain):
                return None

            delivered = False
            try:
                self.used_domains.add(domain)

                def _reject(d_to_reject: Optional[str] = domain):
                    if d_to_reject:
                        self.used_domains.add(d_to_reject)
                        self.filtered_domains.add(d_to_reject)
                    return None

                if not self.validator.is_authorized(domain, country=country, tld=tld):
                    return _reject()

                if exclude_domains:
                    exc_norm = {self.validator.normalize(d) for d in exclude_domains if d}
                    if domain in exc_norm:
                        return _reject()

                if include_domains:
                    inc_norm = {self.validator.normalize(d) for d in include_domains if d}
                    if domain not in inc_norm:
                        return _reject()

                primary_url = f"https://www.{domain}/"
                clean_root_url = f"https://{domain}"

                if domain in self.seen_urls or primary_url in self.seen_urls:
                    return None

                # Robotic pattern check across session stems
                stem = self.validator.extract_name_stem(domain)
                if stem:
                    if not any(v in stem for v in 'aeiouy') and len(stem) <= 4:
                        for prev_stem in self.session_stems:
                            if len(stem) == len(prev_stem) and stem[:-1] == prev_stem[:-1]:
                                return _reject()
                    self.session_stems.add(stem)

                self.seen_urls.add(domain)
                self.seen_urls.add(primary_url)
                self.seen_urls.add(clean_root_url)

                start = time.time()
                req_headers = {
                    'User-Agent': random.choice(USER_AGENTS),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                }

                candidates_to_try = [f"https://www.{domain}/", f"https://{domain}/", f"http://{domain}/"]
                valid_result_data = None

                for target_url in candidates_to_try:
                    try:
                        async with self.session.get(
                            target_url,
                            headers=req_headers,
                            timeout=aiohttp.ClientTimeout(total=4.5, connect=2.0, sock_connect=2.0, sock_read=2.5),
                            ssl=False,
                            allow_redirects=True
                        ) as resp:
                            if resp.status not in [404, 410, 500, 502, 503, 504]:
                                if resp.url and resp.url.host:
                                    resp_root = self.validator.extract_root_domain(resp.url.host)
                                    if resp_root and resp_root != domain:
                                        return _reject(domain)

                                raw = await resp.read()
                                html = raw.decode('utf-8', errors='ignore')[:35000]
                                c_type = resp.headers.get('Content-Type', '')
                                status_code = resp.status
                                valid_result_data = (status_code, c_type, html)
                                break
                    except Exception:
                        continue

                if not valid_result_data:
                    return _reject()

                status_code, content_type, html = valid_result_data
                response_time = time.time() - start

                if not html or len(html.strip()) < 80:
                    return _reject()

                if self.checker.is_parked_domain(html) or self.checker.is_restricted_page(html) or self.checker.is_adult_content(html) or self.checker.is_thin_content(html):
                    return _reject()

                # Must strictly respond with HTTP 200
                if status_code != 200:
                    return _reject(domain)

                raw_title = self.checker.extract_title(html)
                title = raw_title.strip() if raw_title else domain.capitalize()
                description = self.checker.extract_description(html)

                # Strictly reject if title indicates a blocked, captive portal, or server error state
                junk_title_stems = [
                    'blocked', 'access denied', '403 forbidden', '404 not found',
                    '502 bad gateway', '503 service unavailable', 'just a moment',
                    'attention required', 'suspended', 'default page', 'under construction',
                    'coming soon', 'parked domain', 'site not found', 'site can’t be reached'
                ]
                t_lower = title.lower()
                if any(jt in t_lower for jt in junk_title_stems):
                    return _reject(domain)

                word_count = self.checker.count_words(html)
                links = self.checker.extract_links(html, primary_url)

                if not raw_title and word_count < 30:
                    return _reject(domain)
                if word_count < 25:
                    return _reject(domain)

                authority = self.checker.calculate_authority_score(
                    domain, status_code, response_time, word_count
                )

                relevance = self._calculate_relevance(title, description, html, query, area=area)
                if query and query.strip() and relevance < 10.0:
                    return _reject()

                pub_date = self.checker.extract_date(html)

                # Time frame filtering if requested
                if time_frame and time_frame in ['d', 'w', 'm', 'y']:
                    whois_date = await self.checker.get_whois_creation_date(domain)
                    if whois_date:
                        try:
                            w_dt = datetime.strptime(whois_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                            whois_age_days = (datetime.now(timezone.utc) - w_dt).total_seconds() / 86400.0
                            max_days = {'d': 365.0, 'w': 365.0, 'm': 365.0, 'y': 370.0}.get(time_frame, 370.0)
                            if whois_age_days > max_days:
                                return _reject()
                        except Exception:
                            pass

                self.used_domains.add(domain)
                self.history_domains.add(domain)
                self.history_urls.add(clean_root_url)

                final_output_url = f"https://www.{domain}"

                result = ScrapedResult(
                    url=final_output_url,
                    domain=domain,
                    title=title,
                    description=description,
                    content_type=content_type or 'webpage',
                    authority_score=authority,
                    relevance_score=relevance,
                    status_code=status_code,
                    is_alive=True,
                    published_at=pub_date,
                    modified_at=None,
                    word_count=word_count,
                    links_found=len(links),
                )

                await GlobalDomainRegistry.mark_delivered(final_output_url, domain, query)
                delivered = True

                # Extract outlinks for recursive dynamic discovery
                for lk in links[:20]:
                    ext_d = self.validator.extract_root_domain(lk)
                    if ext_d and ext_d not in self.used_domains and ext_d not in self.history_domains and self.validator.is_authorized(ext_d, country=country, tld=tld):
                        norm_link = f"https://www.{ext_d}"
                        if norm_link not in self.seen_urls and norm_link not in self.history_urls:
                            self.dynamic_candidates.add(norm_link)
                            if on_candidate_found:
                                try:
                                    res = on_candidate_found(norm_link)
                                    if asyncio.iscoroutine(res):
                                        asyncio.create_task(res)
                                except Exception:
                                    pass

                return result
            except Exception:
                return _reject()
            finally:
                if not delivered:
                    await GlobalDomainRegistry.release_domain(domain)

    async def search(
        self,
        query: str,
        limit: int = 10,
        on_progress: Optional[Callable[[Dict], None]] = None,
        country: Optional[str] = None,
        time_frame: Optional[str] = None,
        area: Optional[str] = None,
        tld: Optional[str] = None,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None
    ) -> List[Dict]:
        """Main search orchestrator: concurrently discovers and validates until target limit is met."""
        all_results: List[Dict] = []
        try:
            async with self:
                self.start_time = time.time()
                self.total_discovered = 0
                self.total_processed = 0
                self.pending_results_buffer = []
                self.pending_filtered_buffer = set()

                if on_progress:
                    on_progress({
                        'status': 'searching',
                        'discovered': 0,
                        'processed': 0,
                        'accepted': 0,
                        'remaining': None,
                        'progress': 2
                    })

                area_str = f" {area.strip()}" if area else ""
                clean_tld = tld.strip().lstrip('.').lower() if tld else None
                tld_str = f" site:{clean_tld}" if clean_tld else ""

                DIVERSE_TLDS = ['io', 'ai', 'tech', 'co', 'net', 'dev', 'app', 'global', 'solutions', 'cloud', 'co.uk', 'de', 'ca', 'fr', 'eu']
                BUSINESS_SUFFIXES = ['companies', 'manufacturers', 'solutions', 'providers', 'startups', 'directory', 'hub', 'network', 'platform', 'systems']
                active_tlds = [clean_tld] if clean_tld else random.sample(DIVERSE_TLDS, min(len(DIVERSE_TLDS), 10))

                meaningful = []
                if query and query.strip():
                    raw_words = [w for w in re.split(r'\s+', query.strip()) if len(w) > 2]
                    stopwords = {'innovative', 'best', 'top', 'new', 'latest', 'leading', 'great', 'modern', 'free', 'online', 'good', 'find', 'get', 'website', 'websites'}
                    meaningful = [w for w in raw_words if w.lower() not in stopwords] or raw_words

                if not query or not query.strip():
                    sampled_sectors = random.sample(RANDOM_SECTORS, min(len(RANDOM_SECTORS), 25))
                    queries = [f"{sec}{area_str}{tld_str}".strip() for sec in sampled_sectors]
                    effective_query = random.choice(sampled_sectors)
                else:
                    effective_query = query.strip()
                    VARIATIONS = []
                    for sampled_tld in active_tlds:
                        for w in meaningful[:3]:
                            VARIATIONS.append(f"{w} companies{area_str} site:{sampled_tld}".strip())
                    for w in meaningful[:3]:
                        for suf in random.sample(BUSINESS_SUFFIXES, min(len(BUSINESS_SUFFIXES), 3)):
                            VARIATIONS.append(f"{w} {suf}{area_str}{tld_str}".strip())
                    VARIATIONS.append(f"{query}{area_str} companies".strip())
                    VARIATIONS.append(f"{query}{area_str} solutions".strip())
                    VARIATIONS.append(f"{query}{area_str}{tld_str}".strip())

                    seen_q = set()
                    queries = []
                    for v in VARIATIONS:
                        if v and v not in seen_q:
                            seen_q.add(v)
                            queries.append(v)
                    random.shuffle(queries)

                candidate_queue: asyncio.Queue[str] = asyncio.Queue(maxsize=50000)
                seen_candidate_domains: Set[str] = set()
                stop_event = asyncio.Event()

                async def push_candidate(u: str):
                    if not u or stop_event.is_set():
                        return
                    if candidate_queue.qsize() > 500:
                        return
                    d = self.validator.extract_root_domain(u)
                    if not d or d in seen_candidate_domains or d in self.history_domains or d in self.used_domains:
                        return
                    if d in GlobalDomainRegistry._delivered_domains:
                        return
                    if not self.validator.is_authorized(d, country=country, tld=tld):
                        self.used_domains.add(d)
                        self.filtered_domains.add(d)
                        self.pending_filtered_buffer.add(d)
                        return
                    seen_candidate_domains.add(d)
                    clean_url = f"https://www.{d}"
                    await candidate_queue.put(clean_url)
                    self.total_discovered += 1

                async def stream_provider(coro):
                    try:
                        urls = await coro
                        if isinstance(urls, list):
                            for u in urls:
                                if stop_event.is_set():
                                    break
                                await push_candidate(u)
                    except Exception:
                        pass

                # Outlink Ingestor for recursive discovery
                async def outlink_ingestor():
                    while not stop_event.is_set():
                        if self.dynamic_candidates and candidate_queue.qsize() < max(limit, 20):
                            batch = list(self.dynamic_candidates)[:10]
                            for u in batch:
                                self.dynamic_candidates.discard(u)
                                await push_candidate(u)
                        await asyncio.sleep(0.1)

                # Continuous Discovery Producer
                async def discovery_producer():
                    try:
                        initial_tasks = [
                            asyncio.create_task(stream_provider(SearchProviders.search_bing(self.session, effective_query, 35, time_frame=time_frame, on_url=push_candidate))),
                            asyncio.create_task(stream_provider(SearchProviders.search_wikipedia(self.session, effective_query, 40, on_url=push_candidate))),
                            asyncio.create_task(stream_provider(SearchProviders.search_hackernews(self.session, effective_query, 35, on_url=push_candidate))),
                            asyncio.create_task(stream_provider(SearchProviders.search_reddit(self.session, effective_query, 25))),
                        ]

                        for q in queries[:max(20, min(len(queries), 40))]:
                            initial_tasks.append(asyncio.create_task(stream_provider(SearchProviders.search_bing(self.session, q, 25, time_frame=time_frame, on_url=push_candidate))))
                            initial_tasks.append(asyncio.create_task(stream_provider(SearchProviders.search_hackernews(self.session, q, 25, on_url=push_candidate))))

                        async def continuous_streamer():
                            round_num = 0
                            while not stop_event.is_set() and len(all_results) < limit:
                                if candidate_queue.qsize() < 150:
                                    round_num += 1
                                    w = random.choice(meaningful) if meaningful else random.choice(RANDOM_SECTORS).split()[0]
                                    suf = random.choice(BUSINESS_SUFFIXES)
                                    q_target = f"{w} {suf}{area_str}{tld_str}".strip()
                                    if round_num % 2 == 0:
                                        asyncio.create_task(stream_provider(SearchProviders.search_bing(self.session, q_target, 25, time_frame=time_frame, on_url=push_candidate)))
                                    else:
                                        asyncio.create_task(stream_provider(SearchProviders.search_hackernews(self.session, q_target, 25, on_url=push_candidate)))
                                await asyncio.sleep(0.05)

                        streamer_task = asyncio.create_task(continuous_streamer())
                        await asyncio.gather(*initial_tasks, streamer_task, return_exceptions=True)
                    except asyncio.CancelledError:
                        pass
                    except Exception:
                        pass

                # Validation Workers
                num_workers = min(1200, max(300, self.max_concurrent))
                seen_accepted_domains: Set[str] = set()

                async def validation_worker():
                    while not stop_event.is_set() and len(all_results) < limit:
                        try:
                            url = await asyncio.wait_for(candidate_queue.get(), timeout=0.15)
                        except (asyncio.TimeoutError, asyncio.CancelledError):
                            continue

                        if stop_event.is_set() or len(all_results) >= limit:
                            candidate_queue.task_done()
                            break

                        try:
                            r = await self._validate_and_scrape(
                                url, query, country=country, time_frame=time_frame,
                                area=area, tld=tld, on_candidate_found=push_candidate,
                                include_domains=include_domains, exclude_domains=exclude_domains
                            )
                            self.total_processed += 1
                            if isinstance(r, ScrapedResult) and r.is_alive:
                                d = r.domain or self.validator.extract_root_domain(r.url)
                                fmt_url = f"https://www.{d}" if d else ""
                                if fmt_url and fmt_url not in seen_accepted_domains and d not in seen_accepted_domains:
                                    seen_accepted_domains.add(fmt_url)
                                    seen_accepted_domains.add(d)
                                    res_dict = asdict(r)
                                    res_dict['url'] = fmt_url
                                    all_results.append(res_dict)
                                    self.pending_results_buffer.append(res_dict)
                                    if len(all_results) >= limit:
                                        stop_event.set()
                        except Exception:
                            self.total_processed += 1
                        finally:
                            candidate_queue.task_done()

                # Progress Reporting Loop
                async def progress_notifier():
                    while not stop_event.is_set() and len(all_results) < limit:
                        if on_progress:
                            elapsed = max(0.1, time.time() - self.start_time)
                            rate = len(all_results) / elapsed if len(all_results) > 0 else (self.total_processed / elapsed * 0.4)
                            remaining = round((limit - len(all_results)) / rate, 1) if rate > 0.1 else None
                            on_progress({
                                'status': 'searching',
                                'discovered': max(self.total_discovered, self.total_processed, len(all_results)),
                                'processed': self.total_processed,
                                'accepted': len(all_results),
                                'remaining': remaining,
                                'progress': min(99, (len(all_results) / limit) * 100)
                            })
                        await asyncio.sleep(0.2)

                producer_task = asyncio.create_task(discovery_producer())
                ingestor_task = asyncio.create_task(outlink_ingestor())
                worker_tasks = [asyncio.create_task(validation_worker()) for _ in range(num_workers)]
                notifier_task = asyncio.create_task(progress_notifier())

                while len(all_results) < limit and not stop_event.is_set():
                    await asyncio.sleep(0.02)

                stop_event.set()
                producer_task.cancel()
                ingestor_task.cancel()
                notifier_task.cancel()
                for w in worker_tasks:
                    w.cancel()
                await asyncio.gather(producer_task, ingestor_task, notifier_task, *worker_tasks, return_exceptions=True)

                final_results = all_results[:limit]

                # Save to persistent history
                if len(final_results) >= limit:
                    loop = asyncio.get_event_loop()
                    elapsed_sec = time.time() - self.start_time
                    await loop.run_in_executor(None, HistoryLogger.save_new_results, final_results, self.filtered_domains, query, elapsed_sec)

                if on_progress:
                    on_progress({
                        'status': 'completed' if len(final_results) >= limit else 'partial',
                        'discovered': max(self.total_discovered, self.total_processed, len(final_results)),
                        'processed': self.total_processed,
                        'accepted': len(final_results),
                        'remaining': 0,
                        'progress': 100
                    })

                return final_results
        except Exception:
            return all_results[:limit] if all_results else (self.pending_results_buffer[:limit] if self.pending_results_buffer else [])


# ==============================================================================
# CLI / Stdin Handler
# ==============================================================================

async def handle_request():
    """Handle JSON request from stdin, output results to stdout."""
    try:
        data = json.loads(sys.stdin.read())
        query = data.get('query', '')
        limit = min(int(data.get('limit', 10)), 5000)

        if not query:
            print(json.dumps({'error': 'No query provided'}))
            return

        engine = ScrapingEngine(max_concurrent=50)
        results = await engine.search(query, limit)
        print(json.dumps({'results': results}, indent=2))

    except Exception as e:
        print(json.dumps({'error': str(e)}))


if __name__ == '__main__':
    asyncio.run(handle_request())
