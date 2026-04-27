import React, { useState, useEffect } from 'react';
import {
  getPrivacySettings,
  updatePrivacySettings,
  exportAllData,
  deleteAllData,
  getAuditLogs,
  clearAuditLogs,
  type PrivacySettings as PrivacySettingsType
} from './security';

interface PrivacySettingsProps {
  onClose: () => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<PrivacySettingsType>({
    dataEncryption: true,
    analyticsEnabled: false,
    crashReporting: false,
    dataSharing: false,
    autoBackup: true,
    retentionPeriod: 365,
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const currentSettings = getPrivacySettings();
      setSettings(currentSettings);
    };
    loadSettings();
  }, []);

  const handleSettingChange = (key: keyof PrivacySettingsType, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updatePrivacySettings({ [key]: value });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `giac-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAllData();
      alert('All data has been deleted. The app will reload.');
      window.location.reload();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewAuditLogs = async () => {
    if (!showAuditLogs) {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    }
    setShowAuditLogs(!showAuditLogs);
  };

  const handleClearAuditLogs = async () => {
    if (confirm('Are you sure you want to clear all audit logs?')) {
      await clearAuditLogs();
      setAuditLogs([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Privacy & Security Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Data Encryption */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Data Protection</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.dataEncryption}
                    onChange={(e) => handleSettingChange('dataEncryption', e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium">Enable Data Encryption</span>
                    <p className="text-sm text-gray-600">Encrypt all stored data using Web Crypto API</p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.autoBackup}
                    onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium">Automatic Backups</span>
                    <p className="text-sm text-gray-600">Automatically backup data to Google Drive</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Data Retention */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Data Retention</h3>
              <div>
                <label className="block mb-2">
                  <span className="font-medium">Data Retention Period (days)</span>
                  <p className="text-sm text-gray-600">How long to keep old data (0 = unlimited)</p>
                </label>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={settings.retentionPeriod}
                  onChange={(e) => handleSettingChange('retentionPeriod', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Analytics & Reporting */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Analytics & Reporting</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.analyticsEnabled}
                    onChange={(e) => handleSettingChange('analyticsEnabled', e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium">Enable Analytics</span>
                    <p className="text-sm text-gray-600">Help improve the app by sharing usage statistics</p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.crashReporting}
                    onChange={(e) => handleSettingChange('crashReporting', e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium">Crash Reporting</span>
                    <p className="text-sm text-gray-600">Automatically report crashes to help fix bugs</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Data Sharing */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Data Sharing</h3>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.dataSharing}
                  onChange={(e) => handleSettingChange('dataSharing', e.target.checked)}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Allow Data Sharing</span>
                  <p className="text-sm text-gray-600">Share anonymized data to improve features</p>
                </div>
              </label>
            </div>

            {/* Data Management */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Data Management</h3>
              <div className="space-y-3">
                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {isExporting ? 'Exporting...' : 'Export All Data'}
                </button>

                <button
                  onClick={handleDeleteAllData}
                  disabled={isDeleting}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete All Data'}
                </button>
              </div>
            </div>

            {/* Audit Logs */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Security Audit</h3>
              <div className="space-y-3">
                <button
                  onClick={handleViewAuditLogs}
                  className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  {showAuditLogs ? 'Hide' : 'View'} Audit Logs
                </button>

                {showAuditLogs && (
                  <div className="mt-4">
                    <div className="max-h-60 overflow-y-auto border rounded-md p-3 bg-gray-50">
                      {auditLogs.length === 0 ? (
                        <p className="text-gray-500">No audit logs available</p>
                      ) : (
                        auditLogs.slice().reverse().map((log, index) => (
                          <div key={index} className="text-sm mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                            <div className="font-medium">{log.action}</div>
                            <div className="text-gray-600">
                              {new Date(log.timestamp).toLocaleString()} - {log.resource}
                            </div>
                            {log.details && (
                              <div className="text-xs text-gray-500 mt-1">
                                {JSON.stringify(log.details)}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {auditLogs.length > 0 && (
                      <button
                        onClick={handleClearAuditLogs}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Clear Audit Logs
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};