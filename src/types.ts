export type Entry = {
  id: string;
  term: string;
  book: number;
  page: number;
  category: string;
  notes: string;
  highlighted: boolean;
  studied: boolean;
  bookTitle: string;
  favorite: boolean;
  tags: string[];
  lastReviewed?: number;
  // Spaced repetition fields
  easeFactor?: number; // SM-2 ease factor (default 2.5)
  interval?: number; // Days until next review
  repetitions?: number; // Number of successful repetitions
  nextReview?: number; // Timestamp for next review
};

export type IndexMetadata = {
  id: string;
  name: string;
  created: number;
  modified: number;
  entryCount: number;
};

export type Index = {
  metadata: IndexMetadata;
  entries: Entry[];
};

// Study Session types
export type StudySession = {
  id: string;
  name: string;
  created: number;
  started?: number;
  completed?: number;
  goal: StudySessionGoal;
  progress: StudySessionProgress;
  results: StudySessionResult[];
};

export type StudySessionGoal = {
  type: 'count' | 'time' | 'category' | 'tag' | 'due';
  value: number | string | null; // count, minutes, category name, tag name, or no value for due sessions
  targetCount?: number; // For time-based sessions
};

export type StudySessionProgress = {
  totalCards: number;
  completedCards: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timeSpent: number; // in seconds
  currentStreak: number;
  bestStreak: number;
};

export type StudySessionResult = {
  entryId: string;
  timestamp: number;
  response: 'correct' | 'incorrect' | 'hard' | 'easy';
  timeSpent: number; // in seconds
  previousEaseFactor?: number;
  newEaseFactor?: number;
};

export type ReviewStatus = 'new' | 'learning' | 'reviewing' | 'mastered' | 'overdue';