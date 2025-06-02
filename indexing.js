

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
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((token) => token.length > 2);
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

        for (const token of tokens) {
            const tf = docTokens.filter((t) => t === token).length;
            const idf = this.calculateIDF(token);

            if (idf > 0) {
                const numerator = tf * (this.k1 + 1);
                const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));
                score += idf * (numerator / denominator);
            }
        }

        return score;
    }

    getDocumentText(item) {
        if (item.type === "bookmark") {
            return `${item.title} ${item.description || ""} ${(item.tags || []).join(" ")}`;
        } else {
            return item.name;
        }
    }

    getAvgDocLength() {
        const allDocs = [
            ...this.bookmarks.map((b) => this.tokenize(this.getDocumentText(b))).length,
            ...this.folders.map((f) => this.tokenize(this.getDocumentText(f))).length,
        ];

        const total = allDocs.reduce((sum, len) => sum + len, 0);
        return total / (allDocs.length || 1);
    }

    calculateIDF(token) {
        let docCount = 0;

        // Count bookmarks containing token
        for (const bookmark of this.bookmarks) {
            const text = this.getDocumentText(bookmark).toLowerCase();
            if (text.includes(token)) docCount++;
        }

        // Count folders containing token
        for (const folder of this.folders) {
            const text = this.getDocumentText(folder).toLowerCase();
            if (text.includes(token)) docCount++;
        }

        const totalDocs = this.bookmarks.length + this.folders.length;
        if (docCount === 0 || totalDocs === 0) return 0;

        return Math.log(1 + (totalDocs - docCount + 0.5) / (docCount + 0.5));
    }
}
