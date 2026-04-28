import React, { useState } from 'react';
import { acceptPrivacyPolicy, updatePrivacySettings } from './security';

interface PrivacyPolicyProps {
  onAccept: () => void;
  onDecline: () => void;
  required?: boolean;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onAccept, onDecline, required = false }) => {
  const [acceptedAnalytics, setAcceptedAnalytics] = useState(false);
  const [acceptedDataSharing, setAcceptedDataSharing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleAccept = () => {
    acceptPrivacyPolicy();
    updatePrivacySettings({
      analyticsEnabled: acceptedAnalytics,
      dataSharing: acceptedDataSharing,
    });
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold">Privacy Policy</h2>
              <p className="text-blue-100 mt-1">GIAC Book Indexer</p>
            </div>
            {!required && (
              <button
                onClick={onDecline}
                className="text-blue-100 hover:text-white text-2xl transition"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!showDetails ? (
            // Quick Overview
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-800">
                  Your privacy and data security are our top priorities. This quick summary explains how we handle your data.
                </p>
              </div>

              <div className="space-y-4">
                {/* Key Points */}
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                  <h3 className="font-semibold text-green-900 mb-2">✓ What We Protect</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• All data stays on your device by default</li>
                    <li>• Everything is encrypted with AES-256</li>
                    <li>• We never sell your personal information</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <h3 className="font-semibold text-blue-900 mb-2">📊 Optional Analytics</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Completely anonymous usage statistics</li>
                    <li>• Helps us fix bugs and improve features</li>
                    <li>• You can disable this anytime in settings</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                  <h3 className="font-semibold text-purple-900 mb-2">🔐 Your Control</h3>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Export all your data anytime</li>
                    <li>• Delete everything permanently</li>
                    <li>• View audit logs of all access</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setShowDetails(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
              >
                Read full policy →
              </button>
            </div>
          ) : (
            // Full Details
            <div className="p-6 space-y-4 text-gray-700">
              <button
                onClick={() => setShowDetails(false)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium underline mb-2"
              >
                ← Back to summary
              </button>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Collection & Storage</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Study entries, session data, and settings are stored locally on your device</li>
                  <li>All sensitive data is encrypted using AES-256</li>
                  <li>Data is never sent to servers unless you enable optional features</li>
                  <li>No personally identifiable information is collected without consent</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Security</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Encryption uses Web Crypto API with secure key management</li>
                  <li>Encryption keys are never stored in plain text</li>
                  <li>Google Drive integration uses OAuth 2.0 authentication</li>
                  <li>All user inputs are sanitized to prevent vulnerabilities</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Rights</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Access:</strong> Export all your data anytime</li>
                  <li><strong>Deletion:</strong> Delete all data permanently</li>
                  <li><strong>Control:</strong> Change privacy settings anytime</li>
                  <li><strong>Transparency:</strong> Review audit logs of all actions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Third-Party Services</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><strong>Google Drive:</strong> Backup only with your permission</li>
                  <li><strong>Web Crypto:</strong> Browser-native, no external services</li>
                  <li>No cookies or tracking pixels</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Retention</h3>
                <p className="text-sm">Data is kept indefinitely by default. You can change the retention period in Privacy Settings. Audit logs can be cleared anytime.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Settings & Actions */}
        <div className="border-t bg-gray-50 p-6 space-y-4">
          <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 text-sm">Help improve the app (optional):</h4>
            
            <label className="flex items-start p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedAnalytics}
                onChange={(e) => setAcceptedAnalytics(e.target.checked)}
                className="mt-1 mr-3 w-4 h-4"
              />
              <div>
                <span className="font-medium text-sm text-gray-900">Anonymous Analytics</span>
                <p className="text-xs text-gray-600 mt-0.5">Help us understand how you use the app</p>
              </div>
            </label>

            <label className="flex items-start p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedDataSharing}
                onChange={(e) => setAcceptedDataSharing(e.target.checked)}
                className="mt-1 mr-3 w-4 h-4"
              />
              <div>
                <span className="font-medium text-sm text-gray-900">Crash Reports</span>
                <p className="text-xs text-gray-600 mt-0.5">Automatically report errors to help us fix bugs</p>
              </div>
            </label>

            <p className="text-xs text-gray-500 px-2">💡 All data is anonymized. You can change these settings anytime.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition"
            >
              Accept & Continue
            </button>
            {!required && (
              <button
                onClick={onDecline}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-lg font-semibold transition"
              >
                Decline
              </button>
            )}
          </div>

          {required && (
            <p className="text-xs text-gray-600 text-center">
              You must accept the privacy policy to use this application.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};