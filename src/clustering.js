/**
 * Automatic Bookmark Clustering System
 * 
 * This module implements semantic clustering of bookmarks using TF-IDF vectorization
 * and hierarchical clustering. URLs are automatically organized into folders based
 * on content similarity without manual intervention.
 * 
 * Philosophy: "Drop the damn link, let AI organize it!"
 */

// ES6 Module Imports from CDN
import { get, set } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

// We'll use natural.js for TF-IDF and text processing
// For now, we'll implement a minimal TF-IDF ourselves since natural.js has ES6 module issues
// Later we can swap this out for the full natural.js library or wink-bm25

/**
 * Minimal TF-IDF implementation for clustering
 */
class SimpleTfIdf {
    constructor() {
        this.documents = [];
        this.termCounts = new Map();
        this.vocabulary = new Set();
    }

    addDocument(text) {
        const tokens = this.tokenize(text);
        const doc = {
            tokens,
            termFreq: this.getTermFrequency(tokens),
            index: this.documents.length
        };
        
        this.documents.push(doc);
        
        // Update vocabulary and document frequency
        const uniqueTerms = new Set(tokens);
        uniqueTerms.forEach(term => {
            this.vocabulary.add(term);
            if (!this.termCounts.has(term)) {
                this.termCounts.set(term, 0);
            }
            this.termCounts.set(term, this.termCounts.get(term) + 1);
        });
        
        return doc.index;
    }

    tokenize(text) {
        // Simple tokenization - split on non-word characters, lowercase, filter stopwords
        const stopwords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can'
        ]);

        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2 && !stopwords.has(token));
    }

    getTermFrequency(tokens) {
        const freq = new Map();
        tokens.forEach(token => {
            freq.set(token, (freq.get(token) || 0) + 1);
        });
        return freq;
    }

    getVector(docIndex) {
        const doc = this.documents[docIndex];
        const vector = new Map();
        
        // Handle cold start: use TF only for single document corpus
        if (this.documents.length === 1) {
            // For single document, use normalized term frequency
            const maxTf = Math.max(...doc.termFreq.values());
            doc.termFreq.forEach((tf, term) => {
                const normalizedTf = tf / maxTf; // Normalize to 0-1 range
                if (normalizedTf > 0) {
                    vector.set(term, normalizedTf);
                }
            });
        } else {
            // Standard TF-IDF for multiple documents
            doc.termFreq.forEach((tf, term) => {
                const df = this.termCounts.get(term);
                const idf = Math.log(this.documents.length / df);
                const tfidf = tf * idf;
                if (tfidf > 0) {
                    vector.set(term, tfidf);
                }
            });
        }
        
        return vector;
    }
}

/**
 * Cosine similarity calculation for sparse vectors
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Calculate dot product and norm for vecA
    vecA.forEach((value, term) => {
        normA += value * value;
        if (vecB.has(term)) {
            dotProduct += value * vecB.get(term);
        }
    });

    // Calculate norm for vecB
    vecB.forEach((value) => {
        normB += value * value;
    });

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Generate UUID for folder IDs
 */
