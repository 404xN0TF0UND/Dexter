import { useEffect, useState } from 'react'
import { performanceMonitor } from '../utils/performance'
import { getAuditLogs, getAuditSummary, type AuditLogEntry } from '../security'

interface DashboardTab {
  id: 'performance' | 'audit' | 'backups' | 'health'
  label: string
}

interface PerformanceSummary {
  longTaskCount: number
  avgLongTaskDuration: number
  layoutShiftCount: number
  avgLayoutShift: string | number
  functionMetrics: Record<string, { avg: number; count: number }>
}

interface AuditSummary {
  total: number
  actionCounts: Record<string, number>
  resourceCounts: Record<string, number>
  recent: AuditLogEntry[]
}

export const ObservabilityDashboard = () => {
  const [activeTab, setActiveTab] = useState<'performance' | 'audit' | 'backups' | 'health'>('performance')
  const [perfSummary, setPerfSummary] = useState<PerformanceSummary | null>(null)
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)

  const tabs: DashboardTab[] = [
    { id: 'performance', label: '📊 Performance' },
    { id: 'audit', label: '📋 Audit Trail' },
    { id: 'backups', label: '💾 Backups' },
    { id: 'health', label: '❤️ System Health' }
  ]

  const updatePerformanceSummary = () => {
    const metrics = performanceMonitor.getMetrics()
    const longTasks = metrics.filter(m => m.name === 'long-task')
    const layoutShifts = metrics.filter(m => m.name === 'layout-shift')
    const functionMetrics: Record<string, { avg: number; count: number }> = {}

    metrics.filter(m => m.name.startsWith('function-') || m.name.startsWith('async-function-')).forEach(m => {
      const baseName = m.name.replace(/^(async-)?function-/, '').replace(/-error$/, '')
      if (!functionMetrics[baseName]) {
        functionMetrics[baseName] = { avg: 0, count: 0 }
      }
      functionMetrics[baseName]!.avg += m.value
      functionMetrics[baseName]!.count += 1
    })

    Object.entries(functionMetrics).forEach(([_key, data]) => {
      data.avg = Math.round(data.avg / data.count)
    })

    const avgLayoutShift = layoutShifts.length > 0 ? (layoutShifts.reduce((sum, m) => sum + m.value, 0) / layoutShifts.length).toFixed(3) : '0'

    setPerfSummary({
      longTaskCount: longTasks.length,
      avgLongTaskDuration: longTasks.length > 0 ? Math.round(longTasks.reduce((sum, m) => sum + m.value, 0) / longTasks.length) : 0,
      layoutShiftCount: layoutShifts.length,
      avgLayoutShift,
      functionMetrics
    })
  }

  const updateAuditSummary = async () => {
    try {
      const summary = await getAuditSummary()
      setAuditSummary(summary)
      const logs = await getAuditLogs()
      setAuditLogs(logs.slice(-20).reverse())
    } catch (error) {
      console.error('Failed to load audit summary:', error)
    }
  }

  useEffect(() => {
    if (activeTab === 'performance') {
      updatePerformanceSummary()
    } else if (activeTab === 'audit') {
      updateAuditSummary()
    }
  }, [activeTab])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (activeTab === 'performance') {
        updatePerformanceSummary()
      } else if (activeTab === 'audit') {
        updateAuditSummary()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, activeTab])

  return (
    <div className="observability-dashboard" style={{
      padding: '16px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Observability Dashboard</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <select
              value={refreshInterval}
              onChange={e => setRefreshInterval(parseInt(e.target.value))}
              disabled={!autoRefresh}
              style={{ fontSize: '12px', padding: '4px' }}
            >
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #ddd' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 14px',
                border: 'none',
                backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '13px',
                borderRadius: '4px 4px 0 0',
                fontWeight: activeTab === tab.id ? '600' : 'normal'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'performance' && perfSummary && (
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0 }}>Real User Monitoring (RUM)</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '4px solid #ff6b6b'
            }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Long Tasks</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{perfSummary.longTaskCount}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Avg: {perfSummary.avgLongTaskDuration}ms</div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '4px solid #ffd93d'
            }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Layout Shifts</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{perfSummary.layoutShiftCount}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Avg: {perfSummary.avgLayoutShift}</div>
            </div>
          </div>

          <div>
            <h5 style={{ marginTop: 0 }}>Function Performance</h5>
            {Object.entries(perfSummary.functionMetrics).length === 0 ? (
              <p style={{ color: '#999', fontSize: '12px' }}>No function metrics recorded yet</p>
            ) : (
              <div style={{
                fontSize: '12px',
                display: 'grid',
                gap: '4px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {Object.entries(perfSummary.functionMetrics).map(([name, data]) => (
                  <div key={name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '3px'
                  }}>
                    <span>{name}</span>
                    <span style={{ fontWeight: 'bold' }}>{data.avg}ms ({data.count} calls)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'audit' && auditSummary && (
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0 }}>Audit Trail</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '4px solid #007bff'
            }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Events</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{auditSummary.total}</div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '4px solid #28a745'
            }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Action Types</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Object.keys(auditSummary.actionCounts).length}</div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '4px solid #6c757d'
            }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Resources</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Object.keys(auditSummary.resourceCounts).length}</div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ marginTop: 0 }}>Top Actions</h5>
            <div style={{ display: 'grid', gap: '4px' }}>
              {Object.entries(auditSummary.actionCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([action, count]) => (
                  <div key={action} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '3px',
                    fontSize: '12px'
                  }}>
                    <span>{action}</span>
                    <span style={{ fontWeight: 'bold' }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h5 style={{ marginTop: 0 }}>Recent Events</h5>
            <div style={{
              maxHeight: '250px',
              overflowY: 'auto',
              fontSize: '12px',
              display: 'grid',
              gap: '8px'
            }}>
              {auditLogs.length === 0 ? (
                <p style={{ color: '#999' }}>No audit logs available</p>
              ) : (
                auditLogs.map((log, index) => (
                  <div key={index} style={{
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '3px',
                    borderLeft: '2px solid #007bff'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{log.action}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>
                      {new Date(log.timestamp).toLocaleTimeString()} • {log.resource}
                    </div>
                    {log.details && (
                      <div style={{ color: '#999', fontSize: '10px', marginTop: '2px' }}>
                        {JSON.stringify(log.details).substring(0, 60)}...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backups' && (
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0 }}>Backup Status</h4>
          <p style={{ color: '#999', fontSize: '12px' }}>Backup health information will be displayed here when backups are created and verified.</p>
        </div>
      )}

      {activeTab === 'health' && (
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0 }}>System Health</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Storage Usage</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>N/A MB</div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Memory Usage</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>N/A MB</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ObservabilityDashboard
