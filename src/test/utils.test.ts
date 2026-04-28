import { describe, it, expect, vi } from 'vitest'
import {
  fuzzyScore,
  enhancedSearch,
  getSearchDiscoveryHints,
  initializeSpacedRepetition,
  getSpacedReviewStatus,
  calculateNextReview,
  getDueEntries,
  getEntriesDueToday,
  createStudySession,
  updateStudySessionProgress,
  completeStudySession,
  parseBulk,
  getReviewStatus,
  calculateNextReviewDate
} from '../utils'
import type { Entry, StudySessionGoal } from '../types'

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    ...crypto,
    randomUUID: vi.fn(() => 'test-uuid')
  }
})

describe('Search Functions', () => {
  describe('fuzzyScore', () => {
    it('returns 0 for no match', () => {
      expect(fuzzyScore('test', 'xyz')).toBe(0)
    })

    it('returns score for partial match', () => {
      expect(fuzzyScore('test', 'testing')).toBeGreaterThan(0)
    })

    it('returns higher score for exact match', () => {
      expect(fuzzyScore('test', 'test')).toBe(fuzzyScore('test', 'testing'))
    })

    it('boosts early matches', () => {
      expect(fuzzyScore('test', 'testabc')).toBe(fuzzyScore('test', 'abctest'))
    })
  })

  describe('enhancedSearch', () => {
    const mockEntries: Entry[] = [
      {
        id: '1',
        term: 'JavaScript',
        category: 'Programming',
        notes: 'A programming language',
        book: 1,
        page: 10,
        highlighted: false,
        studied: false,
        bookTitle: 'Programming Guide',
        favorite: false,
        tags: ['js', 'web'],
        lastReviewed: Date.now(),
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReview: Date.now()
      },
      {
        id: '2',
        term: 'Python',
        category: 'Programming',
        notes: 'Another programming language',
        book: 1,
        page: 20,
        highlighted: false,
        studied: false,
        bookTitle: 'Programming Guide',
        favorite: false,
        tags: ['python', 'data'],
        lastReviewed: Date.now(),
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReview: Date.now()
      }
    ]

    it('returns all entries for empty query', () => {
      expect(enhancedSearch(mockEntries, '')).toHaveLength(2)
    })

    it('filters by term', () => {
      const results = enhancedSearch(mockEntries, 'term:JavaScript')
      expect(results).toHaveLength(1)
      expect(results[0]!.term).toBe('JavaScript')
    })

    it('filters by category', () => {
      const results = enhancedSearch(mockEntries, 'cat:Programming')
      expect(results).toHaveLength(2)
    })

    it('filters by tag', () => {
      const results = enhancedSearch(mockEntries, 'tag:js')
      expect(results).toHaveLength(1)
      expect(results[0]!.tags).toContain('js')
    })

    it('performs general text search', () => {
      const results = enhancedSearch(mockEntries, 'programming')
      expect(results).toHaveLength(2)
    })
  })

  describe('getSearchDiscoveryHints', () => {
    const mockEntries: Entry[] = [
      {
        id: '1',
        term: 'JavaScript',
        category: 'Programming',
        tags: ['js', 'web'],
        bookTitle: 'Guide',
        notes: '',
        book: 1,
        page: 1,
        highlighted: false,
        studied: false,
        favorite: false
      },
      {
        id: '2',
        term: 'Python',
        category: 'Programming',
        tags: ['python', 'web'],
        bookTitle: 'Guide',
        notes: '',
        book: 1,
        page: 1,
        highlighted: false,
        studied: false,
        favorite: false
      }
    ]

    it('returns hints for empty query', () => {
      const hints = getSearchDiscoveryHints(mockEntries, '')
      expect(hints.length).toBeGreaterThan(0)
      expect(hints).toContain('Programming')
    })

    it('filters hints based on query', () => {
      const hints = getSearchDiscoveryHints(mockEntries, 'prog')
      expect(hints).toContain('Programming')
    })
  })
})

