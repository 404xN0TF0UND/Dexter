// Security utilities for data encryption, privacy controls, and audit logging
// Uses Web Crypto API for secure encryption/decryption

export interface EncryptionKey {
  key: CryptoKey;
  keyId: string;
  created: number;
}

export interface PrivacySettings {
  dataEncryption: boolean;
  analyticsEnabled: boolean;
  crashReporting: boolean;
  dataSharing: boolean;
  autoBackup: boolean;
  retentionPeriod: number; // days, 0 = unlimited
  passwordProtectionEnabled: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  resource: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Default privacy settings
export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  dataEncryption: true,
  analyticsEnabled: false,
  crashReporting: false,
  dataSharing: false,
  autoBackup: true,
  retentionPeriod: 365, // 1 year
  passwordProtectionEnabled: false,
};

// Key management constants
const KEY_STORAGE_KEY = 'giac-encryption-keys';
const MASTER_KEY_SALT = 'giac-master-key-salt';
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// Privacy settings storage
const PRIVACY_SETTINGS_KEY = 'giac-privacy-settings';
const PRIVACY_POLICY_KEY = 'giac-privacy-policy-accepted';
const PRIVACY_POLICY_VERSION_KEY = 'giac-privacy-policy-version';
const PASSWORD_PROTECTION_KEY = 'giac-password-protection-enabled';
const PASSWORD_HASH_KEY = 'giac-password-hash';
const PASSWORD_SALT_KEY = 'giac-password-salt';

// Audit log storage
const AUDIT_LOG_KEY = 'giac-audit-log';

// Data sanitization utilities
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';

  // Remove potentially dangerous characters and scripts
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

export const sanitizeEntry = (entry: any): any => {
  if (!entry || typeof entry !== 'object') return entry;

  const sanitized = { ...entry };

  // Sanitize string fields
  const stringFields = ['term', 'category', 'notes', 'bookTitle'];
  stringFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = sanitizeInput(sanitized[field]);
    }
  });

  // Sanitize tags array
  if (Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags.map((tag: string) => sanitizeInput(tag)).filter((tag: string) => tag.length > 0);
  }

  return sanitized;
};

// Encryption key management
export const generateMasterKey = async (password?: string): Promise<CryptoKey> => {
  const salt = password ? await getSaltFromPassword(password) : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    salt as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    } as Pbkdf2Params,
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH } as AesDerivedKeyParams,
    false,
    ['encrypt', 'decrypt']
  );
};

export const getSaltFromPassword = async (password: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + MASTER_KEY_SALT);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash.slice(0, 16));
};

