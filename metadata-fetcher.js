/**
 * Streamlined Metadata Fetcher - Production Ready
 * Focuses on working strategies for client-side metadata extraction
 */

class MetadataFetcher {
    constructor() {
        // Only use the working CORS proxy
        this.corsProxy = 'https://corsproxy.io/?';
        
        // Microlink API for rich previews
        this.microlinkAPI = 'https://api.microlink.io';
        
        // Multiple favicon APIs for fallback
        this.faviconAPIs = [
            (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
            (domain) => `https://favicons.githubusercontent.com/${domain}`,
            (domain) => `https://icon.horse/icon/${domain}`
        ];
    }

    /**
     * Fetch metadata for a URL - returns standardized metadata object
     */
    async fetchMetadata(url, options = {}) {
        const { timeout = 10000, useMicrolink = true } = options;
        
        // Start with basic URL analysis
        const metadata = this.analyzeURL(url);
        
        // Fetch favicon in parallel
        const faviconPromise = this.fetchFavicon(metadata.domain);
        
        // CORS PROXY IS PRIMARY - it gives us ALL the valuable metadata!
        let richMetadata = await this.fetchViaCorsProxy(url, timeout);
        
        // If CORS proxy worked and we want images, try Microlink for better image quality
        if (richMetadata && useMicrolink) {
            const microlinkData = await this.fetchViaMicrolink(url);
            if (microlinkData && microlinkData.image) {
                // Only use Microlink for images if they're better quality
                richMetadata.image = microlinkData.image || richMetadata.image;
                richMetadata.logo = microlinkData.logo;
            }
        }
        
        // If CORS proxy failed completely, try Microlink as fallback
        if (!richMetadata && useMicrolink) {
            richMetadata = await this.fetchViaMicrolink(url);
        }
        
        // Wait for favicon
        metadata.favicon = await faviconPromise;
        
        // Merge rich metadata if available
        if (richMetadata) {
            return this.mergeMetadata(metadata, richMetadata);
        }
        
        return metadata;
    }

    /**
     * Analyze URL to extract basic information
     */
    analyzeURL(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(s => s);
            
            return {
                url: url,
                domain: urlObj.hostname,
                protocol: urlObj.protocol,
                path: urlObj.pathname,
                
                // Clean title from URL
                title: this.extractTitleFromURL(urlObj),
                
                // Basic categorization
                type: this.detectContentType(urlObj),
                platform: this.detectPlatform(urlObj.hostname),
                
                // Timestamp
                fetchedAt: new Date().toISOString(),
                
                // Initialize empty fields
                description: null,
                author: null,
                publishedDate: null,
                image: null,
                favicon: null,
                tags: [],
                
                // For search optimization
                keywords: this.extractKeywords(urlObj)
            };
        } catch (error) {
            throw new Error(`Invalid URL: ${error.message}`);
        }
    }

