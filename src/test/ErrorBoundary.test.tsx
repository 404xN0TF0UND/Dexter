import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import ErrorBoundary from '../components/ErrorBoundary'
import { Component } from 'react'

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn()
  }
}))

// Component that throws an error
class ErrorComponent extends Component {
  override componentDidMount() {
    throw new Error('Test error')
  }
  override render() {
    return <div>Error Component</div>
  }
}

// Component that renders normally
const NormalComponent = () => <div>Normal Component</div>

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Normal Component')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Refresh Page')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<div>Custom Error Fallback</div>}>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error Fallback')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('shows error details in development', () => {
    // Mock NODE_ENV
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'development'

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()

    consoleSpy.mockRestore()
    process.env['NODE_ENV'] = originalEnv
  })

  it('handles refresh button click', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    )

    const refreshButton = screen.getByText('Refresh Page')
    refreshButton.click()

    expect(reloadSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
    reloadSpy.mockRestore()
  })
})