describe('Spaced Repetition Functions', () => {
  const mockEntry: Entry = {
    id: '1',
    term: 'Test Term',
    category: 'Test',
    notes: '',
    book: 1,
    page: 1,
    highlighted: false,
    studied: false,
    bookTitle: 'Test Book',
    favorite: false,
    tags: [],
    lastReviewed: Date.now(),
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: Date.now()
  }

  describe('initializeSpacedRepetition', () => {
    it('initializes missing spaced repetition fields', () => {
      const entry = { ...mockEntry }
      delete entry.easeFactor
      delete entry.interval
      delete entry.repetitions
      delete entry.nextReview

      const initialized = initializeSpacedRepetition(entry)
      expect(initialized.easeFactor).toBe(2.5)
      expect(initialized.interval).toBe(1)
      expect(initialized.repetitions).toBe(0)
      expect(initialized.nextReview).toBeDefined()
    })
  })

  describe('getSpacedReviewStatus', () => {
    it('returns "new" for entries without nextReview', () => {
      const { nextReview, ...entryWithoutNextReview } = mockEntry
      const entry = entryWithoutNextReview as Entry
      expect(getSpacedReviewStatus(entry)).toBe('new')
    })

    it('returns "learning" for first repetition', () => {
      const entry = { ...mockEntry, repetitions: 0 }
      expect(getSpacedReviewStatus(entry)).toBe('learning')
    })

    it('returns "overdue" for past due entries', () => {
      const entry = { ...mockEntry, nextReview: Date.now() - 1000, repetitions: 1 }
      expect(getSpacedReviewStatus(entry)).toBe('overdue')
    })

    it('returns "mastered" for entries with 5+ repetitions', () => {
      const entry = { ...mockEntry, repetitions: 5, nextReview: Date.now() + 1000 }
      expect(getSpacedReviewStatus(entry)).toBe('mastered')
    })
  })

  describe('calculateNextReview', () => {
    it('increases interval for correct response', () => {
      const entry = { ...mockEntry, repetitions: 1, interval: 1 }
      const updated = calculateNextReview(entry, 'correct')
      expect(updated.interval).toBeGreaterThan(entry.interval)
      expect(updated.repetitions).toBe(2)
    })

    it('decreases interval for incorrect response', () => {
      const entry = { ...mockEntry, repetitions: 2, interval: 6 }
      const updated = calculateNextReview(entry, 'incorrect')
      expect(updated.interval).toBe(1)
      expect(updated.repetitions).toBe(0)
    })

    it('handles "easy" response', () => {
      const entry = { ...mockEntry, repetitions: 1, interval: 6 }
      const updated = calculateNextReview(entry, 'easy')
      expect(updated.interval).toBeGreaterThan(entry.interval)
      expect(updated.easeFactor).toBeGreaterThan(entry.easeFactor!)
    })

    it('handles "hard" response', () => {
      const entry = { ...mockEntry, repetitions: 2, interval: 6 }
      const updated = calculateNextReview(entry, 'hard')
      expect(updated.interval).toBeLessThan(entry.interval)
      expect(updated.easeFactor).toBeLessThan(entry.easeFactor!)
    })
  })

  describe('getDueEntries', () => {
    it('returns overdue entries', () => {
      const entries = [
        { ...mockEntry, id: '1', nextReview: Date.now() - 1000 },
        { ...mockEntry, id: '2', nextReview: Date.now() + 1000 }
      ]
      const due = getDueEntries(entries)
      expect(due).toHaveLength(1)
      expect(due[0]!.id).toBe('1')
    })
  })

  describe('getEntriesDueToday', () => {
    it('returns entries due today or new entries', () => {
      const entries = [
        { ...mockEntry, id: '1', nextReview: Date.now() },
        { ...mockEntry, id: '2', nextReview: Date.now() + 24 * 60 * 60 * 1000 }
      ]
      const due = getEntriesDueToday(entries)
      expect(due.length).toBeGreaterThan(0)
    })
  })
})