    /**
     * Extract clean title from URL
     */
    extractTitleFromURL(urlObj) {
        const path = urlObj.pathname;
        
        // Special handling for known platforms
        if (urlObj.hostname.includes('github.com')) {
            const parts = path.split('/').filter(p => p);
            if (parts.length >= 2) {
                return `${parts[0]}/${parts[1]} - GitHub`;
            }
        }
        
        // Get last meaningful segment
        let title = path
            .split('/')
            .filter(p => p && !p.match(/^\d+$/) && !p.match(/\.(html?|php|aspx?)$/i))
            .pop() || urlObj.hostname;
        
        // Clean up the title
        title = title
            .replace(/[-_]/g, ' ')
            .replace(/\.[^.]+$/, '') // Remove extension
            .replace(/^\d{4}\/\d{2}\/\d{2}\//, '') // Remove date prefixes
            .trim();
        
        // Capitalize words
        title = title.replace(/\b\w/g, l => l.toUpperCase());
        
        return title || urlObj.hostname;
    }

    /**
     * Detect content type from URL patterns
     */
    detectContentType(urlObj) {
        const path = urlObj.pathname.toLowerCase();
        const hostname = urlObj.hostname.toLowerCase();
        
        // Video platforms
        if (hostname.includes('youtube.com') || hostname.includes('vimeo.com')) {
            return 'video';
        }
        
        // Code repositories
        if (hostname.includes('github.com') || hostname.includes('gitlab.com')) {
            return 'repository';
        }
        
        // Articles/blogs
        if (path.includes('/blog/') || path.includes('/post/') || 
            path.includes('/article/') || hostname.includes('medium.com')) {
            return 'article';
        }
        
        // Documentation
        if (path.includes('/docs/') || path.includes('/documentation/')) {
            return 'documentation';
        }
        
        // Product pages
        if (path.includes('/product/') || path.includes('/item/')) {
            return 'product';
        }
        
        return 'website';
    }

    /**
     * Detect platform from hostname
     */
    detectPlatform(hostname) {
        const platforms = {
            'youtube.com': 'YouTube',
            'github.com': 'GitHub',
            'twitter.com': 'Twitter',
            'x.com': 'X',
            'linkedin.com': 'LinkedIn',
            'medium.com': 'Medium',
            'reddit.com': 'Reddit',
            'stackoverflow.com': 'Stack Overflow',
            'wikipedia.org': 'Wikipedia',
            'arxiv.org': 'arXiv',
            'npmjs.com': 'npm',
            'dev.to': 'DEV Community'
        };
        
        for (const [domain, name] of Object.entries(platforms)) {
            if (hostname.includes(domain)) return name;
        }
        
        return null;
    }

    /**
     * Extract keywords from URL for better search
     */
    extractKeywords(urlObj) {
        const keywords = [];
        
        // Add domain parts
        keywords.push(...urlObj.hostname.split('.').filter(p => p !== 'www' && p !== 'com'));
        
        // Add path segments
        const pathKeywords = urlObj.pathname
            .split('/')
            .filter(p => p && p.length > 2)
            .map(p => p.replace(/[-_]/g, ' '));
        
        keywords.push(...pathKeywords);
        
        // Add query parameters
        urlObj.searchParams.forEach((value, key) => {
            if (key !== 'utm_source' && key !== 'utm_medium') {
                keywords.push(key, value);
            }
        });
        
        return [...new Set(keywords)].filter(k => k.length > 2);
    }

    /**
     * Fetch favicon URL
     */
    async fetchFavicon(domain) {
        // Try each favicon API
        for (const getUrl of this.faviconAPIs) {
            const faviconUrl = getUrl(domain);
            try {
                // Test if accessible
                const img = new Image();
                img.src = faviconUrl;
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    setTimeout(reject, 3000); // 3s timeout
                });
                
                return faviconUrl;
            } catch {
                // Try next favicon API
                continue;
            }
        }
        
