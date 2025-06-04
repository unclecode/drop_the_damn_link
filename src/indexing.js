

// =====================
// BM25 SEARCH IMPLEMENTATION
// =====================
class BM25Search {
    constructor() {
        this.bookmarks = [];
        this.folders = [];
        this.k1 = 1.5;
        this.b = 0.75;
    }

    setData(bookmarks, folders) {
        this.bookmarks = bookmarks;
        this.folders = folders;
    }

    tokenize(text) {
        const tokens = text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((token) => token.length > 2);
        
        // Add smart n-grams and substring tokens for better matching
        const smartTokens = new Set(tokens);
        
        for (const token of tokens) {
            // Add 3-grams for partial matching (crawl -> cra, raw, awl)
            if (token.length >= 4) {
                for (let i = 0; i <= token.length - 3; i++) {
                    smartTokens.add(token.substring(i, i + 3));
                }
            }
            
            // Add 4-grams for better matching (crawl4ai -> craw, rawl, awl4, wl4a, l4ai)
            if (token.length >= 5) {
                for (let i = 0; i <= token.length - 4; i++) {
                    smartTokens.add(token.substring(i, i + 4));
                }
            }
            
            // Add prefixes (crawl4ai -> craw, crawl, crawl4)
            if (token.length >= 4) {
                for (let i = 3; i < token.length; i++) {
                    smartTokens.add(token.substring(0, i + 1));
                }
            }
        }
        
        return Array.from(smartTokens);
    }

    async search(query) {
        if (!query.trim()) return [];

        const tokens = this.tokenize(query);
        const results = [];

        // Search bookmarks
        for (const bookmark of this.bookmarks) {
            const score = this.calculateScore(bookmark, tokens);
            if (score > 0) {
                results.push({
                    type: "bookmark",
                    item: bookmark,
                    score: score,
                });
            }
        }

        // Search folders
        for (const folder of this.folders) {
            const score = this.calculateScore(folder, tokens);
            if (score > 0) {
                results.push({
                    type: "folder",
                    item: folder,
                    score: score,
                });
            }
        }

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        return results;
    }

    calculateScore(item, tokens) {
        let score = 0;
        const doc = this.getDocumentText(item);
        const docTokens = this.tokenize(doc);
        const docLength = docTokens.length;
        const avgDocLength = this.getAvgDocLength();
        
        // Get original text for fuzzy matching
        const originalText = doc.toLowerCase();

        for (const token of tokens) {
            let tf = 0;
            let matchWeight = 1.0;
            
            // 1. Exact token match (highest weight)
            const exactMatches = docTokens.filter((t) => t === token).length;
            if (exactMatches > 0) {
                tf += exactMatches;
                matchWeight = 1.0;
            }
            
            // 2. Check for fuzzy/partial matches in original text
            if (exactMatches === 0 && token.length >= 3) {
                // Check if query token is contained in any word of original text
                const words = originalText.split(/\s+/);
                let fuzzyMatches = 0;
                
                for (const word of words) {
                    if (word.includes(token)) {
                        fuzzyMatches++;
                        
                        // Weight based on how good the match is
                        if (word.startsWith(token)) {
                            matchWeight = 0.8; // "crawl" matches "crawl4ai" - good prefix match
                        } else if (word.endsWith(token)) {
                            matchWeight = 0.6; // suffix match
                        } else {
                            matchWeight = 0.4; // substring match
                        }
                    }
                }
                
                if (fuzzyMatches > 0) {
                    tf += fuzzyMatches * 0.5; // Fuzzy matches count as half
                }
            }
            
            // 3. Calculate BM25 score with fuzzy weight
            if (tf > 0) {
                const idf = this.calculateIDF(token);
                if (idf > 0) {
                    const numerator = tf * (this.k1 + 1);
                    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));
                    score += (idf * (numerator / denominator)) * matchWeight;
                }
            }
        }

        return score;
    }

    getDocumentText(item) {
        // Check if it's a bookmark (has url property) vs folder (has name property)
        if (item.url) {
            // Build weighted document text for better search relevance
            let docText = "";
            
            // Title gets highest weight (repeated 3x)
            if (item.title) {
                docText += `${item.title} ${item.title} ${item.title} `;
            }
            
            // Metadata title also gets high weight if different from title
            if (item.metadata?.title && item.metadata.title !== item.title) {
                docText += `${item.metadata.title} ${item.metadata.title} `;
            }
            
            // Keywords get high weight (repeated 2x)
            if (item.metadata?.keywords && Array.isArray(item.metadata.keywords)) {
                const keywords = item.metadata.keywords.join(" ");
                docText += `${keywords} ${keywords} `;
            }
            
            // Tags get medium-high weight (repeated 2x)
            if (item.tags && Array.isArray(item.tags)) {
                const tags = item.tags.join(" ");
                docText += `${tags} ${tags} `;
            }
            
            // Description and metadata description get normal weight
            if (item.description) {
                docText += `${item.description} `;
            }
            if (item.metadata?.description && item.metadata.description !== item.description) {
                docText += `${item.metadata.description} `;
            }
            
            // OpenGraph data gets normal weight
            if (item.metadata?.ogTitle && item.metadata.ogTitle !== item.title) {
                docText += `${item.metadata.ogTitle} `;
            }
            if (item.metadata?.ogDescription) {
                docText += `${item.metadata.ogDescription} `;
            }
            
            // Site name and domain get lower weight
            if (item.metadata?.ogSiteName) {
                docText += `${item.metadata.ogSiteName} `;
            }
            
            // URL components for domain matching
            try {
                const url = new URL(item.url);
                docText += `${url.hostname.replace('www.', '')} `;
            } catch (e) {
                // Invalid URL, skip
            }
            
            return docText.trim();
        } else {
            return item.name;
        }
    }

    getAvgDocLength() {
        const allDocs = [
            ...this.bookmarks.map((b) => this.tokenize(this.getDocumentText(b)).length),
            ...this.folders.map((f) => this.tokenize(this.getDocumentText(f)).length),
        ];

        const total = allDocs.reduce((sum, len) => sum + len, 0);
        return total / (allDocs.length || 1);
    }

    calculateIDF(token) {
        let docCount = 0;

        // Count bookmarks containing token (exact or fuzzy)
        for (const bookmark of this.bookmarks) {
            if (this.documentContainsToken(bookmark, token)) {
                docCount++;
            }
        }

        // Count folders containing token (exact or fuzzy)
        for (const folder of this.folders) {
            if (this.documentContainsToken(folder, token)) {
                docCount++;
            }
        }

        const totalDocs = this.bookmarks.length + this.folders.length;
        if (docCount === 0 || totalDocs === 0) return 0;

        return Math.log(1 + (totalDocs - docCount + 0.5) / (docCount + 0.5));
    }
    
    /**
     * Check if document contains token (exact or fuzzy match)
     */
    documentContainsToken(item, token) {
        const text = this.getDocumentText(item).toLowerCase();
        const docTokens = this.tokenize(text);
        
        // 1. Check exact token match first
        if (docTokens.includes(token)) {
            return true;
        }
        
        // 2. Check fuzzy match if no exact match
        if (token.length >= 3) {
            const words = text.split(/\s+/);
            return words.some(word => word.includes(token));
        }
        
        return false;
    }
}

// Export for ES modules
export { BM25Search };
