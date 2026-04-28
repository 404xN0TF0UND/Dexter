import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { captureError, captureBreadcrumb } from '../telemetry'
import { logAuditEvent } from '../security'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)

    const errorContext = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    }

    // Log to telemetry services
    captureError(error, {
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })

    captureBreadcrumb('Component error caught', {
      errorMessage: error.message,
      componentStack: errorInfo.componentStack
    })

    // Log to audit system
    logAuditEvent('application_error', 'error_boundary', errorContext).catch(err => {
      console.error('Failed to log error to audit:', err)
    })

    // Show user-friendly error message
    toast.error('Something went wrong. Please refresh the page.')
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-600 mb-4">
            The application encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
          {process.env['NODE_ENV'] === 'development' && this.state.error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-red-700 font-medium">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-2 bg-red-100 text-red-900 text-sm rounded overflow-auto">
                {this.state.error.message}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
