// =====================
// STRATEGY INTERFACES
// =====================
class DataProvider {
    async init() {}
    async saveBookmark(bookmark) {}
    async getBookmark(id) {}
    async getBookmarks() {
        return [];
    }
    async deleteBookmark(id) {}
    async saveFolder(folder) {}
    async getFolders() {
        return [];
    }
    async deleteFolder(id) {}
}

class AuthProvider {
    async login(email, password) {
        return false;
    }
    async logout() {}
    async getCurrentUser() {
        return null;
    }
    async isAuthenticated() {
        return false;
    }
}



// =====================
// IMPLEMENTATIONS
// =====================
class IndexedDBProvider extends DataProvider {
    constructor() {
        super();
        this.dbName = "AIChatOrganizerDB";
        this.dbVersion = 2; // Incremented for metadata support
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = request.result;
                const transaction = event.target.transaction;

                // Create bookmarks store if it doesn't exist
                if (!db.objectStoreNames.contains("bookmarks")) {
                    const store = db.createObjectStore("bookmarks", { keyPath: "id" });
                    store.createIndex("folderId", "folderId", { unique: false });
                    store.createIndex("createdAt", "createdAt", { unique: false });
                    store.createIndex("metadataFetched", "metadataFetched", { unique: false });
                    store.createIndex("url", "url", { unique: false });
                } else {
                    // Update existing store with new indices for metadata
                    const store = transaction.objectStore("bookmarks");
                    if (!store.indexNames.contains("metadataFetched")) {
                        store.createIndex("metadataFetched", "metadataFetched", { unique: false });
                    }
                    if (!store.indexNames.contains("url")) {
                        store.createIndex("url", "url", { unique: false });
                    }
                }

                // Create folders store if it doesn't exist
                if (!db.objectStoreNames.contains("folders")) {
                    const store = db.createObjectStore("folders", { keyPath: "id" });
                    store.createIndex("parentId", "parentId", { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async saveBookmark(bookmark) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("bookmarks", "readwrite");
            const store = tx.objectStore("bookmarks");

            // Set created date if new
            if (!bookmark.id) {
                bookmark.id = Date.now().toString();
                bookmark.createdAt = new Date();
            }

            const request = store.put(bookmark);

            request.onsuccess = () => resolve(bookmark);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getBookmark(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("bookmarks", "readonly");
            const store = tx.objectStore("bookmarks");
            const request = store.get(id);

            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getBookmarks(folderId = null) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("bookmarks", "readonly");
            const store = tx.objectStore("bookmarks");
            const index = store.index("createdAt");
            const request = index.getAll();

            request.onsuccess = (e) => {
                let bookmarks = e.target.result || [];

                // Filter by folder if specified
                if (folderId) {
                    bookmarks = bookmarks.filter((b) => b.folderId === folderId);
                }

                resolve(bookmarks);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteBookmark(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("bookmarks", "readwrite");
            const store = tx.objectStore("bookmarks");
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async saveFolder(folder) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("folders", "readwrite");
            const store = tx.objectStore("folders");

            // Set ID if new
            if (!folder.id) {
                folder.id = Date.now().toString();
            }

            const request = store.put(folder);

            request.onsuccess = () => resolve(folder);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getFolders() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("folders", "readonly");
            const store = tx.objectStore("folders");
            const request = store.getAll();

            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteFolder(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("folders", "readwrite");
            const store = tx.objectStore("folders");
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

class NaiveAuthProvider extends AuthProvider {
    async login(email, password) {
        // In a real app, this would validate with a server
        // For this demo, we just store in localStorage
        localStorage.setItem("auth_email", email);
        localStorage.setItem("auth_authenticated", "true");
        return true;
    }

    async logout() {
        localStorage.removeItem("auth_email");
        localStorage.removeItem("auth_authenticated");
    }

    async getCurrentUser() {
        return localStorage.getItem("auth_email");
    }

    async isAuthenticated() {
        return localStorage.getItem("auth_authenticated") === "true";
    }
}