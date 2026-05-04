import type { Entry, IndexMetadata, StudySession, StudySessionGoal, StudySessionResult, ReviewStatus } from './types';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';import {
  secureSetItem,
  secureGetItem,
  secureRemoveItem,
  sanitizeEntry,
  logAuditEvent,
  initializeEncryption,
  storeSecureToken,
  getSecureToken,
  clearSecureToken,
  generateUUID
} from './security';
// Google Drive API types
declare global {
  interface Window {
    gapi: any;
  }
}

// Fuzzy search scoring - returns 0 if no match, higher score = better match
export const fuzzyScore = (query: string, target: string): number => {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let score = 0;
  let qIdx = 0;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (q[qIdx] === t[tIdx]) {
      score += 1 + (qIdx === 0 ? 5 : 0); // Boost early matches
      qIdx++;
    }
  }

  return qIdx === q.length ? score : 0; // Must match entire query
};

const normalize = (text: string): string => text.trim().toLowerCase();

const scoreText = (query: string, target: string, boost = 1): number => {
  if (!target) return 0;
  const normalizedTarget = normalize(target);
  const normalizedQuery = normalize(query);
  let score = 0;

  if (normalizedTarget.includes(normalizedQuery)) {
    score += 10 * boost;
  }

  score += fuzzyScore(normalizedQuery, normalizedTarget) * boost;
  return score;
};

