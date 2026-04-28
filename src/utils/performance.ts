// Performance monitoring utilities
export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    this.initializeObservers()
  }

  private initializeObservers() {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long-task', entry.duration, {
              startTime: entry.startTime,
              type: 'longtask'
            })
          }
        })
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.push(longTaskObserver)
      } catch (e) {
        console.warn('Long task monitoring not supported')
      }

      // Monitor layout shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) return
            this.recordMetric('layout-shift', (entry as any).value, {
              startTime: entry.startTime,
              type: 'layout-shift'
            })
          }
        })
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(layoutShiftObserver)
      } catch (e) {
        console.warn('Layout shift monitoring not supported')
      }
    }
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata: metadata ?? {}
    }

    this.metrics.push(metric)

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift()
    }

    // Log significant performance issues
    if (name === 'long-task' && value > 50) {
      console.warn(`Long task detected: ${value}ms`, metadata)
    }

    if (name === 'layout-shift' && value > 0.1) {
      console.warn(`Layout shift detected: ${value}`, metadata)
    }
  }

  measureFunction<T>(name: string, fn: () => T): T {
    const start = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - start
      this.recordMetric(`function-${name}`, duration)
      return result
    } catch (error) {
      const duration = performance.now() - start
      const err = error instanceof Error ? error : new Error(String(error))
      this.recordMetric(`function-${name}-error`, duration, { error: err.message })
      throw error
    }
  }

  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      this.recordMetric(`async-function-${name}`, duration)
      return result
    } catch (error) {
      const duration = performance.now() - start
      const err = error instanceof Error ? error : new Error(String(error))
      this.recordMetric(`async-function-${name}-error`, duration, { error: err.message })
      throw error
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(metric => metric.name === name)
    }
    return [...this.metrics]
  }

  getAverageMetric(name: string): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
  }

  clearMetrics() {
    this.metrics = []
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    measureFunction: performanceMonitor.measureFunction.bind(performanceMonitor),
    measureAsyncFunction: performanceMonitor.measureAsyncFunction.bind(performanceMonitor),
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getAverageMetric: performanceMonitor.getAverageMetric.bind(performanceMonitor)
  }
}

// Utility to measure component render time
export const measureRender = (componentName: string) => {
  const start = performance.now()
  return () => {
    const duration = performance.now() - start
    performanceMonitor.recordMetric(`render-${componentName}`, duration)
  }
}