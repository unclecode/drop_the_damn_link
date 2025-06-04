// Import all required classes
import { IndexedDBProvider, NaiveAuthProvider } from "./strategies.js";
import { BM25Search } from "./indexing.js";
import { MetadataFetcher } from "./metadata-fetcher.js";
import { BookmarkClusteringEngine } from "./clustering.js";

// =====================
// APP CORE
// =====================
class AIChatOrganizer {
    constructor() {
        this.dataProvider = new IndexedDBProvider();
        this.authProvider = new NaiveAuthProvider();
        this.searchEngine = new BM25Search();
        this.currentFolder = "root";
        this.editingBookmark = null;
        this.editingFolder = null;
        this.tags = [];
        this.viewMode = "card"; // Default view mode
        this.metadataFetcher = new MetadataFetcher();
        this.metadataStatus = new Map(); // Track metadata fetch status
        this.clusteringEngine = new BookmarkClusteringEngine(); // Automatic clustering
        this.useAutoClustering = true; // Enable by default
    }

    async init() {
        try {
            // Initialize theme (default to dark)
            this.initTheme();

            // Initialize clustering settings
            this.initClustering();

            // Initialize database
            await this.dataProvider.init();

            // Initialize clustering engine
            await this.clusteringEngine.initialize();

            // Check authentication
            const isAuthenticated = await this.authProvider.isAuthenticated();

            if (isAuthenticated) {
                this.showMainApp();
            } else {
                this.showLogin();
            }

            // Setup event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadData();
        } catch (error) {
            this.showNotification("Error initializing application: " + error.message, "error");
            console.error(error);
        }
    }

    async loadData() {
        try {
            const [bookmarks, folders] = await Promise.all([
                this.dataProvider.getBookmarks(),
                this.dataProvider.getFolders(),
            ]);

            // Update search engine
            this.searchEngine.setData(bookmarks, folders);

            // Render UI
            this.renderFolders(folders);
            await this.renderBookmarks(bookmarks);
        } catch (error) {
            this.showNotification("Error loading data: " + error.message, "error");
            console.error(error);
        }
    }

    showLogin() {
        document.getElementById("login-screen").style.display = "block";
        document.getElementById("main-app").style.display = "none";
    }

    showMainApp() {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "block";

        // Update user email display
        this.authProvider.getCurrentUser().then((email) => {
            if (email) {
                document.getElementById("user-email").textContent = email;
            }
        });
    }