export const enhancedSearch = (entries: Entry[], query: string): Entry[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return entries;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const fieldQueries: { field: string; value: string }[] = [];
  const generalTokens: string[] = [];

  // Parse field-specific queries (field:value)
  queryTokens.forEach(token => {
    const colonIndex = token.indexOf(':');
    if (colonIndex > 0 && colonIndex < token.length - 1) {
      const field = token.substring(0, colonIndex).toLowerCase();
      const value = token.substring(colonIndex + 1);
      fieldQueries.push({ field, value });
    } else {
      generalTokens.push(token);
    }
  });

  return entries
    .map(entry => {
      let score = 0;
      const combinedText = [
        entry.term,
        entry.category,
        entry.notes,
        entry.bookTitle,
        entry.tags.join(' '),
        String(entry.book),
        String(entry.page)
      ].join(' ').toLowerCase();

      // Handle field-specific queries
      let fieldMatch = true;
      fieldQueries.forEach(({ field, value }) => {
        const normalizedValue = normalize(value);
        switch (field) {
          case 'term':
            if (!normalize(entry.term).includes(normalizedValue)) fieldMatch = false;
            score += scoreText(normalizedValue, entry.term, 12);
            break;
          case 'category':
          case 'cat':
            if (!normalize(entry.category).includes(normalizedValue)) fieldMatch = false;
            score += scoreText(normalizedValue, entry.category, 8);
            break;
          case 'notes':
          case 'note':
            if (!normalize(entry.notes).includes(normalizedValue)) fieldMatch = false;
            score += scoreText(normalizedValue, entry.notes, 6);
            break;
          case 'booktitle':
          case 'book':
            if (!normalize(entry.bookTitle).includes(normalizedValue)) fieldMatch = false;
            score += scoreText(normalizedValue, entry.bookTitle, 8);
            break;
          case 'tag':
          case 'tags':
            const tagMatch = entry.tags.some(tag => normalize(tag).includes(normalizedValue));
            if (!tagMatch) fieldMatch = false;
            score += scoreText(normalizedValue, entry.tags.join(' '), 10);
            break;
          case 'booknum':
          case 'bookno':
            if (entry.book.toString() !== normalizedValue) fieldMatch = false;
            score += 10;
            break;
          case 'page':
            if (entry.page.toString() !== normalizedValue) fieldMatch = false;
            score += 10;
            break;
          case 'studied':
            const studied = normalizedValue === 'true' || normalizedValue === 'yes';
            if (entry.studied !== studied) fieldMatch = false;
            score += 8;
            break;
          case 'highlighted':
          case 'highlight':
            const highlighted = normalizedValue === 'true' || normalizedValue === 'yes';
            if (entry.highlighted !== highlighted) fieldMatch = false;
            score += 8;
            break;
          case 'favorite':
          case 'fav':
            const favorite = normalizedValue === 'true' || normalizedValue === 'yes';
            if (entry.favorite !== favorite) fieldMatch = false;
            score += 8;
            break;
          default:
            // Unknown field, treat as general search
            if (!combinedText.includes(normalizedValue)) fieldMatch = false;
            score += scoreText(normalizedValue, combinedText, 4);
        }
      });

      if (!fieldMatch) return { entry, score: 0 };

      // Handle general tokens (full-text search)
      generalTokens.forEach(token => {
        score += scoreText(token, entry.term, 8);
        score += scoreText(token, entry.category, 4);
        score += scoreText(token, entry.bookTitle, 4);
        score += scoreText(token, entry.tags.join(' '), 6);
        score += scoreText(token, entry.notes, 2);
      });

      if (generalTokens.length > 0 && generalTokens.every(token => combinedText.includes(token))) {
        score += 6;
      }

      // Exact book/page matches get bonus points
      if (generalTokens.some(token => entry.book.toString() === token || entry.page.toString() === token)) {
        score += 10;
      }

      return { entry, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.entry);
};

export const getSearchDiscoveryHints = (entries: Entry[], query: string): string[] => {
  const normalizedQuery = normalize(query);
  const counts = new Map<string, number>();

  entries.forEach(entry => {
    if (entry.category) counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    if (entry.bookTitle) counts.set(entry.bookTitle, (counts.get(entry.bookTitle) || 0) + 1);
    entry.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
  });

  const uniqueValues = Array.from(counts.keys()).filter(Boolean);
  const filtered = normalizedQuery
    ? uniqueValues.filter(value => normalize(value).includes(normalizedQuery))
    : uniqueValues;

  return filtered
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
    .slice(0, 8);
};

// Sort entries by term alphabetically
const sortByTerm = (entries: Entry[]): Entry[] => {
  return entries.slice().sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
};

// Multi-index management functions
export const getAllIndexes = async (): Promise<IndexMetadata[]> => {
  const data = await secureGetItem('giac-indexes');
  return data || [];
};

export const saveAllIndexes = async (indexes: IndexMetadata[]) => {
  await secureSetItem('giac-indexes', indexes);
};

export const getCurrentIndexId = async (): Promise<string> => {
  const data = await secureGetItem('giac-current-index');
  return data || 'default';
};

export const setCurrentIndexId = async (indexId: string) => {
  await secureSetItem('giac-current-index', indexId);
};

export const createIndex = async (name: string): Promise<IndexMetadata> => {
  const indexes = await getAllIndexes();
  const newIndex: IndexMetadata = {
    id: generateUUID(),
    name,
    created: Date.now(),
    modified: Date.now(),
    entryCount: 0,
  };
  indexes.push(newIndex);
  await saveAllIndexes(indexes);
  await logAuditEvent('index_created', newIndex.id, { name });
  return newIndex;
};

export const deleteIndex = async (indexId: string) => {
  const indexes = await getAllIndexes();
  const filteredIndexes = indexes.filter(idx => idx.id !== indexId);
  await saveAllIndexes(filteredIndexes);

  // Clean up index data
  await secureRemoveItem(`giac-entries-${indexId}`);
  await secureRemoveItem(`giac-history-${indexId}`);
  await secureRemoveItem(`giac-backups-${indexId}`);
  await secureRemoveItem(`giac-study-sessions-${indexId}`);

  // If deleting current index, switch to first available or create default
  const currentId = await getCurrentIndexId();
  if (currentId === indexId) {
    if (filteredIndexes.length > 0) {
      await setCurrentIndexId(filteredIndexes[0]!.id);
    } else {
      const defaultIndex = await createIndex('My Study Index');
      await setCurrentIndexId(defaultIndex.id);
    }
  }

  await logAuditEvent('index_deleted', indexId);
};

export const updateIndexMetadata = async (indexId: string, updates: Partial<IndexMetadata>) => {
  const indexes = await getAllIndexes();
  const index = indexes.find(idx => idx.id === indexId);
  if (index) {
    Object.assign(index, updates, { modified: Date.now() });
    await saveAllIndexes(indexes);
  }
};

export const saveIndexEntries = async (indexId: string, entries: Entry[]) => {
  // Sanitize entries before saving
  const sanitizedEntries = entries.map(sanitizeEntry);
  await secureSetItem(`giac-entries-${indexId}`, sanitizedEntries);
  await updateIndexMetadata(indexId, { entryCount: entries.length });
  await logAuditEvent('entries_saved', indexId, { count: entries.length });
};

export const loadIndexEntries = async (indexId: string): Promise<Entry[]> => {
  const data = await secureGetItem(`giac-entries-${indexId}`);
  return data || [];
};

export const saveIndexHistory = async (indexId: string, entries: Entry[]) => {
  const history = await loadIndexHistory(indexId);
  history.push({ timestamp: Date.now(), entries: [...entries] });
  // Keep only last 50 snapshots
  if (history.length > 50) history.shift();
  await secureSetItem(`giac-history-${indexId}`, history);
};

export const loadIndexHistory = async (indexId: string): Promise<{ timestamp: number; entries: Entry[] }[]> => {
  const data = await secureGetItem(`giac-history-${indexId}`);
  return data || [];
};

export const autoBackupIndex = async (indexId: string, entries: Entry[]) => {
  const backups = await loadIndexBackups(indexId);
  backups.push({ timestamp: Date.now(), entries: [...entries] });
  // Keep only last 20 backups
  if (backups.length > 20) backups.shift();
  await secureSetItem(`giac-backups-${indexId}`, backups);
};

export const loadIndexBackups = async (indexId: string): Promise<{ timestamp: number; entries: Entry[] }[]> => {
  const data = await secureGetItem(`giac-backups-${indexId}`);
  return data || [];
};

export const verifyIndexBackups = async (indexId: string): Promise<{ total: number; latestTimestamp: number | null; validCount: number; errors: string[] }> => {
  const backups = await loadIndexBackups(indexId);
  const errors: string[] = [];

  backups.forEach((backup) => {
    if (!Array.isArray(backup.entries)) {
      errors.push(`Backup at ${new Date(backup.timestamp).toISOString()} is missing entries`);
      return;
    }

    backup.entries.forEach((entry, entryIndex) => {
      if (!entry || typeof entry !== 'object' || !('term' in entry) || !('book' in entry) || !('page' in entry)) {
        errors.push(`Invalid entry in backup ${new Date(backup.timestamp).toISOString()} at position ${entryIndex}`);
      }
    });
  });

  return {
    total: backups.length,
    latestTimestamp: backups.length > 0 ? backups[backups.length - 1]!.timestamp : null,
    validCount: backups.length - errors.length,
    errors
  };
};

export const cleanupIndexBackups = async (indexId: string, retentionDays: number): Promise<number> => {
  if (retentionDays <= 0) {
    return 0;
  }

  const backups = await loadIndexBackups(indexId);
  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const keptBackups = backups.filter(backup => backup.timestamp >= threshold);
  const deletedCount = backups.length - keptBackups.length;

  await secureSetItem(`giac-backups-${indexId}`, keptBackups);
  await logAuditEvent('backup_retention_pruned', indexId, { retentionDays, deletedCount });
  return deletedCount;
};

export const cleanupIndexHistory = async (indexId: string, retentionDays: number): Promise<number> => {
  if (retentionDays <= 0) {
    return 0;
  }

  const history = await loadIndexHistory(indexId);
  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const keptHistory = history.filter(snapshot => snapshot.timestamp >= threshold);
  const deletedCount = history.length - keptHistory.length;

  await secureSetItem(`giac-history-${indexId}`, keptHistory);
  await logAuditEvent('history_retention_pruned', indexId, { retentionDays, deletedCount });
  return deletedCount;
};

export const restoreFromIndexHistory = async (indexId: string, timestamp: number) => {
  const history = await loadIndexHistory(indexId);
  const snapshot = history.find(h => h.timestamp === timestamp);
  if (snapshot) {
    await saveIndexEntries(indexId, snapshot.entries);
    await saveIndexHistory(indexId, snapshot.entries);
    await logAuditEvent('history_restored', indexId, { timestamp });
    return snapshot.entries;
  }
  return null;
};

export const exportToXLSX = (entries: Entry[]) => {
  const sorted = sortByTerm(entries);
  const ws = XLSX.utils.json_to_sheet(sorted);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entries');
  XLSX.writeFile(wb, 'giac-index.xlsx');
};

export const exportToCSV = (entries: Entry[]) => {
  const sorted = sortByTerm(entries);
  const csv = Papa.unparse(sorted);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'giac-index.csv';
  a.click();
};

export const exportToDOCX = async (entries: Entry[]) => {
  const groupedEntries = entries
    .slice()
    .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }))
    .reduce<Record<string, Entry[]>>((acc, entry) => {
      const letter = entry.term.trim().charAt(0).toUpperCase() || '#';
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(entry);
      return acc;
    }, {});

  const children: (Paragraph | Table)[] = [];

  Object.keys(groupedEntries).sort().forEach(letter => {
    children.push(new Paragraph({ text: letter, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Term')] }),
          new TableCell({ children: [new Paragraph('Book')] }),
          new TableCell({ children: [new Paragraph('Page')] }),
          new TableCell({ children: [new Paragraph('Category')] }),
          new TableCell({ children: [new Paragraph('Notes')] }),
          new TableCell({ children: [new Paragraph('Highlighted')] }),
        ],
      }),
      ...groupedEntries[letter]!.map(entry => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(entry.term)] }),
          new TableCell({ children: [new Paragraph(entry.book.toString())] }),
          new TableCell({ children: [new Paragraph(entry.page.toString())] }),
          new TableCell({ children: [new Paragraph(entry.category)] }),
          new TableCell({ children: [new Paragraph(entry.notes)] }),
          new TableCell({ children: [new Paragraph(entry.highlighted ? 'Yes' : 'No')] }),
        ],
      })),
    ];

    children.push(new Table({ rows: tableRows }));
  });

  const doc = new Document({
    sections: [{
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'giac-index.docx';
  a.click();
};

export const exportToPDF = (entries: Entry[]) => {
  const sorted = sortByTerm(entries);
  const doc = new jsPDF();
  doc.text('GIAC Book Index', 10, 10);
  let y = 20;
  sorted.forEach(entry => {
    const text = `${entry.term} - Book ${entry.book}, Page ${entry.page}, Category: ${entry.category}, Notes: ${entry.notes}, Highlighted: ${entry.highlighted}`;
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 10, y);
    y += lines.length * 5;
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
  });
  doc.save('giac-index.pdf');
};

export const importFromCSV = (file: File, callback: (entries: Entry[]) => void) => {
  Papa.parse(file, {
    header: true,
    complete: (results: Papa.ParseResult<any>) => {
      const entries: Entry[] = (results.data as any[]).map((row) => {
        const entry = {
          id: generateUUID(),
          term: row.term || '',
          book: parseInt(row.book) || 0,
          page: parseInt(row.page) || 0,
          category: row.category || '',
          notes: row.notes || '',
          highlighted: row.highlighted === 'true' || row.highlighted === 'Yes',
          studied: row.studied === 'true' || row.studied === 'Yes',
          bookTitle: row.bookTitle || '',
          favorite: row.favorite === 'true' || row.favorite === 'Yes' || false,
          tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
          lastReviewed: row.lastReviewed ? parseInt(row.lastReviewed) : undefined,
        };
        return sanitizeEntry(entry);
      }).filter(e => e.term);
      callback(entries);
    },
  });
};

export const parseBulk = (text: string): Omit<Entry, 'id'>[] => {
  return text.split('\n').map(line => {
    const parts = line.split(',').map(s => s.trim());
    const entry = {
      term: parts[0] || '',
      book: parseInt(parts[1] ?? '') || 0,
      page: parseInt(parts[2] ?? '') || 0,
      category: '',
      notes: '',
      highlighted: false,
      studied: false,
      bookTitle: '',
      favorite: false,
      tags: [],
    };
    return sanitizeEntry(entry);
  }).filter(e => e.term);
};

// Spaced repetition: Calculate review status


export const getReviewStatus = (lastReviewed?: number): ReviewStatus => {
  if (!lastReviewed) return 'new';
  const daysSinceReview = (Date.now() - lastReviewed) / (1000 * 60 * 60 * 24);

  if (daysSinceReview > 7) return 'overdue';
  if (daysSinceReview > 3) return 'reviewing';
  return 'new';
};

export const calculateNextReviewDate = (daysSinceLastReview: number): number => {
  // Spaced repetition intervals: 1, 3, 7, 14, 30 days
  if (daysSinceLastReview < 1) return 1; // Review in 1 day
  if (daysSinceLastReview < 3) return 3;
  if (daysSinceLastReview < 7) return 7;
  if (daysSinceLastReview < 14) return 14;
  return 30;
};

// History tracking
export type HistoryEntry = {
  timestamp: number;
  entries: Entry[];
};

export const saveHistory = async (entries: Entry[]) => {
  const history = await loadHistory();
  history.push({ timestamp: Date.now(), entries: JSON.parse(JSON.stringify(entries)) });
  // Keep only last 50 snapshots
  if (history.length > 50) history.shift();
  await secureSetItem('giac-history', history);
};

export const loadHistory = async (): Promise<HistoryEntry[]> => {
  const data = await secureGetItem('giac-history');
  return data || [];
};

export const restoreFromHistory = async (timestamp: number): Promise<Entry[] | null> => {
  const history = await loadHistory();
  const snapshot = history.find(h => h.timestamp === timestamp);
  return snapshot ? snapshot.entries : null;
};

// Auto backup
export const autoBackup = async (entries: Entry[]) => {
  const backups: { timestamp: number; entries: Entry[] }[] = await loadBackups();
  backups.push({ timestamp: Date.now(), entries: JSON.parse(JSON.stringify(entries)) });
  // Keep only last 20 backups
  if (backups.length > 20) backups.shift();
  await secureSetItem('giac-backups', backups);
};

export const loadBackups = async (): Promise<{ timestamp: number; entries: Entry[] }[]> => {
  const data = await secureGetItem('giac-backups');
  return data || [];
};

// Export as text index
export const exportAsIndexText = (entries: Entry[]) => {
  const sorted = sortByTerm(entries);
  const grouped = sorted.reduce<Record<string, Entry[]>>((acc, entry) => {
    const letter = entry.term.trim().charAt(0).toUpperCase() || '#';
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(entry);
    return acc;
  }, {});

  let text = 'GIAC BOOK INDEX\n';
  text += '==================================================\n\n';

  Object.keys(grouped).sort().forEach(letter => {
    text += `\n${letter}\n`;
    text += '-'.repeat(40) + '\n';
    
    grouped[letter]!.forEach(entry => {
      text += `${entry.term}\n`;
      text += `  Book ${entry.book}, Page ${entry.page}\n`;
      if (entry.category) text += `  Category: ${entry.category}\n`;
      if (entry.notes) text += `  Notes: ${entry.notes}\n`;
      if (entry.tags.length > 0) text += `  Tags: ${entry.tags.join(', ')}\n`;
      text += '\n';
    });
  });

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'giac-index.txt';
  a.click();
};

// Google Drive Integration
const env = import.meta.env as Record<string, string | undefined>;
export const GOOGLE_CLIENT_ID = env['VITE_GOOGLE_CLIENT_ID'] || ''; // Set in .env.production
export const GOOGLE_API_KEY = env['VITE_GOOGLE_API_KEY'] || ''; // Set in .env.production

export const loadGoogleAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('auth2', () => {
        window.gapi.auth2.init({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file'
        }).then(() => {
          resolve();
        }).catch(reject);
      });
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export const signInToGoogle = async (): Promise<boolean> => {
  try {
    await loadGoogleAPI();
    const authInstance = window.gapi.auth2.getAuthInstance();
    const user = await authInstance.signIn();
    const isSignedIn = user.isSignedIn();

    if (isSignedIn) {
      // Store the access token securely
      const token = user.getAuthResponse().access_token;
      await storeSecureToken(token, 'google-drive');
      await logAuditEvent('google_signin', 'google-drive');
    }

    return isSignedIn;
  } catch (error) {
    console.error('Google sign-in failed:', error);
    return false;
  }
};

export const signOutFromGoogle = async (): Promise<void> => {
  try {
    const authInstance = window.gapi.auth2.getAuthInstance();
    await authInstance.signOut();
    await clearSecureToken('google-drive');
    await logAuditEvent('google_signout', 'google-drive');
  } catch (error) {
    console.error('Google sign-out failed:', error);
  }
};

export const isSignedInToGoogle = (): boolean => {
  try {
    const authInstance = window.gapi.auth2.getAuthInstance();
    return authInstance.isSignedIn.get();
  } catch {
    return false;
  }
};

export const uploadToGoogleDrive = async (data: any, filename: string): Promise<string | null> => {
  try {
    if (!isSignedInToGoogle()) {
      throw new Error('Not signed in to Google');
    }

    const fileContent = JSON.stringify(data, null, 2);
    const file = new Blob([fileContent], { type: 'application/json' });

    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: ['appDataFolder'] // Use appDataFolder for app-specific files
    };

    const token = await getSecureToken('google-drive');
    if (!token) {
      throw new Error('No stored Google Drive token');
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    await logAuditEvent('google_drive_upload', result.id, { filename });
    return result.id;
  } catch (error) {
    console.error('Google Drive upload failed:', error);
    return null;
  }
};

export const downloadFromGoogleDrive = async (fileId: string): Promise<any | null> => {
  try {
    if (!isSignedInToGoogle()) {
      throw new Error('Not signed in to Google');
    }

    const token = await getSecureToken('google-drive');
    if (!token) {
      throw new Error('No stored Google Drive token');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const data = await response.json();
    await logAuditEvent('google_drive_download', fileId);
    return data;
  } catch (error) {
    console.error('Google Drive download failed:', error);
    return null;
  }
};

export const listGoogleDriveFiles = async (filename?: string): Promise<any[]> => {
  try {
    if (!isSignedInToGoogle()) {
      throw new Error('Not signed in to Google');
    }

    const token = await getSecureToken('google-drive');
    if (!token) {
      throw new Error('No stored Google Drive token');
    }

    let query = `'appDataFolder' in parents and trashed = false`;
    if (filename) {
      query += ` and name = '${filename}'`;
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`List files failed: ${response.status}`);
    }

    const result = await response.json();
    return result.files || [];
  } catch (error) {
    console.error('Google Drive list files failed:', error);
    return [];
  }
};

export const backupToGoogleDrive = async (indexId: string, entries: Entry[]): Promise<boolean> => {
  const filename = `giac-index-${indexId}-backup-${new Date().toISOString().split('T')[0]}.json`;
  const data = {
    indexId,
    entries,
    timestamp: Date.now(),
    version: '1.0'
  };

    const fileId = await uploadToGoogleDrive(data, filename);
  return fileId !== null;
};

export const restoreFromGoogleDrive = async (fileId: string): Promise<{ entries: Entry[], indexId: string } | null> => {
  const data = await downloadFromGoogleDrive(fileId);
  if (data && data.entries && Array.isArray(data.entries)) {
    return {
      entries: data.entries,
      indexId: data.indexId || 'default'
    };
  }
  return null;
};

export const syncWithGoogleDrive = async (indexId: string, localEntries: Entry[]): Promise<{ success: boolean, action: string, remoteEntries?: Entry[] }> => {
  try {
    const filename = `giac-index-${indexId}-backup-${new Date().toISOString().split('T')[0]}.json`;
    const files = await listGoogleDriveFiles(filename);

    if (files.length === 0) {
      // No remote backup exists, upload local data
      const success = await backupToGoogleDrive(indexId, localEntries);
      return { success, action: 'uploaded' };
    }

    const latestFile = files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())[0];
    const remoteData = await downloadFromGoogleDrive(latestFile.id);

    if (!remoteData || !remoteData.entries) {
      // Remote data is corrupted, upload local
      const success = await backupToGoogleDrive(indexId, localEntries);
      return { success, action: 'uploaded' };
    }

    const remoteEntries = remoteData.entries;
    const localTimestamp = Math.max(...localEntries.map(e => e.lastReviewed || 0));
    const remoteTimestamp = remoteData.timestamp || 0;

    if (localTimestamp > remoteTimestamp) {
      // Local is newer, upload
      const success = await backupToGoogleDrive(indexId, localEntries);
      return { success, action: 'uploaded' };
    } else if (remoteTimestamp > localTimestamp) {
      // Remote is newer, return remote data
      return { success: true, action: 'downloaded', remoteEntries };
    } else {
      // Same timestamp, no sync needed
      return { success: true, action: 'no_change' };
    }
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, action: 'error' };
  }
};

