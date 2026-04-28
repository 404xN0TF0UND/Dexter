import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

// Custom render function that includes providers and common setup
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => {
  const AllTheProviders = ({ children }: { children: ReactNode }) => {
    return <>{children}</>
  }

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock data generators
export const createMockStudyEntry = (overrides = {}) => ({
  id: 'test-id',
  term: 'Test Term',
  details: 'Test Details',
  category: 'Test Category',
  tags: ['tag1', 'tag2'],
  dateAdded: new Date('2024-01-01'),
  lastReviewed: new Date('2024-01-01'),
  nextReview: new Date('2024-01-02'),
  easeFactor: 2.5,
  interval: 1,
  reviewCount: 1,
  correctCount: 1,
  incorrectCount: 0,
  isFavorite: false,
  ...overrides,
})

export const createMockFlashcardSet = (overrides = {}) => ({
  id: 'set-id',
  name: 'Test Set',
  description: 'Test Description',
  entries: [createMockStudyEntry()],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// Test helpers
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0))

export const mockCryptoKey = {
  type: 'secret',
  algorithm: { name: 'AES-GCM' },
  extractable: true,
  usages: ['encrypt', 'decrypt'],
} as CryptoKey

// Local storage helpers for tests
export const mockLocalStorage = {
  setItem: (key: string, value: string) => {
    ;(window.localStorage.setItem as any).mockImplementation((k: string) => k === key ? value : null)
  },
  getItem: (key: string) => {
    return (window.localStorage.getItem as any).mockImplementation((k: string) => k === key ? 'mocked-value' : null)
  },
  clear: () => {
    ;(window.localStorage.clear as any).mockClear()
  },
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }