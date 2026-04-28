import { useState, useEffect } from 'react';
import type { Entry, IndexMetadata, StudySession, StudySessionGoal } from './types';
import { exportToXLSX, exportToCSV, exportToDOCX, exportToPDF, importFromCSV, parseBulk, enhancedSearch, getSearchDiscoveryHints, getReviewStatus, exportAsIndexText, getAllIndexes, getCurrentIndexId, createIndex, deleteIndex, updateIndexMetadata, saveIndexEntries, loadIndexEntries, saveIndexHistory, loadIndexHistory, autoBackupIndex, restoreFromIndexHistory, signInToGoogle, signOutFromGoogle, isSignedInToGoogle, backupToGoogleDrive, restoreFromGoogleDrive, syncWithGoogleDrive, listGoogleDriveFiles, initializeSpacedRepetition, calculateNextReview, getDueEntries, getEntriesDueToday, createStudySession, saveStudySession, loadStudySessions, deleteStudySession, updateStudySessionProgress, completeStudySession, initializeSecurity, verifyIndexBackups, cleanupIndexBackups, cleanupIndexHistory } from './utils';
import { PrivacyPolicy } from './PrivacyPolicy';
import type { ReviewStatus } from './types';
import type { PrivacySettings as PrivacySettingsType } from './security';
import { getPrivacySettings, updatePrivacySettings as updatePrivacySettingsStorage, acceptPrivacyPolicy, isPasswordProtectionEnabled, enablePasswordProtection, disablePasswordProtection, verifyPassword, DEFAULT_PRIVACY_SETTINGS, cleanupAuditLogs } from './security';
import { initTelemetry, captureError, captureBreadcrumb } from './telemetry';
import { ObservabilityDashboard } from './components/ObservabilityDashboard';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

type FlashcardSetOption = 'all' | 'due' | 'favorites' | 'unstudied' | 'category' | 'tag';
type FlashcardQuestionMode = 'termToNotes' | 'notesToTerm' | 'mixed';