// ===== SPACED REPETITION FUNCTIONS =====

export const initializeSpacedRepetition = (entry: Entry): Entry => {
  return {
    ...entry,
    easeFactor: entry.easeFactor ?? 2.5,
    interval: entry.interval ?? 1,
    repetitions: entry.repetitions ?? 0,
    nextReview: entry.nextReview ?? Date.now()
  };
};

export const getSpacedReviewStatus = (entry: Entry): ReviewStatus => {
  if (!entry.nextReview) return 'new';
  if (!entry.lastReviewed) return 'new';

  const now = Date.now();

  if (entry.repetitions === 0) return 'learning';
  if (now > entry.nextReview) return 'overdue';
  if (entry.repetitions && entry.repetitions >= 5) return 'mastered';
  return 'reviewing';
};

export const calculateNextReview = (entry: Entry, response: 'correct' | 'incorrect' | 'hard' | 'easy'): Entry => {
  const now = Date.now();
  let { easeFactor = 2.5, interval = 1, repetitions = 0 } = entry;

  switch (response) {
    case 'correct':
      repetitions += 1;
      if (repetitions === 1) interval = 1;
      else if (repetitions === 2) interval = 6;
      else interval = Math.round(interval * easeFactor);
      easeFactor = Math.max(1.3, easeFactor + 0.1);
      break;

    case 'easy':
      repetitions += 1;
      interval = Math.round(interval * easeFactor * 1.5);
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      break;

    case 'hard':
      repetitions = Math.max(0, repetitions - 1);
      interval = Math.max(1, Math.round(interval * 0.8));
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;

    case 'incorrect':
      repetitions = 0;
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.3);
      break;
  }

  const nextReview = now + (interval * 24 * 60 * 60 * 1000);

  return {
    ...entry,
    easeFactor,
    interval,
    repetitions,
    nextReview,
    lastReviewed: now
  };
};

