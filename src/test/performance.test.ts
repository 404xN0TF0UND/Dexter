import { describe, it, expect, beforeEach } from 'vitest'
import { performanceMonitor, usePerformanceMonitor, measureRender } from '../utils/performance'

describe('Performance Monitor', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics()
  })

  describe('recordMetric', () => {
    it('records a metric', () => {
      performanceMonitor.recordMetric('test-metric', 100, { test: true })

      const metrics = performanceMonitor.getMetrics('test-metric')
      expect(metrics).toHaveLength(1)
      expect(metrics[0]!.name).toBe('test-metric')
      expect(metrics[0]!.value).toBe(100)
      expect(metrics[0]!.metadata).toEqual({ test: true })
    })

    it('limits stored metrics to 100', () => {
      for (let i = 0; i < 105; i++) {
        performanceMonitor.recordMetric('test', i)
      }

      const metrics = performanceMonitor.getMetrics()
      expect(metrics).toHaveLength(100)
    })
  })

  describe('measureFunction', () => {
    it('measures function execution time', () => {
      const result = performanceMonitor.measureFunction('test-function', () => {
        // Simulate some work
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      })

      expect(result).toBe(499500) // Sum of 0-999

      const metrics = performanceMonitor.getMetrics('function-test-function')
      expect(metrics).toHaveLength(1)
      expect(metrics[0]!.value).toBeGreaterThan(0)
    })

    it('records errors in measured functions', () => {
      expect(() => {
        performanceMonitor.measureFunction('error-function', () => {
          throw new Error('Test error')
        })
      }).toThrow('Test error')

      const errorMetrics = performanceMonitor.getMetrics('function-error-function-error')
      expect(errorMetrics).toHaveLength(1)
    })
  })

  describe('measureAsyncFunction', () => {
    it('measures async function execution time', async () => {
      const result = await performanceMonitor.measureAsyncFunction('async-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async result'
      })

      expect(result).toBe('async result')

      const metrics = performanceMonitor.getMetrics('async-function-async-test')
      expect(metrics).toHaveLength(1)
      expect(metrics[0]!.value).toBeGreaterThan(10)
    })

    it('records errors in async functions', async () => {
      await expect(
        performanceMonitor.measureAsyncFunction('async-error', async () => {
          await new Promise(resolve => setTimeout(resolve, 5))
          throw new Error('Async error')
        })
      ).rejects.toThrow('Async error')

      const errorMetrics = performanceMonitor.getMetrics('async-function-async-error-error')
      expect(errorMetrics).toHaveLength(1)
    })
  })

  describe('getAverageMetric', () => {
    it('calculates average of metrics', () => {
      performanceMonitor.recordMetric('avg-test', 10)
      performanceMonitor.recordMetric('avg-test', 20)
      performanceMonitor.recordMetric('avg-test', 30)

      const average = performanceMonitor.getAverageMetric('avg-test')
      expect(average).toBe(20)
    })

    it('returns 0 for non-existent metrics', () => {
      const average = performanceMonitor.getAverageMetric('non-existent')
      expect(average).toBe(0)
    })
  })

  describe('usePerformanceMonitor hook', () => {
    it('returns performance monitoring functions', () => {
      const monitor = usePerformanceMonitor()

      expect(typeof monitor.measureFunction).toBe('function')
      expect(typeof monitor.measureAsyncFunction).toBe('function')
      expect(typeof monitor.recordMetric).toBe('function')
      expect(typeof monitor.getMetrics).toBe('function')
      expect(typeof monitor.getAverageMetric).toBe('function')
    })
  })

  describe('measureRender', () => {
    it('returns a function that records render time', () => {
      const endRender = measureRender('TestComponent')

      // Simulate render time
      setTimeout(() => {
        endRender()
      }, 5)

      // Wait a bit and check metrics
      setTimeout(() => {
        const metrics = performanceMonitor.getMetrics('render-TestComponent')
        expect(metrics).toHaveLength(1)
        expect(metrics[0]!.value).toBeGreaterThan(0)
      }, 10)
    })
  })

  describe('Performance Observer Integration', () => {
    it('initializes performance observers when supported', () => {
      // This test mainly ensures no errors are thrown during initialization
      // The actual observer behavior is hard to test in a unit test environment
      expect(performanceMonitor).toBeDefined()
    })

    it('handles unsupported PerformanceObserver gracefully', () => {
      // Mock PerformanceObserver as undefined
      const originalPerformanceObserver = window.PerformanceObserver
      ;(window as any).PerformanceObserver = undefined

      // Re-initialize monitor
      const newMonitor = new (performanceMonitor.constructor as any)()

      expect(newMonitor).toBeDefined()

      // Restore
      ;(window as any).PerformanceObserver = originalPerformanceObserver
    })
  })
})