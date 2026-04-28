import * as Sentry from '@sentry/browser'
import Rollbar from 'rollbar'
import type { PrivacySettings } from './security'

export interface TelemetryOptions {
  environment?: string
  release?: string
}

let rollbarClient: Rollbar | null = null
let sentryEnabled = false

const getSentryDsn = (): string | null => {
  return (import.meta.env as Record<string, unknown>)['VITE_SENTRY_DSN'] as string | null || null
}

const getRollbarToken = (): string | null => {
  return (import.meta.env as Record<string, unknown>)['VITE_ROLLBAR_ACCESS_TOKEN'] as string | null || null
}

export const initTelemetry = (settings: PrivacySettings, options: TelemetryOptions = {}): void => {
  const environment = options.environment || (import.meta.env as Record<string, unknown>)['VITE_APP_ENV'] as string || 'production'
  const release = options.release || (import.meta.env as Record<string, unknown>)['VITE_APP_VERSION'] as string || 'unknown'

  if (!settings.crashReporting) {
    sentryEnabled = false
    rollbarClient = null
    return
  }

  const sentryDsn = getSentryDsn()
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release,
      integrations: [],
      tracesSampleRate: 0.1
    })
    sentryEnabled = true
  }

  const rollbarToken = getRollbarToken()
  if (rollbarToken) {
    rollbarClient = new Rollbar({
      accessToken: rollbarToken,
      captureUncaught: true,
      captureUnhandledRejections: true,
      payload: {
        environment,
        client: {
          javascript: {
            code_version: release,
            source_map_enabled: true
          }
        }
      }
    })
  }
}

export const captureError = (error: Error | unknown, context?: Record<string, unknown>): void => {
  if (rollbarClient) {
    rollbarClient.error(error as Error, context as Record<string, unknown>)
  }

  if (sentryEnabled) {
    Sentry.captureException(error)
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        Sentry.setContext(key, { value: value as Record<string, unknown> })
      })
    }
  }
}

export const captureMessage = (message: string, data?: Record<string, unknown>): void => {
  if (rollbarClient) {
    rollbarClient.log(message, data)
  }

  if (sentryEnabled) {
    Sentry.captureMessage(message)
    if (data) {
      Sentry.setContext('message_details', data)
    }
  }
}

export const captureBreadcrumb = (message: string, data?: Record<string, unknown>): void => {
  if (sentryEnabled) {
    Sentry.addBreadcrumb({ message, data: data ?? {}, category: 'breadcrumb' })
  }

  if (rollbarClient) {
    rollbarClient.log(`Breadcrumb: ${message}`, data)
  }
}

export const flushTelemetry = async (): Promise<void> => {
  if (sentryEnabled) {
    await Sentry.flush(2000)
  }
}