export const generateDataEncryptionKey = async (): Promise<EncryptionKey> => {
  const key = await crypto.subtle.generateKey(
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  const keyId = crypto.randomUUID();

  return {
    key,
    keyId,
    created: Date.now()
  };
};

export const exportKey = async (key: CryptoKey): Promise<string> => {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

export const importKey = async (keyData: string): Promise<CryptoKey> => {
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

export const storeEncryptionKey = async (encryptionKey: EncryptionKey): Promise<void> => {
  const keys = await loadEncryptionKeys();
  const existingIndex = keys.findIndex(k => k.keyId === encryptionKey.keyId);

  if (existingIndex >= 0) {
    keys[existingIndex] = encryptionKey;
  } else {
    keys.push(encryptionKey);
  }

  // Keep only the 5 most recent keys
  keys.sort((a, b) => b.created - a.created);
  if (keys.length > 5) {
    keys.splice(5);
  }

  const keyData = await Promise.all(
    keys.map(async k => ({
      keyId: k.keyId,
      keyData: await exportKey(k.key),
      created: k.created
    }))
  );

  localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(keyData));
};

export const loadEncryptionKeys = async (): Promise<EncryptionKey[]> => {
  const data = localStorage.getItem(KEY_STORAGE_KEY);
  if (!data) return [];

  try {
    const keyData = JSON.parse(data);
    const keys = await Promise.all(
      keyData.map(async (k: any) => ({
        key: await importKey(k.keyData),
        keyId: k.keyId,
        created: k.created
      }))
    );
    return keys;
  } catch (error) {
    console.error('Failed to load encryption keys:', error);
    return [];
  }
};

export const getLatestEncryptionKey = async (): Promise<EncryptionKey | null> => {
  const keys = await loadEncryptionKeys();
  return keys.length > 0 ? keys[0]! : null;
};

// Data encryption/decryption
export const encryptData = async (data: any, key?: CryptoKey): Promise<string> => {
  const encryptionKey = key || (await getLatestEncryptionKey())?.key;
  if (!encryptionKey) {
    throw new Error('No encryption key available');
  }

  const encoder = new TextEncoder();
  const dataString = JSON.stringify(data);
  const dataBytes = encoder.encode(dataString);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    encryptionKey,
    dataBytes
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
};

export const decryptData = async (encryptedData: string, key?: CryptoKey): Promise<any> => {
  const encryptionKey = key || (await getLatestEncryptionKey())?.key;
  if (!encryptionKey) {
    throw new Error('No encryption key available');
  }

  try {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      encryptionKey,
      encrypted
    );

    const decoder = new TextDecoder();
    const dataString = decoder.decode(decrypted);
    return JSON.parse(dataString);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

// Secure localStorage wrapper
export const secureSetItem = async (key: string, data: any): Promise<void> => {
  const settings = getPrivacySettings();
  if (!settings.dataEncryption) {
    localStorage.setItem(key, JSON.stringify(data));
    return;
  }

  try {
    const encrypted = await encryptData(data);
    localStorage.setItem(key, encrypted);
    await logAuditEvent('data_stored', key);
  } catch (error) {
    console.error('Failed to encrypt and store data:', error);
    // Fallback to unencrypted storage if encryption fails
    localStorage.setItem(key, JSON.stringify(data));
  }
};

export const secureGetItem = async (key: string): Promise<any | null> => {
  const data = localStorage.getItem(key);
  if (!data) return null;

  const settings = getPrivacySettings();
  if (!settings.dataEncryption) {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  try {
    const decrypted = await decryptData(data);
    await logAuditEvent('data_accessed', key);
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt data, attempting fallback:', error);
    // Fallback to unencrypted parsing
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
};

export const secureRemoveItem = async (key: string): Promise<void> => {
  localStorage.removeItem(key);
  await logAuditEvent('data_deleted', key);
};

// Privacy settings management
export const getPrivacySettings = (): PrivacySettings => {
  const data = localStorage.getItem(PRIVACY_SETTINGS_KEY);
  if (!data) return DEFAULT_PRIVACY_SETTINGS;

  try {
    return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_PRIVACY_SETTINGS;
  }
};

export const updatePrivacySettings = (settings: Partial<PrivacySettings>): void => {
  const current = getPrivacySettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(updated));
  logAuditEvent('privacy_settings_updated', 'privacy_settings', settings);
};

export const isPrivacyPolicyAccepted = (): boolean => {
  return localStorage.getItem(PRIVACY_POLICY_KEY) === 'true';
};

export const acceptPrivacyPolicy = (version: string = '1.0'): void => {
  localStorage.setItem(PRIVACY_POLICY_KEY, 'true');
  localStorage.setItem(PRIVACY_POLICY_VERSION_KEY, version);
  logAuditEvent('privacy_policy_accepted', 'privacy_policy', { version });
};

export const isPasswordProtectionEnabled = (): boolean => {
  return localStorage.getItem(PASSWORD_PROTECTION_KEY) === 'true';
};

export const hashPassword = async (password: string, salt: Uint8Array): Promise<string> => {
  const encoder = new TextEncoder();
  const data = new Uint8Array(salt.length + encoder.encode(password).length);
  data.set(salt, 0);
  data.set(encoder.encode(password), salt.length);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
};

export const enablePasswordProtection = async (password: string): Promise<void> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  localStorage.setItem(PASSWORD_PROTECTION_KEY, 'true');
  localStorage.setItem(PASSWORD_HASH_KEY, hash);
  localStorage.setItem(PASSWORD_SALT_KEY, btoa(String.fromCharCode(...salt)));
  updatePrivacySettings({ passwordProtectionEnabled: true });
  await logAuditEvent('password_protection_enabled', 'security');
};

export const verifyPassword = async (password: string): Promise<boolean> => {
  const saltString = localStorage.getItem(PASSWORD_SALT_KEY);
  const hash = localStorage.getItem(PASSWORD_HASH_KEY);
  if (!saltString || !hash) return false;

  const salt = Uint8Array.from(atob(saltString), c => c.charCodeAt(0));
  const attempt = await hashPassword(password, salt);
  return attempt === hash;
};

export const disablePasswordProtection = async (): Promise<void> => {
  localStorage.removeItem(PASSWORD_PROTECTION_KEY);
  localStorage.removeItem(PASSWORD_HASH_KEY);
  localStorage.removeItem(PASSWORD_SALT_KEY);
  updatePrivacySettings({ passwordProtectionEnabled: false });
  await logAuditEvent('password_protection_disabled', 'security');
};

// Audit logging
export const logAuditEvent = async (action: string, resource: string, details?: any): Promise<void> => {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action,
    resource,
    details,
    userAgent: navigator.userAgent
  };

  const logs = await getAuditLogs();
  logs.push(entry);

  // Keep only last 1000 entries
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }

  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const data = localStorage.getItem(AUDIT_LOG_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const getAuditSummary = async () => {
  const logs = await getAuditLogs();
  const actionCounts: Record<string, number> = {};
  const resourceCounts: Record<string, number> = {};

  logs.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    resourceCounts[log.resource] = (resourceCounts[log.resource] || 0) + 1;
  });

  return {
    total: logs.length,
    actionCounts,
    resourceCounts,
    recent: logs.slice(-5).reverse()
  };
};

export const clearAuditLogs = async (): Promise<void> => {
  localStorage.removeItem(AUDIT_LOG_KEY);
  await logAuditEvent('audit_logs_cleared', 'audit_log');
};

export const cleanupAuditLogs = async (retentionDays: number): Promise<number> => {
  if (retentionDays <= 0) {
    return 0;
  }

  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const logs = await getAuditLogs();
  const preserved = logs.filter(log => log.timestamp >= threshold);
  const removedCount = logs.length - preserved.length;

  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(preserved));
  await logAuditEvent('audit_logs_pruned', 'audit_log', { retentionDays, removedCount });
  return removedCount;
};

