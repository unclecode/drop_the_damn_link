# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server with hot reload
npm run dev

# Production build with Terser minification
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages (automatic on push to main)
git push origin main
```

## Application Architecture

This is an AI-assisted bookmark manager called "Drop the Damn Link!" built with vanilla JavaScript ES6 modules and Vite. The application follows a modular architecture with clear separation of concerns.

### Core Components

**Main Controller (`AIChatOrganizer`)**: Orchestrates the entire application, managing state, user interactions, and coordinating between all subsystems. Handles view modes (card/table), folder navigation, and modal management.

**Data Layer (`strategies.js`)**: Uses Strategy Pattern with `IndexedDBProvider` for client-side persistent storage and `NaiveAuthProvider` for demo authentication. The IndexedDB schema includes bookmarks and folders with metadata support.

**Search Engine (`BM25Search`)**: Full-text search using BM25 algorithm with weighted fields (titles 3x, keywords/tags 2x). Indexes both bookmarks and folders for comprehensive search.

**Metadata Fetcher (`MetadataFetcher`)**: Multi-strategy content extraction using CORS proxy and Microlink API. Parses OpenGraph, Twitter Cards, JSON-LD, and extracts favicons for rich bookmark previews.

**Clustering Engine (`BookmarkClusteringEngine`)**: AI-powered automatic organization using TF-IDF vectorization and cosine similarity. Creates semantic folders based on content analysis without manual intervention.

### ES6 Module Structure

```
src/
├── index.html          # Main HTML with modal system
├── app.js              # Main controller (AIChatOrganizer)
├── strategies.js       # Data and auth providers
├── indexing.js         # BM25 search implementation  
├── metadata-fetcher.js # Web content extraction
├── clustering.js       # AI clustering engine with TF-IDF
└── styles.css          # Theme system with CSS custom properties
```

All modules export specific classes and are imported in `app.js`. No external dependencies - pure vanilla JavaScript.

### Data Flow

User interactions flow through `AIChatOrganizer` → `DataProvider` → IndexedDB, with search queries processed by `BM25Search` and metadata automatically fetched by `MetadataFetcher` for new bookmarks.

### UI System

**Dual View Modes**: Card view for rich visual presentation, table view for compact list format (Gmail/Finder style).

**Theme System**: Dark/light themes using CSS custom properties with localStorage persistence.

**Modal System**: Overlay-based forms and information displays with consistent styling.

### Build Configuration

Vite configuration uses `src/` as root with output to `dist/`. Base path set to `/drop_the_damn_link/` for GitHub Pages deployment. GitHub Actions workflow automatically builds and deploys on push to main branch.

### Metadata Integration

The application automatically fetches rich metadata for URLs including titles, descriptions, images, keywords, and favicons. This metadata is indexed for search and displayed in both view modes. The system uses fallback strategies for reliability and includes platform detection for enhanced content classification.

### Automatic Clustering System

**Philosophy**: "Drop the damn link, let AI organize it!" - URLs are automatically organized into semantic folders using TF-IDF vectorization and cosine similarity. 

**Algorithm**: Metadata fetching first → rich text extraction (title, description, keywords) → TF-IDF vectorization → cosine similarity with existing folder centroids → intelligent placement or new folder creation. Folders auto-split when exceeding 50 items.

**User Control**: Clustering can be toggled on/off via the AI button in the header. Manual folder selection overrides clustering. Cluster folders are created in the regular folder system with `clusterId` linking.

### Key Development Notes

- All imports must include `.js` extensions for ES6 module compatibility
- Metadata processing includes status tracking (pending/processing/completed/error) with UI indicators
- Search implementation supports both bookmarks and folders with relevance scoring
- IndexedDB operations include proper error handling and schema versioning
- Theme switching affects all CSS custom properties for consistent theming