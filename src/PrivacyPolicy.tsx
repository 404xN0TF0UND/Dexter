import React, { useState } from 'react';
import { updatePrivacySettings } from './security';

interface PrivacyPolicyProps {
  onAccept: () => void;
  onDecline: () => void;
  required?: boolean;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onAccept, onDecline, required = false }) => {
  const [acceptedAnalytics, setAcceptedAnalytics] = useState(false);
  const [acceptedDataSharing, setAcceptedDataSharing] = useState(false);

  const handleAccept = () => {
    updatePrivacySettings({
      analyticsEnabled: acceptedAnalytics,
      dataSharing: acceptedDataSharing,
    });
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Privacy Policy</h2>
            {!required && (
              <button
                onClick={onDecline}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            )}
          </div>

          <div className="prose max-w-none text-gray-700 space-y-4">
            <p className="text-lg">
              <strong>GIAC Book Indexer</strong> is committed to protecting your privacy and ensuring the security of your data.
            </p>

            <h3 className="text-xl font-semibold mt-6">Data Collection & Storage</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>We store your study entries, session data, and application settings locally on your device.</li>
              <li>All sensitive data is encrypted using industry-standard AES-256 encryption.</li>
              <li>Data is never transmitted to our servers unless you explicitly enable optional features.</li>
              <li>We do not collect personally identifiable information without your consent.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6">Data Security</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>All data is encrypted before storage using the Web Crypto API.</li>
              <li>Encryption keys are managed securely and never stored in plain text.</li>
              <li>Google Drive integration uses secure OAuth 2.0 authentication.</li>
              <li>All user inputs are sanitized to prevent security vulnerabilities.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6">Optional Analytics</h3>
            <p>
              To help us improve the application, you can optionally enable analytics and crash reporting:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Analytics:</strong> Anonymous usage statistics to understand how features are used.</li>
              <li><strong>Crash Reporting:</strong> Automatic reports of application errors to help fix bugs.</li>
              <li>All analytics data is anonymized and cannot be used to identify individual users.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6">Data Sharing</h3>
            <p>
              You can optionally allow anonymized data sharing to improve our services:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Shared data includes study patterns and feature usage statistics.</li>
              <li>No personal information or study content is ever shared.</li>
              <li>Data sharing helps us understand which features are most valuable.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6">Your Rights</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> You can export all your data at any time.</li>
              <li><strong>Deletion:</strong> You can delete all your data permanently.</li>
              <li><strong>Control:</strong> You can change your privacy settings at any time.</li>
              <li><strong>Transparency:</strong> All data access is logged in audit logs you can review.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6">Third-Party Services</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Google Drive:</strong> Used only for backup purposes with your explicit permission.</li>
              <li><strong>Web Crypto API:</strong> Browser-native encryption, no external services.</li>
              <li>We do not use cookies or tracking pixels.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6">Data Retention</h3>
            <p>
              You can configure how long data is retained. By default, data is kept indefinitely unless you choose to delete it.
              Audit logs are kept for security purposes but can be cleared by you at any time.
            </p>

            <h3 className="text-xl font-semibold mt-6">Contact</h3>
            <p>
              If you have questions about this privacy policy or our data practices, please contact us through the application settings.
            </p>

            <h3 className="text-xl font-semibold mt-6">Changes to This Policy</h3>
            <p>
              We may update this privacy policy as features are added. You will be notified of significant changes.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t space-y-4">
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptedAnalytics}
                  onChange={(e) => setAcceptedAnalytics(e.target.checked)}
                  className="mr-3"
                />
                <span>I agree to share anonymous analytics and crash reports to help improve the application.</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={acceptedDataSharing}
                  onChange={(e) => setAcceptedDataSharing(e.target.checked)}
                  className="mr-3"
                />
                <span>I agree to share anonymized study patterns to help improve features.</span>
              </label>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleAccept}
                className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-md hover:bg-blue-600 font-medium"
              >
                Accept & Continue
              </button>
              {!required && (
                <button
                  onClick={onDecline}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-md hover:bg-gray-300 font-medium"
                >
                  Decline
                </button>
              )}
            </div>

            {required && (
              <p className="text-sm text-gray-600 text-center">
                You must accept the privacy policy to use this application.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};