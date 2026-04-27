# GIAC Book Indexer

A web-based application for indexing terms from GIAC exam books. Manage entries with terms, book numbers, pages, categories, notes, highlights, and study progress. Supports bulk entry, import/export, search, sorting, filtering, dark mode, backup, and flashcard study mode.

## Features

- Add entries with term, book, page, book title, category, notes, highlight, and study status
- Bulk entry via pasted text
- Import from CSV, export to CSV/XLSX/DOCX/PDF
- Search across terms, notes, categories, and book titles
- Sort by term, book, or page (ascending/descending)
- Filter by category, study status, and highlight status
- Progress tracking with "studied" checkbox and statistics dashboard
- Dark mode toggle
- Undo delete with toast notification
- Backup and restore data as JSON
- Flashcard study mode with flip cards and progress marking
- Edit entries in place
- Duplicate detection
- Print-optimized 2-column layout
- **Multi-index management** - Create separate indexes for different study topics
- **Google Drive backup & sync** - Cloud backup and cross-device synchronization
- **Enhanced search & discovery** - Full-text search with field-specific queries and smart suggestions

## Google Drive Setup

To enable Google Drive backup and sync functionality:

### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it

### 2. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the OAuth consent screen if prompted
4. Select "Web application" as application type
5. Add authorized origins:
   - `http://localhost:5173` (for development)
   - Your production domain
6. Add authorized redirect URIs:
   - `http://localhost:5173` (for development)
   - Your production domain

### 3. Configure the Application
1. Copy your Client ID from the credentials
2. Open `src/utils.ts` and replace:
   ```typescript
   export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
   export const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY_HERE'; // Optional, for advanced features
   ```
3. For production deployment, you'll also need to:
   - Add your domain to authorized origins/redirect URIs
   - Configure CORS if needed
   - Consider using environment variables for credentials

### 4. Usage
- Click "Connect to Drive" in the import/export section
- Sign in with your Google account
- Use "Backup to Drive" to upload your current data
- Use "Sync with Drive" to merge local and cloud data
- Browse and restore from previous backups

**Note:** Backups are stored in your app's private Google Drive folder and are not visible in your regular Drive interface.
- Persistent storage using localStorage

## Advanced Search

The search feature supports both general full-text search and field-specific queries:

### Field-Specific Search
Use `field:value` syntax to search within specific fields:

- `term:keyword` - Search in terms only
- `category:network` or `cat:network` - Search categories
- `tag:aws` or `tags:aws` - Search tags
- `notes:important` or `note:important` - Search notes
- `booktitle:giac` or `book:giac` - Search book titles
- `booknum:1` or `bookno:1` - Search by book number
- `page:45` - Search by page number
- `studied:true` - Find studied entries
- `highlighted:true` - Find highlighted entries
- `favorite:true` - Find favorite entries

### Examples
- `tag:aws category:network` - AWS entries in network category
- `book:1 page:45` - Entries from book 1, page 45
- `studied:false tag:review` - Unstudied entries with review tag

### Discovery Hints
The discovery section below the search box shows clickable chips for categories, tags, and book titles found in your entries, making it easy to explore your content.

## Getting Started

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Open http://localhost:5173 in your browser

## Build

`npm run build`

## Technologies

- React, TypeScript, Vite
- Libraries: xlsx, papaparse, docx, jspdf, react-hot-toast
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