describe('Study Session Functions', () => {
  const mockEntry: Entry = {
    id: '1',
    term: 'Test Term',
    category: 'Test',
    notes: '',
    book: 1,
    page: 1,
    highlighted: false,
    studied: false,
    bookTitle: 'Test Book',
    favorite: false,
    tags: [],
    lastReviewed: Date.now(),
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: Date.now()
  }

  const mockEntries: Entry[] = [
    { ...mockEntry, id: '1', category: 'Math' },
    { ...mockEntry, id: '2', category: 'Science' }
  ]

  describe('createStudySession', () => {
    it('creates session with count goal', () => {
      const goal: StudySessionGoal = { type: 'count', value: 5 }
      const session = createStudySession('Test Session', goal, mockEntries)
      expect(session.name).toBe('Test Session')
      expect(session.progress.totalCards).toBe(2) // Limited by available entries
    })

    it('creates session with category goal', () => {
      const goal: StudySessionGoal = { type: 'category', value: 'Math' }
      const session = createStudySession('Math Session', goal, mockEntries)
      expect(session.progress.totalCards).toBe(1)
    })

    it('creates session with due goal', () => {
      const goal: StudySessionGoal = { type: 'due', value: null }
      const session = createStudySession('Due Session', goal, mockEntries)
      expect(session.progress.totalCards).toBe(2)
    })
  })

  describe('updateStudySessionProgress', () => {
    it('updates progress for correct answer', () => {
      const session = createStudySession('Test', { type: 'count', value: 5 }, mockEntries)
      const updated = updateStudySessionProgress(session, '1', 'correct', 1000)
      expect(updated.progress.completedCards).toBe(1)
      expect(updated.progress.correctAnswers).toBe(1)
      expect(updated.progress.currentStreak).toBe(1)
    })

    it('updates progress for incorrect answer', () => {
      const session = createStudySession('Test', { type: 'count', value: 5 }, mockEntries)
      const updated = updateStudySessionProgress(session, '1', 'incorrect', 1000)
      expect(updated.progress.incorrectAnswers).toBe(1)
      expect(updated.progress.currentStreak).toBe(0)
    })
  })

  describe('completeStudySession', () => {
    it('marks session as completed', () => {
      const session = createStudySession('Test', { type: 'count', value: 5 }, mockEntries)
      const completed = completeStudySession(session)
      expect(completed.completed).toBeDefined()
    })
  })
})

describe('Utility Functions', () => {
  describe('parseBulk', () => {
    it('parses bulk text into entries', () => {
      const text = 'Term1,1,10\nTerm2,1,20'
      const entries = parseBulk(text)
      expect(entries).toHaveLength(2)
      expect(entries[0]!.term).toBe('Term1')
      expect(entries[0]!.book).toBe(1)
      expect(entries[0]!.page).toBe(10)
    })

    it('filters out empty terms', () => {
      const text = ',1,10\nTerm2,1,20'
      const entries = parseBulk(text)
      expect(entries).toHaveLength(1)
      expect(entries[0]!.term).toBe('Term2')
    })
  })

  describe('getReviewStatus', () => {
    it('returns "new" for unreviewed entries', () => {
      expect(getReviewStatus()).toBe('new')
      expect(getReviewStatus(undefined)).toBe('new')
    })

    it('returns "overdue" for entries not reviewed in 7+ days', () => {
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000)
      expect(getReviewStatus(eightDaysAgo)).toBe('overdue')
    })

    it('returns "reviewing" for entries reviewed 3-7 days ago', () => {
      const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000)
      expect(getReviewStatus(fiveDaysAgo)).toBe('reviewing')
    })
  })

  describe('calculateNextReviewDate', () => {
    it('returns appropriate intervals', () => {
      expect(calculateNextReviewDate(0)).toBe(1)
      expect(calculateNextReviewDate(2)).toBe(3)
      expect(calculateNextReviewDate(6)).toBe(7)
      expect(calculateNextReviewDate(13)).toBe(14)
      expect(calculateNextReviewDate(20)).toBe(30)
    })
  })
})