function generateUUID() {
    return 'folder-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}

/**
 * Automatic Clustering Engine
 */
class BookmarkClusteringEngine {
    constructor() {
        this.tfidf = new SimpleTfIdf();
        this.root = {
            id: 'root',
            label: 'All Bookmarks',
            centroid: null,
            children: []
        };
        this.isInitialized = false;
        
        // Clustering parameters
        this.SIMILARITY_THRESHOLD = 0.25;
        this.MAX_FOLDER_SIZE = 50;
        this.MIN_CLUSTER_SIZE = 3;
        
        console.log('📁 Clustering engine initialized');
    }

    /**
     * Initialize clustering engine and load persisted state
     */
    async initialize() {
        try {
            // Load persisted state
            const savedRoot = await get('clustering-tree');
            const savedTfidf = await get('clustering-tfidf');
            
            if (savedRoot && savedTfidf) {
                this.root = savedRoot;
                // Reconstruct TF-IDF state
                if (savedTfidf.documents) {
                    this.tfidf.documents = savedTfidf.documents;
                    this.tfidf.termCounts = new Map(savedTfidf.termCounts);
                    this.tfidf.vocabulary = new Set(savedTfidf.vocabulary);
                }
                console.log('📁 Loaded existing clustering state with', this.getLeafCount(), 'folders');
            }
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize clustering engine:', error);
            this.isInitialized = true; // Continue with empty state
        }
    }

    /**
     * Persist current state to IndexedDB
     */
    async persistState() {
        try {
            await set('clustering-tree', this.root);
            await set('clustering-tfidf', {
                documents: this.tfidf.documents,
                termCounts: Array.from(this.tfidf.termCounts.entries()),
                vocabulary: Array.from(this.tfidf.vocabulary)
            });
        } catch (error) {
            console.error('Failed to persist clustering state:', error);
        }
    }

    /**
     * Extract and clean text from URL metadata
     */
    extractTextFromMetadata(bookmark) {
        const parts = [];
        
        // Add title (highest weight)
        if (bookmark.title) {
            parts.push(bookmark.title.repeat(3)); // 3x weight
        }
        
        // Add description
        if (bookmark.description) {
            parts.push(bookmark.description);
        }
        
        // Add metadata if available
        if (bookmark.metadata) {
            if (bookmark.metadata.description) {
                parts.push(bookmark.metadata.description);
            }
            if (bookmark.metadata.keywords && Array.isArray(bookmark.metadata.keywords)) {
                parts.push(bookmark.metadata.keywords.join(' ').repeat(2)); // 2x weight
            }
            if (bookmark.metadata.ogSiteName) {
                parts.push(bookmark.metadata.ogSiteName);
            }
        }
        
        // Add tags (2x weight)
        if (bookmark.tags && Array.isArray(bookmark.tags)) {
            parts.push(bookmark.tags.join(' ').repeat(2));
        }
        
        // Add domain
        try {
            const url = new URL(bookmark.url);
            parts.push(url.hostname.replace(/^www\./, ''));
        } catch (e) {
            // Invalid URL, skip domain
        }
        
        const cleanText = parts.join(' ')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
            
        return cleanText;
    }

    /**
     * Calculate centroid vector from multiple document vectors
     */
    calculateCentroid(vectors) {
        if (!vectors || vectors.length === 0) return new Map();
        
        const centroid = new Map();
        const count = vectors.length;
        
        // Sum all vectors
        vectors.forEach(vector => {
            vector.forEach((value, term) => {
                centroid.set(term, (centroid.get(term) || 0) + value);
            });
        });
        
        // Average the values
        centroid.forEach((value, term) => {
            centroid.set(term, value / count);
        });
        
        return centroid;
    }

    /**
     * Find all leaf folders in the tree
     */
    getLeafFolders(node = this.root) {
        const leaves = [];
        
        if (!node.children || node.children.length === 0) {
            // This is a leaf
            if (node.id !== 'root') { // Don't include root as a leaf
                leaves.push(node);
            }
        } else {
            // Recursively get leaves from children
            node.children.forEach(child => {
                leaves.push(...this.getLeafFolders(child));
            });
        }
        
        return leaves;
    }

    /**
     * Get count of leaf folders
     */
    getLeafCount() {
        return this.getLeafFolders().length;
    }

    /**
     * Find the best matching folder for a bookmark
     */
    findBestFolder(vector) {
        const leafFolders = this.getLeafFolders();
        
        if (leafFolders.length === 0) {
            return { folder: null, similarity: 0 };
        }
        
        let bestFolder = null;
        let bestSimilarity = 0;
        
        leafFolders.forEach(folder => {
            if (folder.centroid) {
                const similarity = cosineSimilarity(vector, folder.centroid);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestFolder = folder;
                }
            }
        });
        
        return { folder: bestFolder, similarity: bestSimilarity };
    }

    /**
     * Create a new folder for a bookmark
     */
    createNewFolder(bookmark, vector) {
        const folder = {
            id: generateUUID(),
            label: this.generateFolderLabel(bookmark),
            centroid: new Map(vector), // Copy the vector
            urls: [{ url: bookmark.url, vector: new Map(vector) }],
            children: []
        };
        
        // Add to root's children
        this.root.children.push(folder);
        
        console.log('📁 Created new folder:', folder.label);
        return folder;
    }

    /**
     * Generate a readable label for a folder based on bookmark content
     */
    generateFolderLabel(bookmark) {
        // Simple labeling - use domain or first few words of title
        try {
            const url = new URL(bookmark.url);
            let domain = url.hostname.replace(/^www\./, '');
            
            // Capitalize first letter
            domain = domain.charAt(0).toUpperCase() + domain.slice(1);
            
            return `${domain} Resources`;
        } catch (e) {
            // Fallback to title
            if (bookmark.title) {
                const words = bookmark.title.split(' ').slice(0, 3);
                return words.join(' ') + ' Collection';
            }
            return `Cluster ${Date.now()}`;
        }
    }

    /**
     * Add a bookmark to an existing folder and update its centroid
     */
    addToFolder(folder, bookmark, vector) {
        if (!folder.urls) {
            folder.urls = [];
        }
        
        folder.urls.push({ url: bookmark.url, vector: new Map(vector) });
        
        // Recalculate centroid
        const vectors = folder.urls.map(item => item.vector);
        folder.centroid = this.calculateCentroid(vectors);
        
        console.log(`📁 Added "${bookmark.title}" to folder "${folder.label}" (${folder.urls.length} items)`);
        
        return folder;
    }

    /**
     * Main clustering method - add a bookmark to the appropriate cluster
     */
    async addBookmark(bookmark) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            // Extract and vectorize text
            const text = this.extractTextFromMetadata(bookmark);
            if (!text || text.trim().length === 0) {
                console.warn('⚠️ No text content found for:', bookmark.url);
                return null;
            }
            
            const docIndex = this.tfidf.addDocument(text);
            const vector = this.tfidf.getVector(docIndex);
            
            if (vector.size === 0) {
                console.warn('⚠️ Empty vector generated for:', bookmark.url);
                return null;
            }
            
            // Handle cold start: if this is the very first bookmark, always create a new folder
            const leafFolders = this.getLeafFolders();
            let targetFolder;
            let similarity = 0; // Default similarity for new folders
            let folder = null; // Track the found folder for isNewFolder calculation
            
            if (leafFolders.length === 0) {
                // First bookmark ever - create initial folder
                targetFolder = this.createNewFolder(bookmark, vector);
                console.log('📁 Cold start: Created first cluster folder');
            } else {
                // Find best matching folder among existing ones
                const matchResult = this.findBestFolder(vector);
                folder = matchResult.folder;
                similarity = matchResult.similarity;
                
                if (folder && similarity >= this.SIMILARITY_THRESHOLD) {
                    // Add to existing folder
                    targetFolder = this.addToFolder(folder, bookmark, vector);
                    
                    // Check if folder needs splitting
                    if (targetFolder.urls.length > this.MAX_FOLDER_SIZE) {
                        console.log(`📁 Folder "${targetFolder.label}" exceeded max size, considering split`);
                        // TODO: Implement folder splitting in next phase
                    }
                } else {
                    // Create new folder
                    targetFolder = this.createNewFolder(bookmark, vector);
                    folder = null; // Reset folder since we're creating new
                }
            }
            
            // Persist state
            await this.persistState();
            
            return {
                folderId: targetFolder.id,
                folderLabel: targetFolder.label,
                similarity: similarity,
                isNewFolder: !folder // true if we created a new folder, false if we used existing
            };
            
        } catch (error) {
            console.error('Error in clustering:', error);
            return null;
        }
    }

    /**
     * Get the clustering tree structure for UI display
     */
    getClusterTree() {
        return this.root;
    }

    /**
     * Get statistics about the clustering system
     */
    getStats() {
        const leafFolders = this.getLeafFolders();
        const totalUrls = leafFolders.reduce((sum, folder) => sum + (folder.urls?.length || 0), 0);
        
        return {
            totalFolders: leafFolders.length,
            totalUrls: totalUrls,
            vocabulary: this.tfidf.vocabulary.size,
            threshold: this.SIMILARITY_THRESHOLD
        };
    }

    /**
     * Reset clustering state (for testing/debugging)
     */
    async reset() {
        this.tfidf = new SimpleTfIdf();
        this.root = {
            id: 'root',
            label: 'All Bookmarks',
            centroid: null,
            children: []
        };
        
        await this.persistState();
        console.log('📁 Clustering state reset');
    }

    /**
     * Debug method to test cold start behavior
     */
    testColdStart() {
        console.log('🧪 Testing cold start behavior...');
        
        // Test with minimal bookmark
        const testBookmark = {
            title: 'Test Article',
            url: 'https://example.com/test',
            description: 'This is a test article about machine learning',
            tags: ['ai', 'testing']
        };
        
        const text = this.extractTextFromMetadata(testBookmark);
        console.log('📝 Extracted text:', text);
        
        const docIndex = this.tfidf.addDocument(text);
        const vector = this.tfidf.getVector(docIndex);
        
        console.log('📊 Generated vector size:', vector.size);
        console.log('📊 Vector contents:', Array.from(vector.entries()));
        
        return vector.size > 0;
    }
}

// Export the clustering engine
export { BookmarkClusteringEngine };