export const getDueEntries = (entries: Entry[]): Entry[] => {
  const now = Date.now();
  return entries.filter(entry => {
    const status = getSpacedReviewStatus(entry);
    return status === 'overdue' || status === 'new' || (entry.nextReview && entry.nextReview <= now);
  });
};

export const getEntriesDueToday = (entries: Entry[]): Entry[] => {
  const now = Date.now();
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return entries.filter(entry => {
    if (!entry.nextReview) return true; // New entries
    return entry.nextReview <= tomorrow.getTime();
  });
};

// ===== STUDY SESSION FUNCTIONS =====

export const createStudySession = (
  name: string,
  goal: StudySessionGoal,
  entries: Entry[]
): StudySession => {
  let sessionEntries: Entry[] = [];

  switch (goal.type) {
    case 'count':
      sessionEntries = entries.slice(0, goal.value as number);
      break;
    case 'time':
      // For time-based, we'll select entries but limit by time during session
      sessionEntries = getDueEntries(entries);
      break;
    case 'category':
      sessionEntries = entries.filter(e => e.category === goal.value);
      break;
    case 'tag':
      sessionEntries = entries.filter(e => e.tags.includes(goal.value as string));
      break;
    case 'due':
      sessionEntries = getDueEntries(entries);
      break;
  }

  return {
    id: generateUUID(),
    name,
    created: Date.now(),
    goal,
    progress: {
      totalCards: sessionEntries.length,
      completedCards: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      timeSpent: 0,
      currentStreak: 0,
      bestStreak: 0
    },
    results: []
  };
};

