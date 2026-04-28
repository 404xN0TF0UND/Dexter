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

interface TabDefinition {
  id: 'security' | 'privacy' | 'settings' | 'audit';
  label: string;
  icon: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'security' | 'privacy' | 'settings' | 'audit'>('security');
  const [settings, setSettings] = useState<PrivacySettingsType>({
    dataEncryption: true,
    analyticsEnabled: false,
    crashReporting: false,
    dataSharing: false,
    autoBackup: true,
    retentionPeriod: 365,
    passwordProtectionEnabled: false,
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const tabs: TabDefinition[] = [
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'privacy', label: 'Privacy', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'audit', label: 'Audit', icon: '📋' }
  ];

  useEffect(() => {
    const loadSettings = async () => {
      const currentSettings = getPrivacySettings();
      setSettings(currentSettings);
      const logs = await getAuditLogs();
      setAuditLogs(logs);
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

  const handleClearAuditLogs = async () => {
    if (confirm('Are you sure you want to clear all audit logs?')) {
      await clearAuditLogs();
      setAuditLogs([]);
    }
  };

  const SettingToggle: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description: string;
  }> = ({ checked, onChange, label, description }) => (
    <label className="flex items-start p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 mr-3 w-4 h-4"
      />
      <div className="flex-1">
        <span className="font-medium text-gray-900">{label}</span>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Privacy & Security</h2>
            <p className="text-sm text-gray-600 mt-1">Manage your data and privacy preferences</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl transition"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 rounded-t-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  🔒 These settings control how your data is protected and secured.
                </p>
              </div>

              <div className="space-y-2 border rounded-lg divide-y">
                <SettingToggle
                  checked={settings.dataEncryption}
                  onChange={(value) => handleSettingChange('dataEncryption', value)}
                  label="Data Encryption"
                  description="Encrypt all stored data using Web Crypto API (AES-256-GCM)"
                />
                <SettingToggle
                  checked={settings.passwordProtectionEnabled}
                  onChange={(value) => handleSettingChange('passwordProtectionEnabled', value)}
                  label="Password Protection"
                  description="Require password to access the application"
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                <p className="text-sm font-medium text-green-900 mb-2">✓ Security Status</p>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Encryption: {settings.dataEncryption ? '✓ Enabled' : '✗ Disabled'}</li>
                  <li>• Password Protection: {settings.passwordProtectionEnabled ? '✓ Enabled' : '✗ Disabled'}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-900">
                  📊 Control what data is collected and how it's used to improve your experience.
                </p>
              </div>

              <div className="space-y-2 border rounded-lg divide-y">
                <SettingToggle
                  checked={settings.analyticsEnabled}
                  onChange={(value) => handleSettingChange('analyticsEnabled', value)}
                  label="Usage Analytics"
                  description="Help improve the app by sharing anonymized usage patterns"
                />
                <SettingToggle
                  checked={settings.crashReporting}
                  onChange={(value) => handleSettingChange('crashReporting', value)}
                  label="Crash Reporting"
                  description="Automatically report errors to help us fix bugs faster"
                />
                <SettingToggle
                  checked={settings.dataSharing}
                  onChange={(value) => handleSettingChange('dataSharing', value)}
                  label="Feature Improvement Data"
                  description="Share anonymized data to help develop better features"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                <p className="text-sm font-medium text-amber-900 mb-2">ℹ️ Your Privacy</p>
                <p className="text-sm text-amber-800">
                  All data sharing is anonymized and used only to improve your experience. Your personal data is never sold.
                </p>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-cyan-900">
                  ⚙️ Configure automatic backup and data retention settings.
                </p>
              </div>

              <div className="space-y-2 border rounded-lg divide-y">
                <SettingToggle
                  checked={settings.autoBackup}
                  onChange={(value) => handleSettingChange('autoBackup', value)}
                  label="Automatic Backups"
                  description="Automatically backup data to Google Drive"
                />
              </div>

              <div className="mt-6">
                <label className="block">
                  <span className="font-medium text-gray-900 mb-2 block">Data Retention Period</span>
                  <p className="text-sm text-gray-600 mb-3">How long to keep historical data (0 = unlimited)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="3650"
                      value={settings.retentionPeriod}
                      onChange={(e) => handleSettingChange('retentionPeriod', parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="text-gray-600">days</span>
                  </div>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-sm font-medium text-blue-900 mb-2">💡 Recommended Settings</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Auto Backup: {settings.autoBackup ? '✓ Enabled' : 'Disabled'}</li>
                  <li>• Retention Period: {settings.retentionPeriod} days</li>
                </ul>
              </div>
            </div>
          )}

          {/* Audit Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-900">
                  📋 View your security audit log. All important actions are logged automatically.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClearAuditLogs}
                  disabled={auditLogs.length === 0}
                  className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
                >
                  Clear Logs
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg bg-gray-50">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">No audit logs available</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {auditLogs
                      .slice()
                      .reverse()
                      .map((log, index) => (
                        <div key={index} className="p-4 hover:bg-gray-100 transition">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{log.action}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                📌 {log.resource}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(log.timestamp).toLocaleString()}
                              </div>
                              {log.details && (
                                <div className="text-xs text-gray-500 mt-2 bg-gray-200 p-2 rounded font-mono">
                                  {JSON.stringify(log.details, null, 2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 disabled:opacity-50 transition font-medium text-sm"
            >
              {isExporting ? '⏳ Exporting...' : '💾 Export Data'}
            </button>
            <button
              onClick={handleDeleteAllData}
              disabled={isDeleting}
              className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 disabled:opacity-50 transition font-medium text-sm"
            >
              {isDeleting ? '⏳ Deleting...' : '🗑️ Delete All'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-300 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-400 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};