const App = () => {
  // State declarations
  const [currentIndexId, setCurrentIndexId] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [allIndexes, setAllIndexes] = useState<IndexMetadata[]>([]);
  const [newEntry, setNewEntry] = useState<Omit<Entry, 'id'>>({ term: '', book: 0, page: 0, category: '', notes: '', highlighted: false, studied: false, bookTitle: '', favorite: false, tags: [] });
  const [bulkText, setBulkText] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'term' | 'book' | 'page'>('term');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [darkMode, setDarkMode] = useState(false);
  const [filterStudied, setFilterStudied] = useState<'all' | 'studied' | 'not-studied'>('all');
  const [filterHighlighted, setFilterHighlighted] = useState<'all' | 'highlighted' | 'not-highlighted'>('all');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [isAddingNewBookTitle, setIsAddingNewBookTitle] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'index' | 'flashcard'>('list');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSetOption>('all');
  const [flashcardCategory, setFlashcardCategory] = useState('');
  const [flashcardTag, setFlashcardTag] = useState('');
  const [flashcardQuestionMode, setFlashcardQuestionMode] = useState<FlashcardQuestionMode>('termToNotes');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterTag, setFilterTag] = useState('');
  const [filterReviewStatus, setFilterReviewStatus] = useState<ReviewStatus | 'all'>('all');
  const [newTag, setNewTag] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showIndexManager, setShowIndexManager] = useState(false);
  const [newIndexName, setNewIndexName] = useState('');
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [showStudySessions, setShowStudySessions] = useState(false);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [currentStudySession, setCurrentStudySession] = useState<StudySession | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordActionMessage, setPasswordActionMessage] = useState('');
  const [privacySettings, setPrivacySettings] = useState<PrivacySettingsType>(DEFAULT_PRIVACY_SETTINGS);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionGoal, setNewSessionGoal] = useState<StudySessionGoal>({ type: 'count', value: 20 });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [cardStartTime, setCardStartTime] = useState<number | null>(null);
  const [showObservabilityDash, setShowObservabilityDash] = useState(false);

  const initializeApp = async () => {
    try {
      await initializeSecurity();

      const settings = getPrivacySettings();
      initTelemetry(settings);

      captureBreadcrumb('App initialization started', { timestamp: new Date().toISOString() });

      const indexes = await getAllIndexes();
      if (indexes.length === 0) {
        // Migrate from old single-index format
        const oldEntries = localStorage.getItem('giac-entries');
        const oldName = localStorage.getItem('giac-index-name') || 'My Study Index';

        if (oldEntries) {
          const defaultIndex = await createIndex(oldName);
          const entries = JSON.parse(oldEntries);
          await saveIndexEntries(defaultIndex.id, entries);
          await setCurrentIndexId(defaultIndex.id);

          // Clean up old keys
          localStorage.removeItem('giac-entries');
          localStorage.removeItem('giac-index-name');
          localStorage.removeItem('giac-history');
          localStorage.removeItem('giac-backups');
        } else {
          // Create default index for new users
          const defaultIndex = await createIndex('My Study Index');
          await setCurrentIndexId(defaultIndex.id);
        }
      }

      const currentId = await getCurrentIndexId();
      setCurrentIndexId(currentId);
      const currentEntries = await loadIndexEntries(currentId);
      setEntries(currentEntries);
      setAllIndexes(await getAllIndexes());

      // Verify backups for current index
      const backupStatus = await verifyIndexBackups(currentId);
      if (backupStatus.errors.length > 0) {
        captureBreadcrumb('Backup verification warnings', { errorCount: backupStatus.errors.length });
      }

      // Load study sessions for the current index
      const sessions = await loadStudySessions(currentId);
      setStudySessions(sessions);

      // Initialize spaced repetition for existing entries
      const needsInit = currentEntries.some(entry => !entry.hasOwnProperty('easeFactor'));
      if (needsInit) {
        const updatedEntries = currentEntries.map(entry => initializeSpacedRepetition(entry));
        await saveIndexEntries(currentId, updatedEntries);
        setEntries(updatedEntries);
      }

      captureBreadcrumb('App initialization completed successfully');
    } catch (error) {
      captureError(error, { context: 'App initialization failed' });
      console.error('Failed to initialize app:', error);
      toast.error('Failed to initialize app');
    }
  };

  const performDataCleanup = async () => {
    try {
      const settings = getPrivacySettings();
      if (settings.retentionPeriod > 0) {
        const auditDeleted = await cleanupAuditLogs(settings.retentionPeriod);
        const backupDeleted = await cleanupIndexBackups(currentIndexId, settings.retentionPeriod);
        const historyDeleted = await cleanupIndexHistory(currentIndexId, settings.retentionPeriod);

        captureBreadcrumb('Data cleanup completed', {
          auditDeleted,
          backupDeleted,
          historyDeleted,
          retentionDays: settings.retentionPeriod
        });

        toast.success(`Cleanup: ${auditDeleted + backupDeleted + historyDeleted} items removed`);
      }
    } catch (error) {
      captureError(error, { context: 'Data cleanup failed' });
      console.error('Data cleanup failed:', error);
    }
  };

  useEffect(() => {
    const initializeFromStorage = async () => {
      const settings = getPrivacySettings();
      setPrivacySettings(settings);

      if (settings.passwordProtectionEnabled && isPasswordProtectionEnabled()) {
        setShowLockScreen(true);
        return;
      }

      await initializeApp();
    };

    initializeFromStorage();
  }, []);

  // Auto-save entries
  useEffect(() => {
    const autoSave = async () => {
      if (entries.length > 0) {
        await saveIndexEntries(currentIndexId, entries);
        await saveIndexHistory(currentIndexId, entries);
        await autoBackupIndex(currentIndexId, entries);
      }
    };
    autoSave();
  }, [entries, currentIndexId]);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Reload entries when switching indexes
  useEffect(() => {
    const reloadEntries = async () => {
      const newEntries = await loadIndexEntries(currentIndexId);
      setEntries(newEntries);
      setFlashcardIndex(0);
      setShowFlashcardAnswer(false);
      setStudySessions(await loadStudySessions(currentIndexId));
    };
    reloadEntries();
  }, [currentIndexId]);

  // Update document title when current index changes
  useEffect(() => {
    const currentIndex = allIndexes.find(idx => idx.id === currentIndexId);
    if (currentIndex) {
      document.title = currentIndex.name;
    }
  }, [currentIndexId, allIndexes]);

  // Check Google sign-in status periodically
  useEffect(() => {
    const checkGoogleSignIn = () => {
      setIsGoogleSignedIn(isSignedInToGoogle());
    };

    checkGoogleSignIn();
    const interval = setInterval(checkGoogleSignIn, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const switchToIndex = (indexId: string) => {
    setCurrentIndexId(indexId);
    setCurrentIndexId(indexId);
  };

  const createNewIndex = () => {
    if (!newIndexName.trim()) {
      toast.error('Index name cannot be empty');
      return;
    }
    (async () => {
      const newIndex = await createIndex(newIndexName.trim());
      const allIdxs = await getAllIndexes();
      setAllIndexes(allIdxs);
      switchToIndex(newIndex.id);
      setNewIndexName('');
      setShowIndexManager(false);
      toast.success('New index created');
    })();
  };

  const removeIndex = (indexId: string) => {
    if (allIndexes.length <= 1) {
      toast.error('Cannot delete the last index');
      return;
    }
    (async () => {
      await deleteIndex(indexId);
      const allIdxs = await getAllIndexes();
      setAllIndexes(allIdxs);
      toast.success('Index deleted');
    })();
  };

  const handleGoogleSignIn = async () => {
    try {
      const success = await signInToGoogle();
      setIsGoogleSignedIn(success);
      if (success) {
        toast.success('Connected to Google Drive');
        await loadGoogleDriveFiles();
      } else {
        toast.error('Failed to connect to Google Drive');
      }
    } catch (error) {
      toast.error('Google sign-in failed');
      console.error(error);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutFromGoogle();
      setIsGoogleSignedIn(false);
      setGoogleDriveFiles([]);
      toast.success('Disconnected from Google Drive');
    } catch (error) {
      toast.error('Failed to sign out');
      console.error(error);
    }
  };

  const loadGoogleDriveFiles = async () => {
    try {
      const files = await listGoogleDriveFiles();
      setGoogleDriveFiles(files);
    } catch (error) {
      console.error('Failed to load Google Drive files:', error);
    }
  };

  const handleBackupToGoogle = async () => {
    try {
      setIsSyncing(true);
      const success = await backupToGoogleDrive(currentIndexId, entries);
      if (success) {
        toast.success('Backup uploaded to Google Drive');
        await loadGoogleDriveFiles();
      } else {
        toast.error('Backup failed');
      }
    } catch (error) {
      toast.error('Backup failed');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromGoogle = async (fileId: string) => {
    try {
      setIsSyncing(true);
      const data = await restoreFromGoogleDrive(fileId);
      if (data) {
        setEntries(data.entries);
        toast.success('Restored from Google Drive');
      } else {
        toast.error('Restore failed');
      }
    } catch (error) {
      toast.error('Restore failed');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncWithGoogle = async () => {
    try {
      setIsSyncing(true);
      const result = await syncWithGoogleDrive(currentIndexId, entries);

      switch (result.action) {
        case 'uploaded':
          toast.success('Local data uploaded to Google Drive');
          await loadGoogleDriveFiles();
          break;
        case 'downloaded':
          if (result.remoteEntries) {
            setEntries(result.remoteEntries);
            toast.success('Synced with Google Drive (remote data loaded)');
          }
          break;
        case 'no_change':
          toast.success('Already in sync');
          break;
        case 'error':
          toast.error('Sync failed');
          break;
      }
    } catch (error) {
      toast.error('Sync failed');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Study Session Functions
  const createNewStudySession = () => {
    if (!newSessionName.trim()) {
      toast.error('Session name is required');
      return;
    }

    const session = createStudySession(newSessionName.trim(), newSessionGoal, entries);
    (async () => {
      await saveStudySession(currentIndexId, session);
      const sessions = await loadStudySessions(currentIndexId);
      setStudySessions(sessions);
    })();
    setNewSessionName('');
    setNewSessionGoal({ type: 'count', value: 20 });
    setShowCreateSession(false);
    toast.success('Study session created');
  };

  const startStudySession = (session: StudySession) => {
    const updatedSession = { ...session, started: Date.now() };
    (async () => {
      await saveStudySession(currentIndexId, updatedSession);
    })();
    setCurrentStudySession(updatedSession);
    setSessionStartTime(Date.now());
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setCardStartTime(Date.now());
    setShowStudySessions(false);
  };

  const endStudySession = () => {
    if (!currentStudySession) return;

    const completedSession = completeStudySession(currentStudySession);
    (async () => {
      await saveStudySession(currentIndexId, completedSession);
      const sessions = await loadStudySessions(currentIndexId);
      setStudySessions(sessions);
    })();
    setCurrentStudySession(null);
    setSessionStartTime(null);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setCardStartTime(null);
    toast.success('Study session completed!');
  };

  const answerCard = (response: 'correct' | 'incorrect' | 'hard' | 'easy') => {
    if (!currentStudySession || !cardStartTime) return;

    const timeSpent = (Date.now() - cardStartTime) / 1000; // Convert to seconds
    const sessionEntries = getSessionEntries(currentStudySession);
    const currentEntry = sessionEntries[currentCardIndex];

    if (currentEntry) {
      // Update spaced repetition data
      const updatedEntry = calculateNextReview(currentEntry, response);
      const updates: Partial<Entry> = {};
      if (updatedEntry.easeFactor !== undefined) updates.easeFactor = updatedEntry.easeFactor;
      if (updatedEntry.interval !== undefined) updates.interval = updatedEntry.interval;
      if (updatedEntry.repetitions !== undefined) updates.repetitions = updatedEntry.repetitions;
      if (updatedEntry.nextReview !== undefined) updates.nextReview = updatedEntry.nextReview;
      if (updatedEntry.lastReviewed !== undefined) updates.lastReviewed = updatedEntry.lastReviewed;
      updateEntry(updatedEntry.id, updates);

      // Update session progress
      const updatedSession = updateStudySessionProgress(currentStudySession, currentEntry.id, response, timeSpent);
      setCurrentStudySession(updatedSession);
    }

    // Move to next card or end session
    if (currentCardIndex < sessionEntries.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
      setCardStartTime(Date.now());
    } else {
      endStudySession();
    }
  };

  const getSessionEntries = (session: StudySession): Entry[] => {
    switch (session.goal.type) {
      case 'count':
        return getDueEntries(entries).slice(0, session.goal.value as number);
      case 'time':
        return getDueEntries(entries);
      case 'category':
        return entries.filter(e => e.category === session.goal.value);
      case 'tag':
        return entries.filter(e => e.tags.includes(session.goal.value as string));
      case 'due':
        return getDueEntries(entries);
      default:
        return getDueEntries(entries);
    }
  };

  const getSessionTimeRemaining = (): number => {
    if (!currentStudySession || !sessionStartTime) return 0;
    if (currentStudySession.goal.type !== 'time') return 0;

    const elapsed = (Date.now() - sessionStartTime) / 1000; // seconds
    const targetTime = (currentStudySession.goal.value as number) * 60; // minutes to seconds
    return Math.max(0, targetTime - elapsed);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categories = [...new Set(entries.map(e => e.category))];
  const bookTitles = [...new Set(entries.map(e => e.bookTitle).filter(title => title))];

  const stats = {
    totalEntries: entries.length,
    uniqueTerms: new Set(entries.map(e => e.term)).size,
    studiedEntries: entries.filter(e => e.studied).length,
    categories: categories.length,
    books: new Set(entries.map(e => e.book)).size,
    dueToday: getEntriesDueToday(entries).length,
    totalDue: getDueEntries(entries).length,
    mastered: entries.filter(e => (e.repetitions || 0) >= 5).length
  };

  const tagOptions = [...new Set(entries.flatMap(entry => entry.tags))].filter(Boolean);

  const getFlashcardQuestion = (entry: Entry, mode: FlashcardQuestionMode): { question: string; answer: string } => {
    const defaultAnswer = entry.notes || entry.bookTitle || `Book ${entry.book}, Page ${entry.page}`;

    switch (mode) {
      case 'notesToTerm':
        return {
          question: entry.notes ? `What term matches this description?

${entry.notes}` : `What term is described by Book ${entry.book}, Page ${entry.page}?`,
          answer: entry.term || defaultAnswer
        };
      case 'mixed':
        return (flashcardIndex % 2 === 0)
          ? getFlashcardQuestion(entry, 'termToNotes')
          : getFlashcardQuestion(entry, 'notesToTerm');
      case 'termToNotes':
      default:
        return {
          question: `What are the details for: ${entry.term}?`,
          answer: defaultAnswer
        };
    }
  };

  const getFlashcardEntries = (baseEntries: Entry[]): Entry[] => {
    switch (flashcardSet) {
      case 'due':
        return getDueEntries(baseEntries);
      case 'favorites':
        return baseEntries.filter(entry => entry.favorite);
      case 'unstudied':
        return baseEntries.filter(entry => !entry.studied);
      case 'category':
        return flashcardCategory ? baseEntries.filter(entry => entry.category === flashcardCategory) : baseEntries;
      case 'tag':
        return flashcardTag ? baseEntries.filter(entry => entry.tags.includes(flashcardTag)) : baseEntries;
      case 'all':
      default:
        return baseEntries;
    }
  };

  let filteredEntries = entries;
  if (filterCategory) {
    filteredEntries = filteredEntries.filter(e => e.category === filterCategory);
  }
  if (filterStudied === 'studied') {
    filteredEntries = filteredEntries.filter(e => e.studied);
  } else if (filterStudied === 'not-studied') {
    filteredEntries = filteredEntries.filter(e => !e.studied);
  }
  if (filterHighlighted === 'highlighted') {
    filteredEntries = filteredEntries.filter(e => e.highlighted);
  } else if (filterHighlighted === 'not-highlighted') {
    filteredEntries = filteredEntries.filter(e => !e.highlighted);
  }
  if (filterFavorites) {
    filteredEntries = filteredEntries.filter(e => e.favorite);
  }
  if (filterTag) {
    filteredEntries = filteredEntries.filter(e => e.tags.includes(filterTag));
  }
  if (filterReviewStatus !== 'all') {
    filteredEntries = filteredEntries.filter(e => getReviewStatus(e.lastReviewed) === filterReviewStatus);
  }
  if (searchTerm.trim()) {
    filteredEntries = enhancedSearch(filteredEntries, searchTerm);
  }

  const flashcardEntries = getFlashcardEntries(filteredEntries);
  const searchHints = getSearchDiscoveryHints(entries, searchTerm);
  const currentFlashcard = flashcardEntries[flashcardIndex] || null;
  const currentFlashcardQuestion = currentFlashcard
    ? getFlashcardQuestion(currentFlashcard, flashcardQuestionMode)
    : { question: '', answer: '' };

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k') {
          e.preventDefault();
          const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
          searchInput?.focus();
        }
        if (e.key === 'n') {
          e.preventDefault();
          const termInput = document.querySelector('input[placeholder="Term"]') as HTMLInputElement;
          termInput?.focus();
        }
        if (e.key === 'f') {
          e.preventDefault();
          setViewMode(viewMode === 'flashcard' ? 'list' : 'flashcard');
        }
        if (e.key === 'i') {
          e.preventDefault();
          setViewMode(viewMode === 'index' ? 'list' : 'index');
        }
      }
      // Flashcard navigation
      if (viewMode === 'flashcard') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFlashcardIndex((flashcardIndex + 1) % filteredEntries.length);
          setShowFlashcardAnswer(false);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFlashcardIndex((flashcardIndex - 1 + filteredEntries.length) % filteredEntries.length);
          setShowFlashcardAnswer(false);
        }
        if (e.key === ' ') {
          e.preventDefault();
          setShowFlashcardAnswer(!showFlashcardAnswer);
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [viewMode, filteredEntries.length, flashcardIndex, showFlashcardAnswer]);

  useEffect(() => {
    if (flashcardSet === 'category' && !flashcardCategory && categories.length > 0) {
      setFlashcardCategory(categories[0]!);
    }
    if (flashcardSet === 'tag' && !flashcardTag && tagOptions.length > 0) {
      setFlashcardTag(tagOptions[0]!);
    }
  }, [flashcardSet, categories, tagOptions, flashcardCategory, flashcardTag]);

  useEffect(() => {
    setFlashcardIndex(0);
    setShowFlashcardAnswer(false);
  }, [flashcardSet, flashcardCategory, flashcardTag, flashcardQuestionMode, flashcardEntries.length]);

  const addEntry = () => {
    if (!newEntry.term || !newEntry.book || !newEntry.page) {
      toast.error('Term, book, and page are required');
      return;
    }
    const exists = entries.some(e => e.term === newEntry.term && e.book === newEntry.book && e.page === newEntry.page);
    if (exists) {
      toast.error('Duplicate entry');
      return;
    }
    const entry: Entry = { ...newEntry, id: crypto.randomUUID() };
    setEntries([...entries, entry]);
    setNewEntry({ term: '', book: 0, page: 0, category: '', notes: '', highlighted: false, studied: false, bookTitle: '', favorite: false, tags: [] });
    setIsAddingNewCategory(false);
    setIsAddingNewBookTitle(false);
    toast.success('Entry added');
  };

  const addBulk = () => {
    const newEntries = parseBulk(bulkText).map(e => ({ ...e, id: crypto.randomUUID() }));
    const filtered = newEntries.filter(ne => !entries.some(e => e.term === ne.term && e.book === ne.book && e.page === ne.page));
    setEntries([...entries, ...filtered]);
    setBulkText('');
    setIsAddingNewCategory(false);
    setIsAddingNewBookTitle(false);
    toast.success(`${filtered.length} entries added`);
  };

  const deleteEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    toast.success('Entry deleted');
  };

  const updateEntry = (id: string, updates: Partial<Entry>) => {
    setEntries(entries.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const addTag = (id: string, tag: string) => {
    if (tag.trim()) {
      updateEntry(id, { tags: [...(entries.find(e => e.id === id)?.tags || []), tag.trim()] });
    }
  };

  const removeTag = (id: string, tag: string) => {
    updateEntry(id, { tags: (entries.find(e => e.id === id)?.tags || []).filter(t => t !== tag) });
  };

  const getAllTags = (): string[] => {
    const tags = new Set<string>();
    entries.forEach(e => e.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  };

  const restoreFromHistoryTimestamp = async (timestamp: number) => {
    const restored = await restoreFromIndexHistory(currentIndexId, timestamp);
    if (restored) {
      setEntries(restored);
      toast.success('Restored from history');
      setShowHistory(false);
    }
  };

  const exportBackup = () => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'giac-backup.json';
    a.click();
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (Array.isArray(data)) {
            setEntries(data);
            toast.success('Backup restored');
          } else {
            toast.error('Invalid backup file');
          }
        } catch {
          toast.error('Failed to parse backup file');
        }
      };
      reader.readAsText(file);
    }
  };

  const savePrivacySettings = (updates: Partial<PrivacySettingsType>) => {
    const newSettings = { ...privacySettings, ...updates };
    setPrivacySettings(newSettings);
    updatePrivacySettingsStorage(updates);
  };

  const handleAcceptPrivacyPolicy = () => {
    acceptPrivacyPolicy();
    setShowPrivacyPolicyModal(false);
  };

  const handleUnlock = async () => {
    if (!unlockPassword) {
      setPasswordError('Enter your password to unlock the app.');
      return;
    }

    const valid = await verifyPassword(unlockPassword);
    if (!valid) {
      setPasswordError('Invalid password, please try again.');
      return;
    }

    setPasswordError('');
    setUnlockPassword('');
    setShowLockScreen(false);
    await initializeApp();
  };

  const handleEnablePasswordProtection = async () => {
    setPasswordActionMessage('');
    if (newPassword.length < 6) {
      setPasswordActionMessage('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordActionMessage('Passwords do not match.');
      return;
    }

    try {
      await enablePasswordProtection(newPassword);
      savePrivacySettings({ passwordProtectionEnabled: true });
      setPasswordActionMessage('Password protection enabled.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to enable password protection:', error);
      setPasswordActionMessage('Failed to enable password protection.');
    }
  };

  const handleDisablePasswordProtection = async () => {
    if (!confirm('Disable password protection? This will allow access without a password.')) {
      return;
    }

    try {
      await disablePasswordProtection();
      savePrivacySettings({ passwordProtectionEnabled: false });
      setPasswordActionMessage('Password protection disabled.');
    } catch (error) {
      console.error('Failed to disable password protection:', error);
      setPasswordActionMessage('Failed to disable password protection.');
    }
  };

  const exportAllData = () => {
    const allData = {
      entries,
      allIndexes,
      privacySettings,
      timestamp: new Date().toISOString()
    };
    const data = JSON.stringify(allData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giac-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success('Data exported successfully');
  };

  const deleteAllData = () => {
    if (window.confirm('Are you sure? This will delete ALL your data permanently. This action cannot be undone.')) {
      localStorage.clear();
      sessionStorage.clear();
      setEntries([]);
      setAllIndexes([]);
      setCurrentIndexId('');
      setStudySessions([]);
      toast.success('All data deleted');
      // Reload the page to reset
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importFromCSV(file, (newEntries) => {
        const filtered = newEntries.filter(ne => !entries.some(e => e.term === ne.term && e.book === ne.book && e.page === ne.page));
        setEntries([...entries, ...filtered]);
        toast.success(`${filtered.length} entries imported`);
      });
    }
  };

  const grouped = filteredEntries.reduce((acc, entry) => {
    if (!acc[entry.term]) acc[entry.term] = [];
    (acc[entry.term] as Entry[]).push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);

  // Sort terms
  const sortedTerms = Object.keys(grouped).sort((a, b) => {
    let aVal: string | number, bVal: string | number;
    if (sortBy === 'term') {
      aVal = a;
      bVal = b;
    } else {
      // For book or page, use the first entry's value
      aVal = grouped[a]?.[0]?.[sortBy] as number ?? 0;
      bVal = grouped[b]?.[0]?.[sortBy] as number ?? 0;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <Toaster />

      {showPrivacyPolicyModal && (
        <PrivacyPolicy
          onAccept={handleAcceptPrivacyPolicy}
          onDecline={() => setShowPrivacyPolicyModal(false)}
          required={false}
        />
      )}

      {showLockScreen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
            <h2 className="text-2xl font-semibold mb-4">Unlock Your App</h2>
            <p className="text-sm text-gray-600 mb-4">
              This app is protected by a password. Enter it to continue.
            </p>
            <input
              type="password"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 border rounded mb-3"
            />
            {passwordError && <p className="text-sm text-red-600 mb-3">{passwordError}</p>}
            <div className="flex gap-3">
              <button onClick={handleUnlock} className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {!showPrivacyPolicyModal && (
      <header>
        <h1>{allIndexes.find(idx => idx.id === currentIndexId)?.name || 'Loading...'}</h1>
        <div className="header-controls">
          <select
            value={currentIndexId}
            onChange={e => switchToIndex(e.target.value)}
            style={{ marginRight: '12px', padding: '8px 12px', borderRadius: '8px' }}
          >
            {allIndexes.map(index => (
              <option key={index.id} value={index.id}>
                {index.name} ({index.entryCount} entries)
              </option>
            ))}
          </select>
          <div className="btn-group">
            <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>List</button>
            <button onClick={() => setViewMode('index')} className={viewMode === 'index' ? 'active' : ''}>Index</button>
            <button onClick={() => setViewMode('flashcard')} className={viewMode === 'flashcard' ? 'active' : ''}>Flashcard</button>
            <button onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
            <button onClick={() => setShowIndexManager(true)}>📁 Manage</button>
            <button onClick={() => setShowStudySessions(true)}>📚 Study</button>
            <button onClick={() => setShowObservabilityDash(true)}>📊 Monitor</button>
            <button onClick={() => setShowPrivacySettings(true)}>🔒 Privacy</button>
          </div>
        </div>
      </header>
      )}

      {showIndexManager && (
        <div className="modal-overlay" onClick={() => setShowIndexManager(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Manage Indexes</h2>

            <div style={{ marginBottom: '20px' }}>
              <h3>Create New Index</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newIndexName}
                  onChange={e => setNewIndexName(e.target.value)}
                  placeholder="New index name"
                  style={{ flex: 1 }}
                />
                <button onClick={createNewIndex}>Create</button>
              </div>
            </div>

            <div>
              <h3>Your Indexes</h3>
              {allIndexes.map(index => (
                <div key={index.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}>
                  <div>
                    <strong>{index.name}</strong>
                    <br />
                    <small>
                      {index.entryCount} entries •
                      Created {new Date(index.created).toLocaleDateString()} •
                      Modified {new Date(index.modified).toLocaleDateString()}
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {index.id === currentIndexId && <span style={{ color: 'green' }}>Current</span>}
                    <button
                      onClick={() => {
                        const newName = prompt('Rename index:', index.name);
                        if (newName && newName.trim()) {
                          (async () => {
                            await updateIndexMetadata(index.id, { name: newName.trim() });
                            const allIdxs = await getAllIndexes();
                            setAllIndexes(allIdxs);
                            toast.success('Index renamed');
                          })();
                        }
                      }}
                      disabled={index.id === currentIndexId}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete index "${index.name}"? This cannot be undone.`)) {
                          removeIndex(index.id);
                        }
                      }}
                      disabled={allIndexes.length <= 1}
                      style={{ color: 'red' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setShowIndexManager(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showGoogleDriveModal && (
        <div className="modal-overlay" onClick={() => setShowGoogleDriveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Google Drive Backups</h2>

            <div style={{ marginBottom: '20px' }}>
              <button onClick={loadGoogleDriveFiles} style={{ marginBottom: '12px' }}>
                Refresh Files
              </button>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {googleDriveFiles.length === 0 ? (
                  <p>No backup files found in Google Drive.</p>
                ) : (
                  googleDriveFiles
                    .filter(file => file.name.includes(`giac-index-${currentIndexId}`))
                    .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())
                    .map(file => (
                      <div key={file.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        marginBottom: '8px'
                      }}>
                        <div>
                          <strong>{file.name}</strong>
                          <br />
                          <small>
                            Modified: {new Date(file.modifiedTime).toLocaleString()}
                          </small>
                        </div>
                        <button
                          onClick={() => handleRestoreFromGoogle(file.id)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="modal-buttons">
              <button onClick={handleBackupToGoogle} disabled={isSyncing}>
                {isSyncing ? 'Uploading...' : 'Upload Current Backup'}
              </button>
              <button className="btn-secondary" onClick={() => setShowGoogleDriveModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showStudySessions && (
        <div className="modal-overlay" onClick={() => setShowStudySessions(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Study Sessions</h2>

            <div style={{ marginBottom: '20px' }}>
              <button onClick={() => setShowCreateSession(true)} style={{ marginBottom: '12px' }}>
                + Create New Session
              </button>

              <div style={{ marginBottom: '20px' }}>
                <h3>Quick Sessions</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => {
                    const session = createStudySession('Review Due Cards', { type: 'due', value: 'due' }, entries);
                    startStudySession(session);
                  }}>
                    📅 Review Due ({getDueEntries(entries).length})
                  </button>
                  <button onClick={() => {
                    const session = createStudySession('Daily Review', { type: 'count', value: 20 }, entries);
                    startStudySession(session);
                  }}>
                    📚 Daily Review (20 cards)
                  </button>
                  <button onClick={() => {
                    const session = createStudySession('New Cards', { type: 'count', value: 10 }, entries);
                    startStudySession(session);
                  }}>
                    🆕 New Cards (10)
                  </button>
                </div>
              </div>

              <div>
                <h3>Your Sessions</h3>
                {studySessions.length === 0 ? (
                  <p>No study sessions yet. Create your first session!</p>
                ) : (
                  studySessions
                    .sort((a, b) => (b.started || b.created) - (a.started || a.created))
                    .map(session => (
                      <div key={session.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        background: session.completed ? '#f0f8f0' : '#fff8f0'
                      }}>
                        <div>
                          <strong>{session.name}</strong>
                          <br />
                          <small>
                            {session.goal.type === 'count' && `${session.goal.value} cards`}
                            {session.goal.type === 'time' && `${session.goal.value} minutes`}
                            {session.goal.type === 'category' && `Category: ${session.goal.value}`}
                            {session.goal.type === 'tag' && `Tag: ${session.goal.value}`}
                            {session.goal.type === 'due' && 'Due cards'}
                            {' • '}
                            {session.completed
                              ? `Completed ${new Date(session.completed).toLocaleDateString()}`
                              : session.started
                                ? `Started ${new Date(session.started).toLocaleDateString()}`
                                : `Created ${new Date(session.created).toLocaleDateString()}`
                            }
                          </small>
                          {session.completed && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                              {session.progress.correctAnswers}/{session.progress.totalCards} correct •
                              {formatTime(session.progress.timeSpent)} •
                              {Math.round((session.progress.correctAnswers / Math.max(1, session.progress.totalCards)) * 100)}% accuracy
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {!session.completed && !session.started && (
                            <button onClick={() => startStudySession(session)}>
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete session "${session.name}"?`)) {
                                (async () => {

                                  await deleteStudySession(currentIndexId, session.id);

                                  const sessions = await loadStudySessions(currentIndexId);

                                  setStudySessions(sessions);

                                })();
                                toast.success('Session deleted');
                              }
                            }}
                            style={{ color: 'red' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setShowStudySessions(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCreateSession && (
        <div className="modal-overlay" onClick={() => setShowCreateSession(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Study Session</h2>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label>Session Name:</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={e => setNewSessionName(e.target.value)}
                  placeholder="e.g., Morning Review, Network Security"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label>Session Type:</label>
                <select
                  value={newSessionGoal.type}
                  onChange={e => {
                    const type = e.target.value as StudySessionGoal['type'];
                    let value: number | string = 20;
                    if (type === 'time') value = 15;
                    if (type === 'category') value = '';
                    if (type === 'tag') value = '';
                    setNewSessionGoal({ type, value });
                  }}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="count">Fixed Number of Cards</option>
                  <option value="time">Time-Based (minutes)</option>
                  <option value="category">Specific Category</option>
                  <option value="tag">Specific Tag</option>
                  <option value="due">Review Due Cards</option>
                </select>
              </div>

              {newSessionGoal.type === 'count' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Number of Cards:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newSessionGoal.value as number}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: parseInt(e.target.value) || 20 })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              )}

              {newSessionGoal.type === 'time' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Duration (minutes):</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={newSessionGoal.value as number}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: parseInt(e.target.value) || 15 })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              )}

              {newSessionGoal.type === 'category' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Category:</label>
                  <select
                    value={newSessionGoal.value as string}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: e.target.value })}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}

              {newSessionGoal.type === 'tag' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Tag:</label>
                  <select
                    value={newSessionGoal.value as string}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: e.target.value })}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="">Select Tag</option>
                    {getAllTags().map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button onClick={createNewStudySession}>Create Session</button>
              <button className="btn-secondary" onClick={() => setShowCreateSession(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {currentStudySession && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal study-session-modal" onClick={e => e.stopPropagation()}>
            <div className="study-session-header">
              <h2>{currentStudySession.name}</h2>
              <div className="session-stats">
                <span>Card {currentCardIndex + 1} of {getSessionEntries(currentStudySession).length}</span>
                <span>Correct: {currentStudySession.progress.correctAnswers}</span>
                <span>Time: {formatTime(currentStudySession.progress.timeSpent)}</span>
                {currentStudySession.goal.type === 'time' && (
                  <span>Remaining: {formatTime(getSessionTimeRemaining())}</span>
                )}
              </div>
            </div>

            <div className="study-card">
              {(() => {
                const sessionEntries = getSessionEntries(currentStudySession);
                const currentEntry = sessionEntries[currentCardIndex];

                if (!currentEntry) {
                  return <div>Session complete!</div>;
                }

                return (
                  <div>
                    <div className="card-front">
                      <h3>{currentEntry.term}</h3>
                      <div className="card-meta">
                        {currentEntry.category && <span>📁 {currentEntry.category}</span>}
                        {currentEntry.bookTitle && <span>📖 {currentEntry.bookTitle}</span>}
                        {currentEntry.book && <span>#{currentEntry.book}</span>}
                        {currentEntry.page && <span>p.{currentEntry.page}</span>}
                      </div>
                      {currentEntry.tags.length > 0 && (
                        <div className="card-tags">
                          {currentEntry.tags.map(tag => (
                            <span key={tag} className="tag">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {showAnswer && (
                      <div className="card-back">
                        <h4>Answer:</h4>
                        <p>{currentEntry.notes || 'No additional notes'}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="study-controls">
              {!showAnswer ? (
                <button onClick={() => setShowAnswer(true)} className="btn-primary">
                  Show Answer
                </button>
              ) : (
                <div className="answer-buttons">
                  <button onClick={() => answerCard('incorrect')} className="btn-incorrect">
                    😞 Incorrect
                  </button>
                  <button onClick={() => answerCard('hard')} className="btn-hard">
                    😕 Hard
                  </button>
                  <button onClick={() => answerCard('correct')} className="btn-correct">
                    🙂 Correct
                  </button>
                  <button onClick={() => answerCard('easy')} className="btn-easy">
                    😊 Easy
                  </button>
                </div>
              )}

              <div className="session-actions">
                <button onClick={endStudySession} className="btn-secondary">
                  End Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStudySessions && (
        <div className="modal-overlay" onClick={() => setShowStudySessions(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Study Sessions</h2>

            <div style={{ marginBottom: '20px' }}>
              <button onClick={() => setShowCreateSession(true)} style={{ marginBottom: '12px' }}>
                + Create New Session
              </button>

              <div style={{ marginBottom: '20px' }}>
                <h3>Quick Sessions</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => {
                    const session = createStudySession('Review Due Cards', { type: 'due', value: 'due' }, entries);
                    startStudySession(session);
                  }}>
                    📅 Review Due ({getDueEntries(entries).length})
                  </button>
                  <button onClick={() => {
                    const session = createStudySession('Daily Review', { type: 'count', value: 20 }, entries);
                    startStudySession(session);
                  }}>
                    📚 Daily Review (20 cards)
                  </button>
                  <button onClick={() => {
                    const session = createStudySession('New Cards', { type: 'count', value: 10 }, entries);
                    startStudySession(session);
                  }}>
                    🆕 New Cards (10)
                  </button>
                </div>
              </div>

              <div>
                <h3>Your Sessions</h3>
                {studySessions.length === 0 ? (
                  <p>No study sessions yet. Create your first session!</p>
                ) : (
                  studySessions
                    .sort((a, b) => (b.started || b.created) - (a.started || a.created))
                    .map(session => (
                      <div key={session.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        background: session.completed ? '#f0f8f0' : '#fff8f0'
                      }}>
                        <div>
                          <strong>{session.name}</strong>
                          <br />
                          <small>
                            {session.goal.type === 'count' && `${session.goal.value} cards`}
                            {session.goal.type === 'time' && `${session.goal.value} minutes`}
                            {session.goal.type === 'category' && `Category: ${session.goal.value}`}
                            {session.goal.type === 'tag' && `Tag: ${session.goal.value}`}
                            {session.goal.type === 'due' && 'Due cards'}
                            {' • '}
                            {session.completed
                              ? `Completed ${new Date(session.completed).toLocaleDateString()}`
                              : session.started
                                ? `Started ${new Date(session.started).toLocaleDateString()}`
                                : `Created ${new Date(session.created).toLocaleDateString()}`
                            }
                          </small>
                          {session.completed && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                              {session.progress.correctAnswers}/{session.progress.totalCards} correct •
                              {formatTime(session.progress.timeSpent)} •
                              {Math.round((session.progress.correctAnswers / Math.max(1, session.progress.totalCards)) * 100)}% accuracy
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {!session.completed && !session.started && (
                            <button onClick={() => startStudySession(session)}>
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete session "${session.name}"?`)) {
                                (async () => {

                                  await deleteStudySession(currentIndexId, session.id);

                                  const sessions = await loadStudySessions(currentIndexId);

                                  setStudySessions(sessions);

                                })();
                                toast.success('Session deleted');
                              }
                            }}
                            style={{ color: 'red' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setShowStudySessions(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCreateSession && (
        <div className="modal-overlay" onClick={() => setShowCreateSession(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Study Session</h2>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label>Session Name:</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={e => setNewSessionName(e.target.value)}
                  placeholder="e.g., Morning Review, Network Security"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label>Session Type:</label>
                <select
                  value={newSessionGoal.type}
                  onChange={e => {
                    const type = e.target.value as StudySessionGoal['type'];
                    let value: number | string = 20;
                    if (type === 'time') value = 15;
                    if (type === 'category') value = '';
                    if (type === 'tag') value = '';
                    setNewSessionGoal({ type, value });
                  }}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="count">Fixed Number of Cards</option>
                  <option value="time">Time-Based (minutes)</option>
                  <option value="category">Specific Category</option>
                  <option value="tag">Specific Tag</option>
                  <option value="due">Review Due Cards</option>
                </select>
              </div>

              {newSessionGoal.type === 'count' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Number of Cards:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newSessionGoal.value as number}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: parseInt(e.target.value) || 20 })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              )}

              {newSessionGoal.type === 'time' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Duration (minutes):</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={newSessionGoal.value as number}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: parseInt(e.target.value) || 15 })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              )}

              {newSessionGoal.type === 'category' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Category:</label>
                  <select
                    value={newSessionGoal.value as string}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: e.target.value })}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}

              {newSessionGoal.type === 'tag' && (
                <div style={{ marginBottom: '12px' }}>
                  <label>Tag:</label>
                  <select
                    value={newSessionGoal.value as string}
                    onChange={e => setNewSessionGoal({ ...newSessionGoal, value: e.target.value })}
                    style={{ width: '100%', marginTop: '4px' }}
                  >
                    <option value="">Select Tag</option>
                    {getAllTags().map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button onClick={createNewStudySession}>Create Session</button>
              <button className="btn-secondary" onClick={() => setShowCreateSession(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {currentStudySession && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal study-session-modal" onClick={e => e.stopPropagation()}>
            <div className="study-session-header">
              <h2>{currentStudySession.name}</h2>
              <div className="session-stats">
                <span>Card {currentCardIndex + 1} of {getSessionEntries(currentStudySession).length}</span>
                <span>Correct: {currentStudySession.progress.correctAnswers}</span>
                <span>Time: {formatTime(currentStudySession.progress.timeSpent)}</span>
                {currentStudySession.goal.type === 'time' && (
                  <span>Remaining: {formatTime(getSessionTimeRemaining())}</span>
                )}
              </div>
            </div>

            <div className="study-card">
              {(() => {
                const sessionEntries = getSessionEntries(currentStudySession);
                const currentEntry = sessionEntries[currentCardIndex];

                if (!currentEntry) {
                  return <div>Session complete!</div>;
                }

                return (
                  <div>
                    <div className="card-front">
                      <h3>{currentEntry.term}</h3>
                      <div className="card-meta">
                        {currentEntry.category && <span>📁 {currentEntry.category}</span>}
                        {currentEntry.bookTitle && <span>📖 {currentEntry.bookTitle}</span>}
                        {currentEntry.book && <span>#{currentEntry.book}</span>}
                        {currentEntry.page && <span>p.{currentEntry.page}</span>}
                      </div>
                      {currentEntry.tags.length > 0 && (
                        <div className="card-tags">
                          {currentEntry.tags.map(tag => (
                            <span key={tag} className="tag">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {showAnswer && (
                      <div className="card-back">
                        <h4>Answer:</h4>
                        <p>{currentEntry.notes || 'No additional notes'}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="study-controls">
              {!showAnswer ? (
                <button onClick={() => setShowAnswer(true)} className="btn-primary">
                  Show Answer
                </button>
              ) : (
                <div className="answer-buttons">
                  <button onClick={() => answerCard('incorrect')} className="btn-incorrect">
                    😞 Incorrect
                  </button>
                  <button onClick={() => answerCard('hard')} className="btn-hard">
                    😕 Hard
                  </button>
                  <button onClick={() => answerCard('correct')} className="btn-correct">
                    🙂 Correct
                  </button>
                  <button onClick={() => answerCard('easy')} className="btn-easy">
                    😊 Easy
                  </button>
                </div>
              )}

              <div className="session-actions">
                <button onClick={endStudySession} className="btn-secondary">
                  End Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat-card">
          <div className="stat-label">Total Entries</div>
          <div className="stat-value">{stats.totalEntries}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Terms</div>
          <div className="stat-value">{stats.uniqueTerms}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Studied</div>
          <div className="stat-value">{stats.studiedEntries}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Due Today</div>
          <div className="stat-value">{stats.dueToday}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Due</div>
          <div className="stat-value">{stats.totalDue}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mastered</div>
          <div className="stat-value">{stats.mastered}</div>
        </div>
      </div>
      <div className="controls">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select value={filterStudied} onChange={e => setFilterStudied(e.target.value as 'all' | 'studied' | 'not-studied')}>
          <option value="all">All Studied</option>
          <option value="studied">Studied</option>
          <option value="not-studied">Not Studied</option>
        </select>
        <select value={filterHighlighted} onChange={e => setFilterHighlighted(e.target.value as 'all' | 'highlighted' | 'not-highlighted')}>
          <option value="all">All Highlighted</option>
          <option value="highlighted">Highlighted</option>
          <option value="not-highlighted">Not Highlighted</option>
        </select>
        <input type="text" placeholder="Search terms, notes, tags, category... (try: tag:aws category:network book:1)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'term' | 'book' | 'page')}>
          <option value="term">Sort by Term</option>
          <option value="book">Sort by Book</option>
          <option value="page">Sort by Page</option>
        </select>
        <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>{sortOrder === 'asc' ? '↑' : '↓'}</button>
        <button onClick={() => setFilterFavorites(!filterFavorites)} style={{ fontWeight: filterFavorites ? 'bold' : 'normal' }}>⭐ Favorites</button>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="">All Tags</option>
          {getAllTags().map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <select value={filterReviewStatus} onChange={e => setFilterReviewStatus(e.target.value as ReviewStatus | 'all')}>
          <option value="all">All Review Status</option>
          <option value="new">New</option>
          <option value="not-due">Not Due</option>
          <option value="due-soon">Due Soon</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onClick={() => setShowHistory(!showHistory)}>📜 History</button>
      </div>
      <div className="search-discovery">
        <span className="search-discovery-label">Discovery:</span>
        {searchHints.length > 0 ? (
          searchHints.map(hint => (
            <button
              key={hint}
              type="button"
              className="search-chip"
              onClick={() => setSearchTerm(hint)}
            >
              {hint}
            </button>
          ))
        ) : (
          <span style={{ color: '#666' }}>No discovery hints available yet.</span>
        )}
        <button
          type="button"
          className="search-help-btn"
          onClick={() => setShowSearchHelp(!showSearchHelp)}
          title="Search help"
        >
          ❓
        </button>
      </div>
      {showSearchHelp && (
        <div className="search-help-modal">
          <h4>Advanced Search Syntax</h4>
          <div className="search-help-content">
            <div><strong>Field-specific search:</strong></div>
            <ul>
              <li><code>term:keyword</code> - Search in terms only</li>
              <li><code>category:network</code> or <code>cat:network</code> - Search categories</li>
              <li><code>tag:aws</code> or <code>tags:aws</code> - Search tags</li>
              <li><code>notes:important</code> or <code>note:important</code> - Search notes</li>
              <li><code>booktitle:giac</code> or <code>book:giac</code> - Search book titles</li>
              <li><code>booknum:1</code> or <code>bookno:1</code> - Search by book number</li>
              <li><code>page:45</code> - Search by page number</li>
              <li><code>studied:true</code> - Find studied entries</li>
              <li><code>highlighted:true</code> - Find highlighted entries</li>
              <li><code>favorite:true</code> - Find favorite entries</li>
            </ul>
            <div><strong>Examples:</strong></div>
            <ul>
              <li><code>tag:aws category:network</code> - AWS entries in network category</li>
              <li><code>book:1 page:45</code> - Entries from book 1, page 45</li>
              <li><code>studied:false tag:review</code> - Unstudied entries with review tag</li>
            </ul>
            <div><strong>General search:</strong> Type any text to search across all fields</div>
          </div>
          <button onClick={() => setShowSearchHelp(false)}>Close</button>
        </div>
      )}
      {showHistory && (
        <div className="history-panel">
          <h3>Restore from History</h3>
          {(() => {
            const history = loadIndexHistory(currentIndexId);
            return Array.isArray(history) ? history.reverse().slice(0, 10).map((h: any) => (
              <div key={h.timestamp} className="history-item" onClick={() => restoreFromHistoryTimestamp(h.timestamp)}>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  {new Date(h.timestamp).toLocaleString()} ({h.entries.length} entries)
                </p>
              </div>
            )) : null;
          })()}
        </div>
      )}
      <div className="add-form">
        <input placeholder="Term" value={newEntry.term} onChange={e => setNewEntry({ ...newEntry, term: e.target.value })} />
        <input type="number" placeholder="Book" value={newEntry.book || ''} onChange={e => setNewEntry({ ...newEntry, book: parseInt(e.target.value) || 0 })} />
        {isAddingNewBookTitle ? (
          <div>
            <input placeholder="Book Title" value={newEntry.bookTitle} onChange={e => setNewEntry({ ...newEntry, bookTitle: e.target.value })} />
            <button type="button" onClick={() => setIsAddingNewBookTitle(false)}>Select Existing</button>
          </div>
        ) : (
          <div>
            <select value={newEntry.bookTitle} onChange={e => {
              if (e.target.value === '__add_new__') {
                setIsAddingNewBookTitle(true);
                setNewEntry({ ...newEntry, bookTitle: '' });
              } else {
                setNewEntry({ ...newEntry, bookTitle: e.target.value });
              }
            }}>
              <option value="">Select Book Title</option>
              {bookTitles.map(title => <option key={title} value={title}>{title}</option>)}
              <option value="__add_new__">+ Add new book title</option>
            </select>
          </div>
        )}
        <input type="number" placeholder="Page" value={newEntry.page || ''} onChange={e => setNewEntry({ ...newEntry, page: parseInt(e.target.value) || 0 })} />
        {isAddingNewCategory ? (
          <div>
            <input placeholder="Category" value={newEntry.category} onChange={e => setNewEntry({ ...newEntry, category: e.target.value })} />
            <button type="button" onClick={() => setIsAddingNewCategory(false)}>Select Existing</button>
          </div>
        ) : (
          <div>
            <select value={newEntry.category} onChange={e => {
              if (e.target.value === '__add_new__') {
                setIsAddingNewCategory(true);
                setNewEntry({ ...newEntry, category: '' });
              } else {
                setNewEntry({ ...newEntry, category: e.target.value });
              }
            }}>
              <option value="">Select Category</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              <option value="__add_new__">+ Add new category</option>
            </select>
          </div>
        )}
        <input placeholder="Notes" value={newEntry.notes} onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            placeholder="Add tag" 
            value={newTag} 
            onChange={e => setNewTag(e.target.value)} 
            onKeyPress={e => {
              if (e.key === 'Enter') {
                setNewEntry({ ...newEntry, tags: [...newEntry.tags, newTag] });
                setNewTag('');
              }
            }}
          />
          {newEntry.tags.map(tag => (
            <span key={tag} style={{ backgroundColor: '#007bff', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
              {tag} <button onClick={() => setNewEntry({ ...newEntry, tags: newEntry.tags.filter(t => t !== tag) })} style={{ marginLeft: '4px', border: 'none', background: 'none', color: 'white', cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
        <label><input type="checkbox" checked={newEntry.highlighted} onChange={e => setNewEntry({ ...newEntry, highlighted: e.target.checked })} /> Highlighted</label>
        <label><input type="checkbox" checked={newEntry.studied} onChange={e => setNewEntry({ ...newEntry, studied: e.target.checked })} /> Studied</label>
        <label><input type="checkbox" checked={newEntry.favorite} onChange={e => setNewEntry({ ...newEntry, favorite: e.target.checked })} /> ⭐ Favorite</label>
        <button onClick={addEntry}>Add Entry</button>
      </div>
      <div className="bulk-add">
        <textarea placeholder="Bulk add: term,book,page per line" value={bulkText} onChange={e => setBulkText(e.target.value)} />
        <button onClick={addBulk}>Add Bulk</button>
      </div>
      <div className="import-export">
        <label>Import CSV: <input type="file" accept=".csv" onChange={handleImport} /></label>
        <button onClick={() => exportToCSV(filteredEntries)}>Export CSV</button>
        <button onClick={() => exportToXLSX(filteredEntries)}>Export XLSX</button>
        <button onClick={async () => await exportToDOCX(filteredEntries)}>Export DOCX</button>
        <button onClick={() => exportToPDF(filteredEntries)}>Export PDF</button>
        <button onClick={() => exportAsIndexText(filteredEntries)}>Export Index Text</button>
        <button onClick={exportBackup}>Backup JSON</button>
        <label>Restore Backup: <input type="file" accept=".json" onChange={importBackup} /></label>
        <button onClick={() => window.print()}>Print</button>
        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #ddd' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {isGoogleSignedIn ? (
            <>
              <span style={{ color: 'green', fontSize: '14px' }}>🔗 Google Drive</span>
              <button onClick={handleBackupToGoogle} disabled={isSyncing}>
                {isSyncing ? 'Backing up...' : 'Backup to Drive'}
              </button>
              <button onClick={handleSyncWithGoogle} disabled={isSyncing}>
                {isSyncing ? 'Syncing...' : 'Sync with Drive'}
              </button>
              <button onClick={() => setShowGoogleDriveModal(true)}>Browse Backups</button>
              <button onClick={handleGoogleSignOut} style={{ color: '#666' }}>Disconnect</button>
            </>
          ) : (
            <>
              <span style={{ color: '#666', fontSize: '14px' }}>🔌 Google Drive</span>
              <button onClick={handleGoogleSignIn}>Connect to Drive</button>
            </>
          )}
        </div>
      </div>
      <div className="entries">
        {viewMode === 'flashcard' && flashcardEntries.length > 0 && (
          <div className="flashcard-mode">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
              <h2>Flashcard Mode ({flashcardIndex + 1}/{flashcardEntries.length})</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <label>
                  Set:
                  <select value={flashcardSet} onChange={e => setFlashcardSet(e.target.value as FlashcardSetOption)} style={{ marginLeft: '8px', padding: '6px', minWidth: '130px' }}>
                    <option value="all">All</option>
                    <option value="due">Due</option>
                    <option value="favorites">Favorites</option>
                    <option value="unstudied">Unstudied</option>
                    <option value="category">Category</option>
                    <option value="tag">Tag</option>
                  </select>
                </label>
                {flashcardSet === 'category' && (
                  <label>
                    Category:
                    <select value={flashcardCategory} onChange={e => setFlashcardCategory(e.target.value)} style={{ marginLeft: '8px', padding: '6px', minWidth: '130px' }}>
                      <option value="">All categories</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                )}
                {flashcardSet === 'tag' && (
                  <label>
                    Tag:
                    <select value={flashcardTag} onChange={e => setFlashcardTag(e.target.value)} style={{ marginLeft: '8px', padding: '6px', minWidth: '130px' }}>
                      <option value="">All tags</option>
                      {tagOptions.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Question mode:
                  <select value={flashcardQuestionMode} onChange={e => setFlashcardQuestionMode(e.target.value as FlashcardQuestionMode)} style={{ marginLeft: '8px', padding: '6px', minWidth: '160px' }}>
                    <option value="termToNotes">Term → Details</option>
                    <option value="notesToTerm">Details → Term</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flashcard" onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)} style={{ cursor: 'pointer' }}>
              <div className="flashcard-inner">
                {showFlashcardAnswer ? (
                  <div>
                    <p className="flashcard-label">Answer</p>
                    <p className="flashcard-answer">{currentFlashcardQuestion.answer || 'No details available'}</p>
                    {currentFlashcard && (
                      <p style={{ marginTop: '12px', fontSize: '14px', color: '#999' }}>
                        Book {currentFlashcard.book}, Page {currentFlashcard.page}
                        {currentFlashcard.category && ` • ${currentFlashcard.category}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="flashcard-label">Question</p>
                    <p className="flashcard-term">{currentFlashcardQuestion.question}</p>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              <button onClick={() => {
                setFlashcardIndex((flashcardIndex - 1 + flashcardEntries.length) % flashcardEntries.length);
                setShowFlashcardAnswer(false);
              }}>← Previous</button>
              <button
                onClick={() => currentFlashcard && updateEntry(currentFlashcard.id, { studied: !currentFlashcard.studied })}
              >
                {currentFlashcard?.studied ? 'Mark Unseen' : 'Mark Studied'}
              </button>
              <button onClick={() => {
                setFlashcardIndex((flashcardIndex + 1) % flashcardEntries.length);
                setShowFlashcardAnswer(false);
              }}>Next →</button>
            </div>
            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#999' }}>
              Click to flip • Arrow keys to navigate • Space to flip • Ctrl+F to exit
            </p>
          </div>
        )}
        {viewMode === 'index' && (
          <div className="index-mode">
            <h2>Alphabetical Index</h2>
            {Object.entries(
              filteredEntries.reduce((acc, entry) => {
                const letter = entry.term.trim().charAt(0).toUpperCase() || '#';
                if (!acc[letter]) acc[letter] = [];
                acc[letter].push(entry);
                return acc;
              }, {} as Record<string, Entry[]>)
            ).sort(([a], [b]) => a.localeCompare(b)).map(([letter, letterEntries]) => (
              <div key={letter}>
                <h3 style={{ marginTop: '20px', marginBottom: '8px' }}>{letter}</h3>
                {letterEntries.sort((a, b) => a.term.localeCompare(b.term)).map(entry => (
                  <div key={entry.id} style={{ paddingLeft: '16px', marginBottom: '6px' }}>
                    <strong>{entry.term}</strong> - Book {entry.book}, Page {entry.page}
                    {entry.category && <span> • {entry.category}</span>}
                    {entry.notes && <p style={{ marginTop: '4px', fontSize: '14px', color: '#666' }}>{entry.notes}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {viewMode === 'list' && (
          <>
            {sortedTerms.map(term => (
              <div key={term} className="term-group">
                <h2>{term} ({grouped[term]!.length})</h2>
                {grouped[term]!.map(entry => (
                  <div key={entry.id} className={`entry ${entry.highlighted ? 'highlighted' : ''} ${entry.studied ? 'studied' : ''} ${entry.favorite ? 'favorite' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <input value={entry.term} onChange={e => updateEntry(entry.id, { term: e.target.value })} />
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button onClick={() => updateEntry(entry.id, { favorite: !entry.favorite })} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>
                          {entry.favorite ? '⭐' : '☆'}
                        </button>
                        <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '3px', backgroundColor: getReviewStatus(entry.lastReviewed) === 'overdue' ? '#ff6b6b' : getReviewStatus(entry.lastReviewed) === 'reviewing' ? '#ffd93d' : '#6bcf7f' }}>
                          {getReviewStatus(entry.lastReviewed) === 'overdue' ? '🔴 Overdue' : getReviewStatus(entry.lastReviewed) === 'reviewing' ? '🟡 Due Soon' : getReviewStatus(entry.lastReviewed) === 'new' ? '🟢 New' : '⚪ New'}
                        </span>
                      </div>
                    </div>
                    <input type="number" value={entry.book} onChange={e => updateEntry(entry.id, { book: parseInt(e.target.value) || 0 })} />
                    <input value={entry.bookTitle} onChange={e => updateEntry(entry.id, { bookTitle: e.target.value })} />
                    <input type="number" value={entry.page} onChange={e => updateEntry(entry.id, { page: parseInt(e.target.value) || 0 })} />
                    <input value={entry.category} onChange={e => updateEntry(entry.id, { category: e.target.value })} />
                    <input value={entry.notes} onChange={e => updateEntry(entry.id, { notes: e.target.value })} />
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {entry.tags.map(tag => (
                        <span key={tag} style={{ backgroundColor: '#007bff', color: 'white', padding: '2px 6px', borderRadius: '3px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {tag}
                          <button onClick={() => removeTag(entry.id, tag)} style={{ border: 'none', background: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <input type="text" placeholder="Add tag" style={{ flex: 1, padding: '4px', minWidth: '80px' }} onKeyPress={e => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                          addTag(entry.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }} />
                    </div>
                    <label><input type="checkbox" checked={entry.highlighted} onChange={e => updateEntry(entry.id, { highlighted: e.target.checked })} /> Star</label>
                    <label><input type="checkbox" checked={entry.studied} onChange={e => {
                      const updates: Partial<Entry> = { studied: e.target.checked };
                      if (e.target.checked) {
                        updates.lastReviewed = Date.now();
                      } else if (entry.lastReviewed !== undefined) {
                        updates.lastReviewed = entry.lastReviewed;
                      }
                      updateEntry(entry.id, updates);
                    }} /> Studied</label>
                    <button onClick={() => deleteEntry(entry.id)}>Delete</button>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

      {showObservabilityDash && (
        <div className="modal-overlay" onClick={() => setShowObservabilityDash(false)}>
          <div className="modal large-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Observability & System Monitoring</h2>
              <button
                onClick={() => setShowObservabilityDash(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ×
              </button>
            </div>

            <ObservabilityDashboard />

            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <button
                onClick={performDataCleanup}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🧹 Run Data Cleanup
              </button>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                Removes audit logs, backups, and history older than the retention period set in privacy settings.
              </p>
            </div>

            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setShowObservabilityDash(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

        {showPrivacySettings && (
          <div className="modal-overlay" onClick={() => setShowPrivacySettings(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Privacy Settings</h2>

              <div style={{ marginBottom: '20px' }}>
                <h3>Data Protection</h3>
                <div style={{ marginBottom: '12px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacySettings.dataEncryption}
                      onChange={e => savePrivacySettings({ dataEncryption: e.target.checked })}
                    />
                    Enable Data Encryption
                  </label>
                  <p style={{ marginLeft: '24px', color: '#555', marginTop: '6px' }}>
                    Encrypt stored data using the Web Crypto API.
                  </p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacySettings.autoBackup}
                      onChange={e => savePrivacySettings({ autoBackup: e.target.checked })}
                    />
                    Enable Automatic Backups
                  </label>
                  <p style={{ marginLeft: '24px', color: '#555', marginTop: '6px' }}>
                    Upload backups to Google Drive only when you allow it.
                  </p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacySettings.passwordProtectionEnabled}
                      readOnly
                    />
                    Password Protection Enabled
                  </label>
                </div>

                <div style={{ marginTop: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <p style={{ marginBottom: '10px', fontWeight: 600 }}>Password Protection</p>
                  <p style={{ marginBottom: '12px', color: '#555' }}>
                    Use a local password to lock access to the app and your study data.
                  </p>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleEnablePasswordProtection}
                        style={{ padding: '10px 16px', backgroundColor: '#0b74de', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        {privacySettings.passwordProtectionEnabled ? 'Change Password' : 'Enable Password Protection'}
                      </button>
                      {privacySettings.passwordProtectionEnabled && (
                        <button
                          onClick={handleDisablePasswordProtection}
                          style={{ padding: '10px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          Disable Password Protection
                        </button>
                      )}
                    </div>
                    {passwordActionMessage && <p style={{ color: '#333', fontSize: '14px' }}>{passwordActionMessage}</p>}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3>Analytics & Tracking</h3>
                <div style={{ marginBottom: '12px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacySettings.analyticsEnabled}
                      onChange={e => savePrivacySettings({ analyticsEnabled: e.target.checked })}
                    />
                    Allow anonymous usage analytics
                  </label>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacySettings.crashReporting}
                      onChange={e => savePrivacySettings({ crashReporting: e.target.checked })}
                    />
                    Enable crash reporting for improvements
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3>Data Sharing</h3>
                <div style={{ marginBottom: '12px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacySettings.dataSharing}
                      onChange={e => savePrivacySettings({ dataSharing: e.target.checked })}
                    />
                    Allow anonymized data sharing for product improvement
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3>Data Retention</h3>
                <div style={{ marginBottom: '12px' }}>
                  <label>Data retention period:</label>
                  <select
                    value={privacySettings.retentionPeriod}
                    onChange={e => savePrivacySettings({ retentionPeriod: parseInt(e.target.value) })}
                    style={{ marginLeft: '8px', padding: '4px' }}
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={365}>1 year</option>
                    <option value={-1}>Forever</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3>Data Management</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <button
                    onClick={exportAllData}
                    style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Export All Data
                  </button>
                  <button
                    onClick={deleteAllData}
                    style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Delete All Data
                  </button>
                </div>
                <p style={{ color: '#555', marginTop: '4px' }}>
                  GDPR rights: export your data and permanently delete your stored information.
                </p>
              </div>

              <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <h4>Privacy Policy</h4>
                <p style={{ color: '#555', marginBottom: '12px' }}>
                  Review the full privacy policy for details on data collection, sharing, and retention.
                </p>
                <button
                  onClick={() => setShowPrivacyPolicyModal(true)}
                  style={{ padding: '10px 16px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  View Privacy Policy
                </button>
              </div>

              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setShowPrivacySettings(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;





