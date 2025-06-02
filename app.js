
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
    }

    async init() {
        try {
            // Initialize database
            await this.dataProvider.init();

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
            this.renderBookmarks(bookmarks);
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
    }

    async saveBookmark() {
        const title = document.getElementById("bookmark-title").value;
        const url = document.getElementById("bookmark-url").value;
        const description = document.getElementById("bookmark-desc").value;
        const folderId = document.getElementById("bookmark-folder").value;

        if (!url) {
            this.showNotification("URL is required", "error");
            return;
        }
        
        // Use URL as title if title is empty
        const finalTitle = title || new URL(url).hostname || url;

        try {
            const bookmark = {
                id: this.editingBookmark?.id || null,
                title: finalTitle,
                url,
                description,
                folderId: folderId === "root" ? null : folderId,
                tags: this.tags,
                createdAt: this.editingBookmark?.createdAt || new Date(),
            };

            await this.dataProvider.saveBookmark(bookmark);
            await this.loadData();
            this.hideModal("add-bookmark-modal");

            const message = this.editingBookmark ? "Bookmark updated successfully!" : "Bookmark added successfully!";
            this.showNotification(message, "success");

            // Reset tags
            this.tags = [];
        } catch (error) {
            this.showNotification("Error saving bookmark: " + error.message, "error");
            console.error(error);
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
            this.renderBookmarks(bookmarks);
            searchResults.innerHTML = `Showing ${bookmarks.length} bookmarks`;
            return;
        }

        try {
            const results = await this.searchEngine.search(query);
            const bookmarks = results.filter((r) => r.type === "bookmark").map((r) => r.item);
            const folders = results.filter((r) => r.type === "folder").map((r) => r.item);

            // Render search results
            this.renderBookmarks(bookmarks);
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
            this.renderBookmarks(bookmarks);
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

    renderBookmarks(bookmarks) {
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
        
        if (this.viewMode === "table") {
            this.renderTableView(bookmarks);
        } else {
            this.renderCardView(bookmarks);
        }
    }
    
    renderCardView(bookmarks) {
        const container = document.getElementById("bookmarks-container");
        
        bookmarks.forEach((bookmark) => {
            const card = document.createElement("div");
            card.className = "bookmark-card";
            card.innerHTML = `
                        <div class="bookmark-header">
                            <div style="flex: 1; min-width: 0;">
                                <div class="bookmark-title">${bookmark.title}</div>
                                <a href="${bookmark.url}" target="_blank" class="bookmark-url">${bookmark.url}</a>
                            </div>
                            <div class="bookmark-actions" style="flex-shrink: 0;">
                                <button class="action-btn edit-bookmark" data-id="${bookmark.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete-bookmark" data-id="${bookmark.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        ${bookmark.description ? `<div class="bookmark-desc">${bookmark.description}</div>` : ""}
                        ${
                            bookmark.tags && bookmark.tags.length > 0
                                ? `
                            <div class="bookmark-tags">
                                ${bookmark.tags.map((tag) => `<div class="tag">${tag}</div>`).join("")}
                            </div>
                        `
                                : ""
                        }
                    `;
            container.appendChild(card);

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
    
    renderTableView(bookmarks) {
        const container = document.getElementById("bookmarks-container");
        
        const table = document.createElement("table");
        table.className = "bookmarks-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Bookmark</th>
                    <th>Description</th>
                    <th>Tags</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector("tbody");
        
        bookmarks.forEach((bookmark) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="table-bookmark">
                    <a href="${bookmark.url}" target="_blank" class="bookmark-link" title="${bookmark.url}">
                        <div class="bookmark-title">${bookmark.title}</div>
                        <div class="bookmark-domain">${new URL(bookmark.url).hostname}</div>
                    </a>
                </td>
                <td class="table-desc" title="${bookmark.description || ''}">${bookmark.description || '-'}</td>
                <td class="table-tags">
                    ${bookmark.tags && bookmark.tags.length > 0 
                        ? bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
                        : '-'
                    }
                </td>
                <td class="table-actions">
                    <button class="action-btn edit-bookmark" data-id="${bookmark.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-bookmark" data-id="${bookmark.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
            
            // Edit button
            row.querySelector(".edit-bookmark").addEventListener("click", () => {
                this.showBookmarkModal(bookmark);
            });

            // Delete button
            row.querySelector(".delete-bookmark").addEventListener("click", () => {
                this.deleteBookmark(bookmark.id);
            });
        });
        
        container.appendChild(table);
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