    setupEventListeners() {
        // Login
        document.getElementById("login-btn").addEventListener("click", async () => {
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            if (!email) {
                this.showNotification("Please enter your email", "error");
                return;
            }

            try {
                await this.authProvider.login(email, password);
                this.showMainApp();
                await this.loadData();
                this.showNotification("Login successful!", "success");
            } catch (error) {
                this.showNotification("Login failed: " + error.message, "error");
            }
        });

        // Logout
        document.getElementById("user-email-btn").addEventListener("click", async () => {
            if (confirm("Are you sure you want to logout?")) {
                await this.authProvider.logout();
                this.showLogin();
                this.showNotification("You have been logged out", "success");
            }
        });

        // Add bookmark
        document.getElementById("add-bookmark-btn").addEventListener("click", () => {
            this.editingBookmark = null;
            document.getElementById("bookmark-modal-title").textContent = "Add New Bookmark";
            this.showBookmarkModal();
        });

        // Save bookmark
        document.getElementById("save-bookmark").addEventListener("click", async () => {
            await this.saveBookmark();
        });

        // Add folder
        document.getElementById("add-folder-btn").addEventListener("click", () => {
            this.editingFolder = null;
            document.getElementById("folder-modal-title").textContent = "Create New Folder";
            this.showFolderModal();
        });

        // Save folder
        document.getElementById("save-folder").addEventListener("click", async () => {
            await this.saveFolder();
        });

        // Search
        document.getElementById("search-input").addEventListener("input", async (e) => {
            const query = e.target.value;
            await this.performSearch(query);
        });

        // Tag input
        document.getElementById("tag-input").addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.addTag();
            }
        });

        // URL input - Enter key handler for quick save
        document.getElementById("bookmark-url").addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                await this.saveBookmark();
            }
        });

        // Modal close handlers
        document.getElementById("close-modal").addEventListener("click", () => {
            this.hideModal("add-bookmark-modal");
        });

        document.getElementById("cancel-modal").addEventListener("click", () => {
            this.hideModal("add-bookmark-modal");
        });

        document.getElementById("close-folder-modal").addEventListener("click", () => {
            this.hideModal("add-folder-modal");
        });

        document.getElementById("cancel-folder-modal").addEventListener("click", () => {
            this.hideModal("add-folder-modal");
        });

        // View toggle handlers
        document.getElementById("card-view-btn").addEventListener("click", () => {
            this.setViewMode("card");
        });

        document.getElementById("table-view-btn").addEventListener("click", () => {
            this.setViewMode("table");
        });

        // Theme toggle
        document.getElementById("theme-toggle").addEventListener("click", () => {
            this.toggleTheme();
        });

        // Clustering toggle
        document.getElementById("clustering-toggle").addEventListener("click", () => {
            this.toggleClustering();
        });

        // Reset clustering (for development/testing)
        document.getElementById("reset-clustering").addEventListener("click", async () => {
            if (confirm("⚠️ This will delete ALL AI clustering data and folders. Are you sure?")) {
                await this.resetClustering();
            }
        });

        // About button
        document.getElementById("about-btn").addEventListener("click", () => {
            this.showModal("about-modal");
        });

        // Close about modal
        document.getElementById("close-about-modal").addEventListener("click", () => {
            this.hideModal("about-modal");
        });
    }

    initTheme() {
        // Get saved theme or default to dark
        const savedTheme = localStorage.getItem("theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.getElementById("theme-icon");
        if (icon) {
            icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
        }
    }

    toggleClustering() {
        this.useAutoClustering = !this.useAutoClustering;
        localStorage.setItem("useAutoClustering", this.useAutoClustering.toString());
        this.updateClusteringIcon();

        const status = this.useAutoClustering ? "enabled" : "disabled";
        this.showNotification(`🤖 AI clustering ${status}`, this.useAutoClustering ? "success" : "info");

        // Show clustering stats if enabled
        if (this.useAutoClustering && this.clusteringEngine) {
            const stats = this.clusteringEngine.getStats();
            setTimeout(() => {
                this.showNotification(`📁 ${stats.totalFolders} AI folders, ${stats.totalUrls} organized URLs`, "info");
            }, 2000);
        }
    }

    updateClusteringIcon() {
        const button = document.getElementById("clustering-toggle");
        const icon = document.getElementById("clustering-icon");
        const resetButton = document.getElementById("reset-clustering");

        if (button && icon) {
            if (this.useAutoClustering) {
                button.classList.remove("btn-outline");
                button.classList.add("btn-primary");
                button.title = "AI auto-clustering enabled - Click to disable";
                icon.className = "fas fa-robot";
                
                // Show reset button when clustering is enabled (for development)
                if (resetButton) {
                    resetButton.style.display = "inline-flex";
                }
            } else {
                button.classList.remove("btn-primary");
                button.classList.add("btn-outline");
                button.title = "AI auto-clustering disabled - Click to enable";
                icon.className = "far fa-robot";
                
                // Hide reset button when clustering is disabled
                if (resetButton) {
                    resetButton.style.display = "none";
                }
            }
        }
    }

    initClustering() {
        // Get saved clustering preference or default to enabled
        const savedClustering = localStorage.getItem("useAutoClustering");
        this.useAutoClustering = savedClustering !== null ? savedClustering === "true" : true;
        this.updateClusteringIcon();
    }

    async resetClustering() {
        try {
            this.showNotification("🧹 Clearing AI clustering data...", "info");
            
            // Reset the clustering engine
            await this.clusteringEngine.reset();
            
            // Delete any auto-generated cluster folders from database
            const folders = await this.dataProvider.getFolders();
            const clusterFolders = folders.filter(f => f.isAutoGenerated || f.clusterId);
            
            for (const folder of clusterFolders) {
                // Move bookmarks from cluster folders back to root
                const bookmarks = await this.dataProvider.getBookmarks(folder.id);
                for (const bookmark of bookmarks) {
                    bookmark.folderId = null; // Move to root
                    bookmark.clustered = false;
                    bookmark.clusterInfo = null;
                    await this.dataProvider.saveBookmark(bookmark);
                }
                
                // Delete the cluster folder
                await this.dataProvider.deleteFolder(folder.id);
            }
            
            // Reload the UI
            await this.loadData();
            
            this.showNotification("✅ AI clustering data cleared successfully!", "success");
            console.log("🧹 Clustering reset complete - ready for cold start");
            
        } catch (error) {
            console.error("Error resetting clustering:", error);
            this.showNotification("❌ Failed to reset clustering data", "error");
        }
    }

    async fetchMetadataForBookmark(bookmark) {
        if (!bookmark.url) return;

        try {
            // Update status to processing
            this.metadataStatus.set(bookmark.id, "processing");
            this.updateBookmarkMetadataStatus(bookmark.id, "processing");

            // Fetch metadata
            const metadata = await this.metadataFetcher.fetchMetadata(bookmark.url);

            if (metadata) {
                // Update bookmark with metadata in database
                const updatedBookmark = {
                    ...bookmark,
                    metadata: metadata,
                    metadataFetched: true,
                    metadataFetchedAt: new Date(),
                };

                await this.dataProvider.saveBookmark(updatedBookmark);

                // Update search index
                await this.loadData();

                // Update UI status
                this.metadataStatus.set(bookmark.id, "completed");
                this.updateBookmarkMetadataStatus(bookmark.id, "completed");

                // Quietly update - no notification spam
            } else {
                throw new Error("No metadata returned");
            }
        } catch (error) {
            console.error("Error fetching metadata:", error);
            this.metadataStatus.set(bookmark.id, "error");
            this.updateBookmarkMetadataStatus(bookmark.id, "error");
            // Silently fail for automatic fetching
        }
    }

    updateBookmarkMetadataStatus(bookmarkId, status) {
        // Update the UI to show metadata fetch status
        const bookmarkCards = document.querySelectorAll(`[data-bookmark-id="${bookmarkId}"]`);
        bookmarkCards.forEach((card) => {
            const statusIndicator = card.querySelector(".metadata-status");
            if (statusIndicator) {
                statusIndicator.className = `metadata-status ${status}`;

                switch (status) {
                    case "queued":
                        statusIndicator.innerHTML = '<i class="fas fa-clock"></i>';
                        statusIndicator.title = "Metadata queued for fetching";
                        break;
                    case "processing":
                        statusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        statusIndicator.title = "Fetching metadata...";
                        break;
                    case "completed":
                        statusIndicator.innerHTML = '<i class="fas fa-check"></i>';
                        statusIndicator.title = "Metadata fetched successfully";
                        break;
                    case "error":
                        statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                        statusIndicator.title = "Failed to fetch metadata";
                        break;
                }
            }
        });
    }

    async refreshMetadataForBookmark(bookmarkId) {
        try {
            const bookmark = await this.dataProvider.getBookmark(bookmarkId);
            if (bookmark && bookmark.url) {
                this.showNotification("Refreshing metadata...", "info");
                await this.fetchMetadataForBookmark(bookmark);
            }
        } catch (error) {
            console.error("Error refreshing metadata:", error);
            this.showNotification("Failed to refresh metadata", "error");
        }
    }

    async saveBookmark() {
        let title = document.getElementById("bookmark-title").value;
        let url = document.getElementById("bookmark-url").value;
        let description = document.getElementById("bookmark-desc").value;
        let folderId = document.getElementById("bookmark-folder").value;

        if (!url) {
            this.showNotification("URL is required", "error");
            return;
        }

        // Use URL as title if title is empty
        let finalTitle = title || new URL(url).hostname || url;

        try {
            let finalFolderId = folderId === "root" ? null : folderId;
            let clusterInfo = null;
            let fetchedMetadata = null; // Store metadata for later use

            // Use automatic clustering for new bookmarks if enabled and no manual folder selected
            if (this.useAutoClustering && !this.editingBookmark && finalFolderId === null) {
                this.showNotification("🤖 Fetching content for AI organization...", "info");

                // First, fetch metadata to get rich content for clustering
                let bookmarkWithMetadata = {
                    title: finalTitle,
                    url,
                    description,
                    tags: this.tags,
                };

                try {
                    // Fetch metadata first for better clustering
                    const metadata = await this.metadataFetcher.fetchMetadata(url);
                    if (metadata) {
                        fetchedMetadata = metadata; // Store for later use
                        bookmarkWithMetadata.metadata = metadata;
                        // Update title if we got a better one from metadata
                        if (metadata.title && metadata.title.length > finalTitle.length) {
                            bookmarkWithMetadata.title = metadata.title;
                            finalTitle = metadata.title;
                        }
                        // Add description from metadata if we don't have one
                        if (!description && metadata.description) {
                            bookmarkWithMetadata.description = metadata.description;
                            description = metadata.description;
                        }
                    }
                } catch (metadataError) {
                    console.warn("Metadata fetch failed, clustering with basic data:", metadataError);
                    // Continue with clustering even if metadata fails
                }

                this.showNotification("🤖 AI is organizing your bookmark...", "info");

                // Now cluster with rich metadata
                clusterInfo = await this.clusteringEngine.addBookmark(bookmarkWithMetadata);

                if (clusterInfo && clusterInfo.folderId) {
                    // Create or get the folder in our regular folder system
                    finalFolderId = await this.ensureClusterFolder(clusterInfo);
                }
            }

            const bookmark = {
                id: this.editingBookmark?.id || null,
                title: finalTitle,
                url,
                description,
                folderId: finalFolderId,
                tags: this.tags,
                metadata: fetchedMetadata || undefined, // Include metadata if fetched during clustering
                createdAt: this.editingBookmark?.createdAt || new Date(),
                metadataFetched: clusterInfo ? true : false, // Already fetched if clustered
                clustered: clusterInfo ? true : false,
                clusterInfo: clusterInfo,
            };

            const savedBookmark = await this.dataProvider.saveBookmark(bookmark);
            await this.loadData();
            this.hideModal("add-bookmark-modal");

            let message = this.editingBookmark ? "Bookmark updated successfully!" : "Bookmark added successfully!";
            if (clusterInfo && clusterInfo.isNewFolder) {
                message += ` 📁 Created new folder: "${clusterInfo.folderLabel}"`;
            } else if (clusterInfo) {
                message += ` 📁 Added to: "${clusterInfo.folderLabel}"`;
            }
            this.showNotification(message, "success");

            // Fetch metadata for new bookmarks only if not already fetched during clustering
            if (!this.editingBookmark && !clusterInfo) {
                this.fetchMetadataForBookmark(savedBookmark);
            }

            // Reset tags
            this.tags = [];
        } catch (error) {
            this.showNotification("Error saving bookmark: " + error.message, "error");
            console.error(error);
        }
    }

    /**
     * Ensure a cluster folder exists in the regular folder system
     * Maps clustering engine folders to our database folders
     */
    async ensureClusterFolder(clusterInfo) {
        try {
            // Check if folder already exists in our system
            const folders = await this.dataProvider.getFolders();
            
            // First check by clusterId, then by name for auto-generated folders
            let existingFolder = folders.find((f) => f.clusterId === clusterInfo.folderId);
            
            if (!existingFolder) {
                // Check if we already have an auto-generated folder with the same name
                existingFolder = folders.find((f) => 
                    f.isAutoGenerated && 
                    f.name === clusterInfo.folderLabel
                );
                
                if (existingFolder) {
                    // Update the existing folder's clusterId to match the new cluster
                    existingFolder.clusterId = clusterInfo.folderId;
                    await this.dataProvider.saveFolder(existingFolder);
                    console.log(`📁 Reusing existing folder: ${existingFolder.name} (updated clusterId)`);
                }
            }

            if (existingFolder) {
                return existingFolder.id;
            }

            // Create new folder in our system
            const folder = {
                id: null, // Will be auto-generated
                name: clusterInfo.folderLabel,
                parentId: null, // Cluster folders go to root for now
                clusterId: clusterInfo.folderId, // Link to clustering engine
                isAutoGenerated: true,
            };

            const savedFolder = await this.dataProvider.saveFolder(folder);
            console.log(`📁 Created cluster folder: ${folder.name} (${savedFolder.id})`);

            return savedFolder.id;
        } catch (error) {
            console.error("Error ensuring cluster folder:", error);
            return null;
        }
    }

    async saveFolder() {
        const name = document.getElementById("folder-name").value;
        const parentId = document.getElementById("parent-folder").value;

        if (!name) {
            this.showNotification("Folder name is required", "error");
            return;
        }

        try {
            const folder = {
                id: this.editingFolder?.id || null,
                name,
                parentId: parentId === "root" ? null : parentId,
            };

            await this.dataProvider.saveFolder(folder);
            await this.loadData();
            this.hideModal("add-folder-modal");

            const message = this.editingFolder ? "Folder updated successfully!" : "Folder created successfully!";
            this.showNotification(message, "success");
        } catch (error) {
            this.showNotification("Error saving folder: " + error.message, "error");
            console.error(error);
        }
    }

    async deleteBookmark(id) {
        if (confirm("Are you sure you want to delete this bookmark?")) {
            try {
                await this.dataProvider.deleteBookmark(id);
                await this.loadData();
                this.showNotification("Bookmark deleted successfully!", "success");
            } catch (error) {
                this.showNotification("Error deleting bookmark: " + error.message, "error");
                console.error(error);
            }
        }
    }

    async deleteFolder(id) {
        if (
            confirm("Are you sure you want to delete this folder? All bookmarks in this folder will be moved to root.")
        ) {
            try {
                // First, move all bookmarks in this folder to root
                const bookmarks = await this.dataProvider.getBookmarks();
                const folderBookmarks = bookmarks.filter((b) => b.folderId === id);

                for (const bookmark of folderBookmarks) {
                    bookmark.folderId = null;
                    await this.dataProvider.saveBookmark(bookmark);
                }

                // Then delete the folder
                await this.dataProvider.deleteFolder(id);
                await this.loadData();
                this.showNotification("Folder deleted successfully!", "success");
            } catch (error) {
                this.showNotification("Error deleting folder: " + error.message, "error");
                console.error(error);
            }
        }
    }

    showBookmarkModal(bookmark = null) {
        this.editingBookmark = bookmark;
        this.tags = bookmark?.tags || [];

        // Set form values
        if (bookmark) {
            document.getElementById("bookmark-title").value = bookmark.title;
            document.getElementById("bookmark-url").value = bookmark.url;
            document.getElementById("bookmark-desc").value = bookmark.description || "";
            document.getElementById("bookmark-folder").value = bookmark.folderId || "root";
        } else {
            document.getElementById("bookmark-title").value = "";
            document.getElementById("bookmark-url").value = "";
            document.getElementById("bookmark-desc").value = "";
            document.getElementById("bookmark-folder").value =
                this.currentFolder === "root" ? "root" : this.currentFolder;
        }

        // Render tags
        this.renderTags();

        this.showModal("add-bookmark-modal");
    }

    showFolderModal(folder = null) {
        this.editingFolder = folder;

        // Set form values
        if (folder) {
            document.getElementById("folder-name").value = folder.name;
            document.getElementById("parent-folder").value = folder.parentId || "root";
        } else {
            document.getElementById("folder-name").value = "";
            document.getElementById("parent-folder").value = "root";
        }

        this.showModal("add-folder-modal");
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add("active");

        // Focus on URL field when bookmark modal opens
        if (modalId === "add-bookmark-modal") {
            setTimeout(() => {
                document.getElementById("bookmark-url").focus();
            }, 100);
        }
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove("active");
    }

    addTag() {
        const tagInput = document.getElementById("tag-input");
        const tag = tagInput.value.trim();

        if (tag && !this.tags.includes(tag)) {
            this.tags.push(tag);
            this.renderTags();
            tagInput.value = "";
        }
    }

    removeTag(tag) {
        this.tags = this.tags.filter((t) => t !== tag);
        this.renderTags();
    }

    renderTags() {
        const tagsList = document.getElementById("tags-list");
        tagsList.innerHTML = "";

        this.tags.forEach((tag) => {
            const tagEl = document.createElement("div");
            tagEl.className = "tag";
            tagEl.innerHTML = `
                        ${tag}
                        <i class="fas fa-times" data-tag="${tag}"></i>
                    `;
            tagsList.appendChild(tagEl);

            // Add event listener to remove button
            tagEl.querySelector("i").addEventListener("click", () => {
                this.removeTag(tag);
            });
        });
    }

    async performSearch(query) {
        const searchResults = document.getElementById("search-results");

        if (!query) {
            // If no query, show all bookmarks in current folder
            const bookmarks = await this.dataProvider.getBookmarks(
                this.currentFolder === "root" ? null : this.currentFolder
            );
            await this.renderBookmarks(bookmarks);
            searchResults.innerHTML = `Showing ${bookmarks.length} bookmarks`;
            return;
        }

        try {
            const results = await this.searchEngine.search(query);
            const bookmarks = results.filter((r) => r.type === "bookmark").map((r) => r.item);
            const folders = results.filter((r) => r.type === "folder").map((r) => r.item);

            // Render search results
            await this.renderBookmarks(bookmarks);
            searchResults.innerHTML = `Found ${results.length} results for "${query}"`;
        } catch (error) {
            console.error("Search error:", error);
            searchResults.innerHTML = `Error performing search`;
        }
    }

    renderFolders(folders) {
        const container = document.getElementById("folders-container");
        container.innerHTML = "";

        // Add "All Bookmarks" folder
        const rootFolder = document.createElement("div");
        rootFolder.className = `folder ${this.currentFolder === "root" ? "active" : ""}`;
        rootFolder.dataset.id = "root";
        rootFolder.innerHTML = `
                    <i class="fas fa-folder-open"></i>
                    <div class="folder-name">All Bookmarks</div>
                `;
        container.appendChild(rootFolder);

        rootFolder.addEventListener("click", () => {
            this.currentFolder = "root";
            this.updateFolderSelection();
            this.updateBreadcrumbs();
            this.loadFolderContent();
        });

        // Helper function to render nested folders
        const renderFolderTree = (parentId, level) => {
            const children = folders.filter((f) => f.parentId === parentId);

            children.forEach((folder) => {
                const folderEl = document.createElement("div");
                folderEl.className = `folder ${this.currentFolder === folder.id ? "active" : ""} ${
                    level > 0 ? "nested" : ""
                }`;
                folderEl.dataset.id = folder.id;
                folderEl.innerHTML = `
                            <i class="fas fa-folder"></i>
                            <div class="folder-name">${folder.name}</div>
                            <div class="folder-actions">
                                <button class="action-btn edit-folder" data-id="${folder.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete-folder" data-id="${folder.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `;
                container.appendChild(folderEl);

                // Folder click handler
                folderEl.addEventListener("click", (e) => {
                    if (!e.target.closest(".folder-actions")) {
                        this.currentFolder = folder.id;
                        this.updateFolderSelection();
                        this.updateBreadcrumbs();
                        this.loadFolderContent();
                    }
                });

                // Edit button
                folderEl.querySelector(".edit-folder").addEventListener("click", (e) => {
                    e.stopPropagation();
                    const folderToEdit = folders.find((f) => f.id === folder.id);
                    if (folderToEdit) this.showFolderModal(folderToEdit);
                });

                // Delete button
                folderEl.querySelector(".delete-folder").addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.deleteFolder(folder.id);
                });

                // Render children
                renderFolderTree(folder.id, level + 1);
            });
        };

        // Start rendering from root folders (with no parent)
        renderFolderTree(null, 0);

        // Populate folder dropdowns
        this.populateFolderDropdowns(folders);
    }

    updateFolderSelection() {
        // Remove active class from all folders
        document.querySelectorAll(".folder").forEach((folder) => {
            folder.classList.remove("active");
        });

        // Add active class to current folder
        const currentFolderEl = document.querySelector(`[data-id="${this.currentFolder}"]`);
        if (currentFolderEl && currentFolderEl.classList.contains("folder")) {
            currentFolderEl.classList.add("active");
        }
    }

    populateFolderDropdowns(folders) {
        const bookmarkFolder = document.getElementById("bookmark-folder");
        const parentFolder = document.getElementById("parent-folder");

        // Clear existing options except the first one
        while (bookmarkFolder.options.length > 1) bookmarkFolder.remove(1);
        while (parentFolder.options.length > 1) parentFolder.remove(1);

        // Add folders to dropdowns
        folders.forEach((folder) => {
            const option = document.createElement("option");
            option.value = folder.id;
            option.textContent = folder.name;

            bookmarkFolder.appendChild(option.cloneNode(true));
            parentFolder.appendChild(option.cloneNode(true));
        });
    }

    async loadFolderContent() {
        try {
            const bookmarks = await this.dataProvider.getBookmarks(
                this.currentFolder === "root" ? null : this.currentFolder
            );
            await this.renderBookmarks(bookmarks);
            document.getElementById("search-results").innerHTML = `Showing ${bookmarks.length} bookmarks`;
        } catch (error) {
            this.showNotification("Error loading folder content: " + error.message, "error");
            console.error(error);
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;

        // Update button states
        document.getElementById("card-view-btn").classList.toggle("active", mode === "card");
        document.getElementById("table-view-btn").classList.toggle("active", mode === "table");

        // Re-render bookmarks in new view
        this.loadFolderContent(this.currentFolder);
    }

    async renderBookmarks(bookmarks) {
        const container = document.getElementById("bookmarks-container");
        container.innerHTML = "";

        // Update container class based on view mode
        container.className = `bookmarks-container ${this.viewMode}-view`;

        const bookmarkCountElement = document.getElementById("bookmark-count");
        if (bookmarkCountElement) {
            bookmarkCountElement.textContent = bookmarks.length;
        }

        if (bookmarks.length === 0) {
            container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-bookmark"></i>
                            <h3>No Bookmarks Found</h3>
                            <p>Add your first bookmark by clicking the "Add Bookmark" button above</p>
                        </div>
                    `;
            return;
        }

        // Get folders for folder name lookup
        const folders = await this.dataProvider.getFolders();
        const folderMap = new Map(folders.map(f => [f.id, f]));

        if (this.viewMode === "table") {
            this.renderTableView(bookmarks, folderMap);
        } else {
            this.renderCardView(bookmarks, folderMap);
        }
    }

    renderCardView(bookmarks, folderMap) {
        const container = document.getElementById("bookmarks-container");

        bookmarks.forEach((bookmark) => {
            const metadata = bookmark.metadata || {};
            const domain = new URL(bookmark.url).hostname;
            // const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
            const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
            const ogImage = metadata.ogImage;
            const description = metadata.description || bookmark.description || "";
            const siteName = metadata.ogSiteName || new URL(bookmark.url).hostname;
            
            // Get folder name
            const folder = bookmark.folderId ? folderMap.get(bookmark.folderId) : null;
            const folderName = folder ? folder.name : "All Bookmarks";

            const card = document.createElement("div");
            card.className = "bookmark-card";
            card.dataset.bookmarkId = bookmark.id;

            card.innerHTML = `
                <div class="bookmark-header">
                    <div class="bookmark-favicon">
                        <img src="${favicon}" alt="" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjQ0NDIiByeD0iMiIvPgo8L3N2Zz4K'">
                    </div>
                    <div class="bookmark-info">
                        <div class="bookmark-title">${bookmark.title}</div>
                        <div class="bookmark-site">${siteName}</div>
                        <div class="bookmark-folder">📁 ${folderName}</div>
                        <a href="${bookmark.url}" target="_blank" class="bookmark-url">${bookmark.url}</a>
                    </div>
                    <div class="metadata-status ${
                        this.metadataStatus.get(bookmark.id) || (bookmark.metadataFetched ? "completed" : "pending")
                    }">
                        ${this.getMetadataStatusIcon(bookmark)}
                    </div>
                    <div class="bookmark-actions">
                        <button class="action-btn refresh-metadata" data-id="${bookmark.id}" title="Refresh metadata">
                            <i class="fas fa-sync"></i>
                        </button>
                        <button class="action-btn edit-bookmark" data-id="${bookmark.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-bookmark" data-id="${bookmark.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${ogImage ? `<div class="bookmark-image"><img src="${ogImage}" alt="" loading="lazy"></div>` : ""}
                ${description ? `<div class="bookmark-desc">${description}</div>` : ""}
                ${
                    bookmark.tags && bookmark.tags.length > 0
                        ? `
                    <div class="bookmark-tags">
                        ${bookmark.tags.map((tag) => `<div class="tag">${tag}</div>`).join("")}
                    </div>
                `
                        : ""
                }
                ${
                    metadata.keywords && metadata.keywords.length > 0
                        ? `
                    <div class="bookmark-keywords">
                        ${metadata.keywords
                            .slice(0, 5)
                            .map((keyword) => `<span class="keyword">${keyword}</span>`)
                            .join("")}
                    </div>
                `
                        : ""
                }
            `;
            container.appendChild(card);

            // Refresh metadata button
            card.querySelector(".refresh-metadata").addEventListener("click", (e) => {
                e.stopPropagation();
                this.refreshMetadataForBookmark(bookmark.id);
            });

            // Edit button
            card.querySelector(".edit-bookmark").addEventListener("click", () => {
                this.showBookmarkModal(bookmark);
            });

            // Delete button
            card.querySelector(".delete-bookmark").addEventListener("click", () => {
                this.deleteBookmark(bookmark.id);
            });
        });
    }

    getMetadataStatusIcon(bookmark) {
        const status = this.metadataStatus.get(bookmark.id);
        if (status === "queued") return '<i class="fas fa-clock"></i>';
        if (status === "processing") return '<i class="fas fa-spinner fa-spin"></i>';
        if (status === "error") return '<i class="fas fa-exclamation-triangle"></i>';
        if (bookmark.metadataFetched) return '<i class="fas fa-check"></i>';
        return '<i class="fas fa-clock"></i>';
    }

    renderTableView(bookmarks, folderMap) {
        const container = document.getElementById("bookmarks-container");

        // Create compact list view (like Gmail/Finder)
        const listView = document.createElement("div");
        listView.className = "bookmarks-list";

        bookmarks.forEach((bookmark) => {
            const metadata = bookmark.metadata || {};
            const domain = new URL(bookmark.url).hostname;
            // const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
            const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
            const description = metadata.description || bookmark.description || "";
            
            // Get folder name
            const folder = bookmark.folderId ? folderMap.get(bookmark.folderId) : null;
            const folderName = folder ? folder.name : "All Bookmarks";

            // Combine tags and keywords
            const allTags = [];
            if (bookmark.tags && bookmark.tags.length > 0) {
                allTags.push(...bookmark.tags.map((tag) => ({ text: tag, type: "tag" })));
            }
            if (metadata.keywords && metadata.keywords.length > 0) {
                allTags.push(...metadata.keywords.slice(0, 4).map((keyword) => ({ text: keyword, type: "keyword" })));
            }

            const row = document.createElement("div");
            row.className = "bookmark-row";
            row.dataset.bookmarkId = bookmark.id;

            row.innerHTML = `
                <div class="row-main">
                    <div class="row-left">
                        <img src="${favicon}" alt="" class="row-favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjQ0NDIiByeD0iMiIvPgo8L3N2Zz4K'">
                        <div class="row-content">
                            <div class="row-header">
                                <span class="row-title">${bookmark.title}</span>
                                <span class="row-domain">${domain}</span>
                                <span class="row-folder">📁 ${folderName}</span>
                                <div class="row-status">
                                    <div class="metadata-status ${
                                        this.metadataStatus.get(bookmark.id) ||
                                        (bookmark.metadataFetched ? "completed" : "pending")
                                    }">
                                        ${this.getMetadataStatusIcon(bookmark)}
                                    </div>
                                </div>
                            </div>
                            <div class="row-meta">
                                ${description ? `<span class="row-desc">${description.substring(0, 120)}</span>` : ""}
                                <a href="${bookmark.url}" target="_blank" class="row-url" title="${bookmark.url}">${
                bookmark.url
            }</a>
                            </div>
                            ${
                                allTags.length > 0
                                    ? `
                                <div class="row-tags">
                                    ${allTags
                                        .map((item) => `<span class="mini-${item.type}">${item.text}</span>`)
                                        .join("")}
                                </div>
                            `
                                    : ""
                            }
                        </div>
                    </div>
                    <div class="row-actions">
                        <button class="action-btn refresh-metadata" data-id="${bookmark.id}" title="Refresh metadata">
                            <i class="fas fa-sync"></i>
                        </button>
                        <button class="action-btn edit-bookmark" data-id="${bookmark.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-bookmark" data-id="${bookmark.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            listView.appendChild(row);

            // Refresh metadata button
            row.querySelector(".refresh-metadata").addEventListener("click", (e) => {
                e.stopPropagation();
                this.refreshMetadataForBookmark(bookmark.id);
            });

            // Edit button
            row.querySelector(".edit-bookmark").addEventListener("click", () => {
                this.showBookmarkModal(bookmark);
            });

            // Delete button
            row.querySelector(".delete-bookmark").addEventListener("click", () => {
                this.deleteBookmark(bookmark.id);
            });
        });

        container.appendChild(listView);
    }

    updateBreadcrumbs() {
        // This would be implemented with folder hierarchy in a real app
        const breadcrumbs = document.getElementById("breadcrumbs");
        breadcrumbs.innerHTML = `
                    <div class="breadcrumb">
                        <a href="#" data-id="root">All Bookmarks</a>
                        <i class="fas fa-chevron-right" style="font-size: 12px;"></i>
                    </div>
                `;

        // Click handler for root
        breadcrumbs.querySelector("a").addEventListener("click", (e) => {
            e.preventDefault();
            this.currentFolder = "root";
            this.updateFolderSelection();
            this.updateBreadcrumbs();
            this.loadFolderContent();
        });
    }

    showNotification(message, type = "info") {
        const notification = document.getElementById("notification");
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove("show");
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    const app = new AIChatOrganizer();
    app.init();
});
