// Simple encryption utility for API key protection in cloud backups
export function encryptApiKey(key: string): string {
  if (!key) return '';
  try {
    const encoded = btoa(encodeURIComponent(key));
    return `enc_${encoded}`;
  } catch (e) {
    return key;
  }
}

export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return '';
  try {
    if (encrypted && encrypted.startsWith('enc_')) {
      const raw = encrypted.replace('enc_', '');
      return decodeURIComponent(atob(raw));
    }
    return encrypted; // Fallback for unencrypted legacy keys
  } catch (e) {
    return encrypted;
  }
}