export const saveStudySession = async (indexId: string, session: StudySession) => {
  const sessions = await loadStudySessions(indexId);
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  await secureSetItem(`giac-study-sessions-${indexId}`, sessions);
  await logAuditEvent('study_session_saved', session.id, { indexId });
};

export const loadStudySessions = async (indexId: string): Promise<StudySession[]> => {
  const data = await secureGetItem(`giac-study-sessions-${indexId}`);
  return data || [];
};

export const getStudySession = async (indexId: string, sessionId: string): Promise<StudySession | null> => {
  const sessions = await loadStudySessions(indexId);
  return sessions.find(s => s.id === sessionId) || null;
};

export const deleteStudySession = async (indexId: string, sessionId: string) => {
  const sessions = await loadStudySessions(indexId);
  const filteredSessions = sessions.filter(s => s.id !== sessionId);
  await secureSetItem(`giac-study-sessions-${indexId}`, filteredSessions);
  await logAuditEvent('study_session_deleted', sessionId, { indexId });
};

export const updateStudySessionProgress = (
  session: StudySession,
  entryId: string,
  response: 'correct' | 'incorrect' | 'hard' | 'easy',
  timeSpent: number
): StudySession => {
  const result: StudySessionResult = {
    entryId,
    timestamp: Date.now(),
    response,
    timeSpent
  };

  const progress = { ...session.progress };
  progress.completedCards += 1;
  progress.timeSpent += timeSpent;

  if (response === 'correct' || response === 'easy') {
    progress.correctAnswers += 1;
    progress.currentStreak += 1;
    progress.bestStreak = Math.max(progress.bestStreak, progress.currentStreak);
  } else {
    progress.incorrectAnswers += 1;
    progress.currentStreak = 0;
  }

  return {
    ...session,
    progress,
    results: [...session.results, result]
  };
};

export const completeStudySession = (session: StudySession): StudySession => {
  return {
    ...session,
    completed: Date.now()
  };
};

export const getStudySessionStats = (sessions: StudySession[]) => {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.completed).length;
  const totalCards = sessions.reduce((sum, s) => sum + s.progress.totalCards, 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + s.progress.correctAnswers, 0);
  const totalTime = sessions.reduce((sum, s) => sum + s.progress.timeSpent, 0);
  const averageAccuracy = totalCards > 0 ? (totalCorrect / totalCards) * 100 : 0;

  return {
    totalSessions,
    completedSessions,
    totalCards,
    totalCorrect,
    totalTime,
    averageAccuracy: Math.round(averageAccuracy * 100) / 100
  };
};

// Initialize security features on app startup
export const initializeSecurity = async (): Promise<void> => {
  try {
    await initializeEncryption();
    console.log('Security features initialized successfully');
  } catch (error) {
    console.error('Failed to initialize security features:', error);
  }
};