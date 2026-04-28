// Accessibility utilities and helpers
import React from 'react'
export const a11y = {
  // Generate unique IDs for form elements and their labels
  generateId: (prefix = 'a11y') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,

  // Focus management
  focusFirstFocusable: (element: HTMLElement) => {
    const focusable = element.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement
    if (focusable) {
      focusable.focus()
    }
  },

  // Trap focus within a container (for modals, etc.)
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  },

  // Announce content to screen readers
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.style.position = 'absolute'
    announcement.style.left = '-10000px'
    announcement.style.width = '1px'
    announcement.style.height = '1px'
    announcement.style.overflow = 'hidden'

    document.body.appendChild(announcement)
    announcement.textContent = message

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  },

  // Check if element is visible to screen readers
  isVisible: (element: HTMLElement): boolean => {
    return !(
      element.getAttribute('aria-hidden') === 'true' ||
      element.hidden ||
      element.style.display === 'none' ||
      element.style.visibility === 'hidden' ||
      getComputedStyle(element).visibility === 'hidden'
    )
  }
}

// Keyboard navigation helpers
export const keyboard = {
  // Handle common keyboard interactions
  onEnter: (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handler()
    }
  },

  onEscape: (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handler()
    }
  },

  onSpace: (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault()
      handler()
    }
  },

  // Combined keyboard handler for common patterns
  onActivation: (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

// ARIA helpers
export const aria = {
  // Dynamic label management
  setLabel: (element: HTMLElement, label: string) => {
    element.setAttribute('aria-label', label)
  },

  // Live region for dynamic content
  createLiveRegion: (priority: 'polite' | 'assertive' = 'polite'): HTMLElement => {
    const region = document.createElement('div')
    region.setAttribute('aria-live', priority)
    region.setAttribute('aria-atomic', 'true')
    region.style.position = 'absolute'
    region.style.left = '-10000px'
    region.style.width = '1px'
    region.style.height = '1px'
    region.style.overflow = 'hidden'
    document.body.appendChild(region)
    return region
  },

  // Error messaging
  setError: (element: HTMLElement, errorMessage: string | null) => {
    if (errorMessage) {
      element.setAttribute('aria-invalid', 'true')
      element.setAttribute('aria-describedby', `${element.id}-error`)
    } else {
      element.removeAttribute('aria-invalid')
      element.removeAttribute('aria-describedby')
    }
  }
}

// Color contrast utilities
export const contrast = {
  // Calculate relative luminance
  getLuminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }) as [number, number, number]
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  },

  // Calculate contrast ratio
  getContrastRatio: (color1: [number, number, number], color2: [number, number, number]): number => {
    const lum1 = contrast.getLuminance(...color1)
    const lum2 = contrast.getLuminance(...color2)
    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)
    return (brightest + 0.05) / (darkest + 0.05)
  },

  // Check if contrast meets WCAG standards
  meetsWCAG: (ratio: number, level: 'AA' | 'AAA' = 'AA', size: 'normal' | 'large' = 'normal'): boolean => {
    if (level === 'AAA') {
      return size === 'large' ? ratio >= 4.5 : ratio >= 7
    }
    return size === 'large' ? ratio >= 3 : ratio >= 4.5
  }
}

// Focus management React hook
export const useFocusManagement = () => {
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  const saveFocus = React.useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = React.useCallback(() => {
    if (previousFocusRef.current && a11y.isVisible(previousFocusRef.current)) {
      previousFocusRef.current.focus()
    }
  }, [])

  return { saveFocus, restoreFocus }
}