// Data export/deletion
export const exportAllData = async (): Promise<string> => {
  const data: any = {};

  // Get all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('giac-')) {
      try {
        const value = await secureGetItem(key);
        data[key] = value;
      } catch {
        // If decryption fails, include raw data
        data[key] = localStorage.getItem(key);
      }
    }
  }

  return JSON.stringify({
    exportDate: new Date().toISOString(),
    version: '1.0',
    data
  }, null, 2);
};

export const deleteAllData = async (): Promise<void> => {
  const keysToDelete: string[] = [];

  // Collect all giac-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('giac-')) {
      keysToDelete.push(key);
    }
  }

  // Delete keys
  keysToDelete.forEach(key => {
    localStorage.removeItem(key);
  });

  await logAuditEvent('all_data_deleted', 'all_data');
};

// Secure token storage for Google Drive
export const storeSecureToken = async (token: string, service: string = 'google-drive'): Promise<void> => {
  const key = `giac-token-${service}`;
  await secureSetItem(key, {
    token,
    stored: Date.now(),
    service
  });
};

export const getSecureToken = async (service: string = 'google-drive'): Promise<string | null> => {
  const key = `giac-token-${service}`;
  const data = await secureGetItem(key);
  return data?.token || null;
};

export const clearSecureToken = async (service: string = 'google-drive'): Promise<void> => {
  const key = `giac-token-${service}`;
  await secureRemoveItem(key);
};

// Initialize encryption on first use
export const initializeEncryption = async (): Promise<void> => {
  const existingKeys = await loadEncryptionKeys();
  if (existingKeys.length === 0) {
    const newKey = await generateDataEncryptionKey();
    await storeEncryptionKey(newKey);
  }
};