        // Default fallback
        return this.faviconAPIs[0](domain);
    }

    /**
     * Fetch metadata via Microlink API
     */
    async fetchViaMicrolink(url) {
        try {
            const response = await fetch(`${this.microlinkAPI}?url=${encodeURIComponent(url)}`);
            
            if (!response.ok) return null;
            
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                return {
                    title: data.data.title,
                    description: data.data.description,
                    author: data.data.author,
                    publishedDate: data.data.date,
                    image: data.data.image?.url,
                    logo: data.data.logo?.url,
                    lang: data.data.lang,
                    publisher: data.data.publisher
                };
            }
        } catch (error) {
            console.warn('Microlink API failed:', error);
        }
        
        return null;
    }

    /**
     * Fetch metadata via CORS proxy
     */
    async fetchViaCorsProxy(url, timeout) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(this.corsProxy + encodeURIComponent(url), {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) return null;
            
            // Read only until </head> with efficient chunking
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let html = '';
            let totalBytes = 0;
            const maxBytes = 64 * 1024; // 64KB limit for metadata
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    totalBytes += value.byteLength;
                    html += decoder.decode(value, { stream: true });
                    
                    // Stop if we found </head> (most metadata is in head)
                    if (html.includes('</head>')) {
                        break;
                    }
                    
                    // Safety limits: don't read more than 64KB
                    if (totalBytes > maxBytes) {
                        console.log('Stopped reading at 64KB limit');
                        break;
                    }
                }
            } finally {
                reader.releaseLock();
                controller.abort(); // Ensure connection is closed
            }
            
            // remove any trailing content after </head>
            html = html.split('</head>')[0] + '</head>';
            html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''); // Remove scripts
            html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ''); // Remove styles
            html = html.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
            html = html.replace(/<\?xml[^>]*>/gi, ''); // Remove XML declarations
            html = html.replace(/<!DOCTYPE[^>]*>/gi, ''); // Remove DOCTYPE declarations
            return this.parseHTMLMetadata(html);
            
        } catch (error) {
            console.warn('CORS proxy fetch failed:', error);
            return null;
        }
    }

    /**
     * Parse metadata from HTML - GREEDY approach, get everything!
     * Worker-compatible version using regex parsing
     */
    parseHTMLMetadata(html) {
        // Helper function to extract meta content using regex
        const getMeta = (names) => {
            if (!Array.isArray(names)) names = [names];
            
            for (const name of names) {
                // Try different meta tag patterns
                const patterns = [
                    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
                    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
                    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
                    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
                    new RegExp(`<meta[^>]+itemprop=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
                    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']${name}["']`, 'i')
                ];
                
                for (const pattern of patterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        return match[1].trim();
                    }
                }
            }
            return null;
        };
        
        // Helper function to extract title
        const getTitle = () => {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            return titleMatch ? titleMatch[1].trim() : null;
        };
        
        // Helper function to extract JSON-LD
        const getJsonLd = () => {
            try {
                const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i);
                if (jsonLdMatch) {
                    return JSON.parse(jsonLdMatch[1]);
                }
            } catch (e) {
                // Invalid JSON, ignore
            }
            return null;
        };
        
        // Helper function to extract links
        const getLink = (rel) => {
            const linkMatch = html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i')) ||
                            html.match(new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, 'i'));
            return linkMatch ? linkMatch[1] : null;
        };
        
        // Helper function to extract language
        const getLanguage = () => {
            const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
            return langMatch ? langMatch[1] : null;
        };
        
        // Extract ALL metadata greedily
        const metadata = {
            // Basic metadata
            title: getTitle(),
            description: getMeta(['description', 'Description']),
            keywords: getMeta(['keywords', 'Keywords']),
            author: getMeta(['author', 'Author', 'article:author', 'twitter:creator']),
            generator: getMeta(['generator']),
            
            // OpenGraph - get everything!
            ogTitle: getMeta(['og:title']),
            ogDescription: getMeta(['og:description']),
            ogImage: getMeta(['og:image']),
            ogUrl: getMeta(['og:url']),
            ogType: getMeta(['og:type']),
            ogSiteName: getMeta(['og:site_name']),
            ogLocale: getMeta(['og:locale']),
            ogVideo: getMeta(['og:video']),
            
            // Twitter Card - all of it
            twitterCard: getMeta(['twitter:card']),
            twitterTitle: getMeta(['twitter:title']),
            twitterDescription: getMeta(['twitter:description']),
            twitterImage: getMeta(['twitter:image']),
            twitterImageAlt: getMeta(['twitter:image:alt']),
            twitterCreator: getMeta(['twitter:creator']),
            twitterSite: getMeta(['twitter:site']),
            
            // Article metadata
            publishedTime: getMeta(['article:published_time', 'datePublished', 'pubdate']),
            modifiedTime: getMeta(['article:modified_time', 'dateModified']),
            articleSection: getMeta(['article:section']),
            articleTag: getMeta(['article:tag']),
            
            // Additional useful metadata
            image: getMeta(['og:image', 'twitter:image', 'image']),
            favicon: this.extractFaviconFromHTML(html),
            canonical: getLink('canonical'),
            alternate: getLink('alternate'),
            themeColor: getMeta(['theme-color', 'msapplication-TileColor']),
            robots: getMeta(['robots']),
            viewport: getMeta(['viewport']),
            rating: getMeta(['rating']),
            
            // Schema.org
            applicationName: getMeta(['application-name']),
            publisher: getMeta(['publisher', 'DC.publisher']),
            copyright: getMeta(['copyright']),
            language: getMeta(['language', 'og:locale']) || getLanguage(),
            
            // Apple specific
            appleMobileWebAppTitle: getMeta(['apple-mobile-web-app-title']),
            appleMobileWebAppCapable: getMeta(['apple-mobile-web-app-capable']),
            
            // Feeds
            rssFeeds: this.extractFeedsFromHTML(html),
            
            // Structured data
            jsonLd: getJsonLd(),
            
            // Tags from various sources
            tags: this.extractTagsFromHTML(html)
        };
        
        // Clean out null values but keep all real data
        return Object.fromEntries(
            Object.entries(metadata).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        );
    }

    /**
     * Extract favicon from HTML string (worker-compatible)
     */
    extractFaviconFromHTML(html) {
        const patterns = [
            /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["']/i,
            /<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']shortcut icon["']/i,
            /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    }

    /**
     * Extract tags/keywords from HTML string (worker-compatible)
     */
    extractTagsFromHTML(html) {
        const tags = [];
        
        // Get keywords meta tag
        const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i);
        if (keywordsMatch && keywordsMatch[1]) {
            tags.push(...keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k));
        }
        
        // Get article tags
        const articleTagMatches = html.match(/<meta[^>]+property=["']article:tag["'][^>]+content=["']([^"']+)["']/gi);
        if (articleTagMatches) {
            articleTagMatches.forEach(match => {
                const contentMatch = match.match(/content=["']([^"']+)["']/i);
                if (contentMatch && contentMatch[1]) {
                    tags.push(contentMatch[1].trim());
                }
            });
        }
        
        return [...new Set(tags)];
    }
    
    /**
     * Extract RSS/Atom feeds from HTML string (worker-compatible)
     */
    extractFeedsFromHTML(html) {
        const feeds = [];
        
        // RSS feed patterns
        const rssPattern = /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/gi;
        const atomPattern = /<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/gi;
        
        let match;
        
        // Extract RSS feeds
        while ((match = rssPattern.exec(html)) !== null) {
            const titleMatch = match[0].match(/title=["']([^"']+)["']/i);
            feeds.push({
                title: titleMatch ? titleMatch[1] : 'RSS Feed',
                href: match[1],
                type: 'application/rss+xml'
            });
        }
        
        // Extract Atom feeds
        while ((match = atomPattern.exec(html)) !== null) {
            const titleMatch = match[0].match(/title=["']([^"']+)["']/i);
            feeds.push({
                title: titleMatch ? titleMatch[1] : 'Atom Feed',
                href: match[1],
                type: 'application/atom+xml'
            });
        }
        
        return feeds.length > 0 ? feeds : null;
    }
    
    /**
     * Extract RSS/Atom feeds (legacy DOM version)
     */
    extractFeeds(doc) {
        const feeds = [];
        const feedLinks = doc.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"]');
        
        feedLinks.forEach(link => {
            if (link.href) {
                feeds.push({
                    title: link.title || 'RSS Feed',
                    href: link.href,
                    type: link.type
                });
            }
        });
        
        return feeds.length > 0 ? feeds : null;
    }
    
    /**
     * Extract JSON-LD structured data
     */
    extractJSONLD(doc) {
        const jsonLdData = [];
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        
        scripts.forEach(script => {
            try {
                const content = script.textContent || script.innerHTML;
                if (content) {
                    const parsed = JSON.parse(content);
                    jsonLdData.push(parsed);
                }
            } catch (e) {
                // Invalid JSON, skip it
                console.warn('Failed to parse JSON-LD:', e);
            }
        });
        
        return jsonLdData.length > 0 ? jsonLdData : null;
    }

    /**
     * Merge metadata from different sources
     */
    mergeMetadata(basic, rich) {
        const merged = { ...basic };
        
        // Override with rich metadata if available
        Object.keys(rich).forEach(key => {
            if (rich[key] !== null && rich[key] !== undefined) {
                if (key === 'tags' && merged.tags) {
                    // Merge tags
                    merged.tags = [...new Set([...merged.tags, ...rich[key]])];
                } else {
                    merged[key] = rich[key];
                }
            }
        });
        
        // Clean up the final object
        return this.cleanMetadata(merged);
    }

    /**
     * Clean and standardize metadata - keep ALL useful data!
     */
    cleanMetadata(metadata) {
        // Start with all metadata
        const cleaned = { ...metadata };
        
        // Ensure critical fields have proper values
        cleaned.url = metadata.url;
        cleaned.domain = metadata.domain;
        cleaned.fetchedAt = metadata.fetchedAt;
        
        // Use best available title
        cleaned.title = metadata.ogTitle || metadata.twitterTitle || metadata.title || metadata.domain;
        
        // Use best available description
        cleaned.description = metadata.ogDescription || metadata.twitterDescription || metadata.description || null;
        
        // Use best available image
        cleaned.image = metadata.ogImage || metadata.twitterImage || metadata.image || null;
        
        // Ensure arrays are arrays
        cleaned.tags = metadata.tags || [];
        cleaned.keywords = this.processKeywords(metadata);
        
        // Keep all the rich metadata for searching
        return cleaned;
    }
    
    /**
     * Process keywords from various sources
     */
    processKeywords(metadata) {
        const keywordSet = new Set();
        
        // Add from keywords meta tag (handle both string and array)
        if (metadata.keywords) {
            if (Array.isArray(metadata.keywords)) {
                // Already an array from extractTagsFromHTML
                metadata.keywords.forEach(k => {
                    if (k) keywordSet.add(k.toString().trim().toLowerCase());
                });
            } else if (typeof metadata.keywords === 'string') {
                // String from meta tag, split by comma
                metadata.keywords.split(',').forEach(k => {
                    if (k.trim()) keywordSet.add(k.trim().toLowerCase());
                });
            }
        }
        
        // Add from tags array
        if (metadata.tags && Array.isArray(metadata.tags)) {
            metadata.tags.forEach(t => {
                if (t && typeof t === 'string') keywordSet.add(t.trim().toLowerCase());
            });
        }
        
        // Add from article tags (different from regular tags)
        if (metadata.articleTag) {
            if (Array.isArray(metadata.articleTag)) {
                metadata.articleTag.forEach(t => {
                    if (t) keywordSet.add(t.toString().trim().toLowerCase());
                });
            } else if (typeof metadata.articleTag === 'string') {
                keywordSet.add(metadata.articleTag.trim().toLowerCase());
            }
        }
        
        // Add from article section
        if (metadata.articleSection) {
            keywordSet.add(metadata.articleSection.toLowerCase());
        }
        
        // Add platform/type
        if (metadata.platform) keywordSet.add(metadata.platform.toLowerCase());
        if (metadata.type) keywordSet.add(metadata.type.toLowerCase());
        
        // Add site name as keyword
        if (metadata.ogSiteName) keywordSet.add(metadata.ogSiteName.toLowerCase());
        
        return Array.from(keywordSet).filter(k => k && k.length > 2);
    }

    /**
     * Generate markdown representation of bookmark
     */
    generateMarkdown(metadata) {
        const lines = [];
        
        // Title with link
        lines.push(`# [${metadata.title}](${metadata.url})`);
        lines.push('');
        
        // Core metadata section
        const metaItems = [];
        if (metadata.author || metadata.twitterCreator) metaItems.push(`**Author**: ${metadata.author || metadata.twitterCreator}`);
        if (metadata.publishedTime) metaItems.push(`**Published**: ${new Date(metadata.publishedTime).toLocaleDateString()}`);
        if (metadata.modifiedTime) metaItems.push(`**Updated**: ${new Date(metadata.modifiedTime).toLocaleDateString()}`);
        if (metadata.platform) metaItems.push(`**Platform**: ${metadata.platform}`);
        if (metadata.type) metaItems.push(`**Type**: ${metadata.type}`);
        if (metadata.articleSection) metaItems.push(`**Section**: ${metadata.articleSection}`);
        
        if (metaItems.length > 0) {
            lines.push('## Metadata');
            metaItems.forEach(item => lines.push(`- ${item}`));
            lines.push('');
        }
        
        // Description
        if (metadata.description) {
            lines.push('## Description');
            lines.push(metadata.description);
            lines.push('');
        }
        
        // Keywords (if different from tags)
        if (metadata.keywords && metadata.keywords.length > 0) {
            lines.push('## Keywords');
            lines.push(metadata.keywords.map(k => `\`${k}\``).join(' '));
            lines.push('');
        }
        
        // Tags
        if (metadata.tags && metadata.tags.length > 0) {
            lines.push('## Tags');
            lines.push(metadata.tags.map(tag => `\`${tag}\``).join(' '));
            lines.push('');
        }
        
        // Rich metadata (for reference)
        const richMeta = [];
        if (metadata.ogSiteName) richMeta.push(`Site: ${metadata.ogSiteName}`);
        if (metadata.language) richMeta.push(`Language: ${metadata.language}`);
        if (metadata.publisher) richMeta.push(`Publisher: ${metadata.publisher}`);
        
        if (richMeta.length > 0) {
            lines.push('## Additional Info');
            richMeta.forEach(item => lines.push(`- ${item}`));
            lines.push('');
        }
        
        // Footer with fetch info
        lines.push('---');
        lines.push(`*Bookmarked on ${new Date(metadata.fetchedAt).toLocaleString()}*`);
        
        return lines.join('\n');
    }
}

// Helper function for testing
async function testMetadataFetcher(url) {
    console.log(`🔍 Fetching metadata for: ${url}`);
    
    const fetcher = new MetadataFetcher();
    
    try {
        const metadata = await fetcher.fetchMetadata(url);
        
        console.log('\n📊 Metadata:', metadata);
        console.log('\n📝 Markdown representation:');
        console.log(fetcher.generateMarkdown(metadata));
        
        return metadata;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

// Export for use in the app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetadataFetcher;
}

// add to window for browser use
if (typeof window !== 'undefined') {
    window.remember = window.remember || {};
    window.remember.MetadataFetcher = MetadataFetcher;
    window.remember.fetchMetadata = async (url, options) => {
        const fetcher = new MetadataFetcher();
        return await fetcher.fetchMetadata(url, options);
    };
    window.remember.callFetchMetadata = (url, options, cb) => {
        const fetcher = new MetadataFetcher();
        fetcher.fetchMetadata(url, options)
            .then(metadata => {
                if (cb && typeof cb === 'function') {
                    cb(metadata);
                } else {
                    console.log('Metadata fetched:', metadata);
                }
            })
            .catch(error => {
                console.error('Error fetching metadata:', error);
                if (cb && typeof cb === 'function') {
                    cb(null, error);
                }
            });
    }

    
}

// console.log('✅ MetadataFetcher loaded!');
// console.log('Test with: testMetadataFetcher("https://example.com")');