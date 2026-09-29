import { getAccessToken, clearGoogleAccessToken } from '../lib/firebase';

const DRIVE_FILE_NAME = 'NutraiFit_Backup.json';
const LEGACY_DRIVE_FILE_NAME = 'fitpocket_data.json';

let cachedFileId: string | null = null;

const clearExpiredToken = () => {
  cachedFileId = null;
  clearGoogleAccessToken();
};

export const DriveStorageService = {
  async findFile(): Promise<string | null> {
    if (cachedFileId) return cachedFileId;

    const token = await getAccessToken();
    if (!token) {
      console.warn('Drive findFile: No access token found');
      return null;
    }

    try {
      // 1. Search for the new backup filename 'NutraiFit_Backup.json'
      const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)&spaces=drive`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        clearExpiredToken();
        console.warn('Google Drive token expired or unauthorized (401/403).');
        throw new Error('AUTH_ERROR');
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error('Drive findFile error:', res.status, errText);
        return null;
      }
      
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        cachedFileId = data.files[0].id;
        return cachedFileId;
      }

      // 2. If not found, search for the legacy backup filename 'fitpocket_data.json' for seamless migration
      const legacyQuery = encodeURIComponent(`name = '${LEGACY_DRIVE_FILE_NAME}' and trashed = false`);
      const legacyRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${legacyQuery}&fields=files(id, name)&spaces=drive`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (legacyRes.ok) {
        const legacyData = await legacyRes.json();
        if (legacyData.files && legacyData.files.length > 0) {
          const legacyFileId = legacyData.files[0].id;
          console.log(`[Drive Migrate] Found legacy backup file (${LEGACY_DRIVE_FILE_NAME}), starting automatic rename to ${DRIVE_FILE_NAME}...`);

          // 3. Perform in-place PATCH rename to preserve file ID and data
          const renameRes = await fetch(`https://www.googleapis.com/drive/v3/files/${legacyFileId}`, {
            method: 'PATCH',
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: DRIVE_FILE_NAME }),
          });

          if (renameRes.ok) {
            console.log('[Drive Migrate] Backup file successfully renamed to NutraiFit_Backup.json!');
            cachedFileId = legacyFileId;
            return cachedFileId;
          } else {
            console.warn('[Drive Migrate] Failed to rename legacy file, returning legacy ID directly as fallback');
            cachedFileId = legacyFileId;
            return cachedFileId;
          }
        }
      }

      return null;
    } catch (e: any) {
      if (e.message === 'AUTH_ERROR') throw e;
      console.warn('Google Drive findFile network notice:', e);
      return null;
    }
  },

  async createFile(content: string): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

    try {
      const metadata = {
        name: DRIVE_FILE_NAME,
        mimeType: 'application/json',
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: 'application/json' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (res.status === 401 || res.status === 403) {
        clearExpiredToken();
        return null;
      }

      if (!res.ok) return null;
      const data = await res.json();
      if (data.id) {
        cachedFileId = data.id;
        return data.id;
      }
      return null;
    } catch (e) {
      console.warn('Google Drive createFile network notice:', e);
      return null;
    }
  },

  async updateFile(fileId: string, content: string): Promise<boolean> {
    const token = await getAccessToken();
    if (!token) return false;

    try {
      // Use spaces=drive for patch consistency
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: content,
      });

      if (res.status === 401 || res.status === 403) {
        clearExpiredToken();
        return false;
      }

      if (res.status === 404) {
        cachedFileId = null;
        return false;
      }

      return res.ok;
    } catch (e) {
      console.warn('Google Drive updateFile network notice:', e);
      return false;
    }
  },

  async readFile(fileId: string): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

    try {
      // Use alt=media to get the content, and ensure we're in the right space
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        clearExpiredToken();
        return null;
      }

      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      console.warn('Google Drive readFile network notice:', e);
      return null;
    }
  },

  async saveAllData(jsonContent: string): Promise<boolean> {
    try {
      const token = await getAccessToken();
      if (!token) return false;

      let fileId = await this.findFile();
      if (fileId) {
        return await this.updateFile(fileId, jsonContent);
      } else {
        const newId = await this.createFile(jsonContent);
        return !!newId;
      }
    } catch (e) {
      console.warn('Drive save notice:', e);
      return false;
    }
  },

  async loadAllData(): Promise<string | null> {
    try {
      const token = await getAccessToken();
      if (!token) return null;

      const fileId = await this.findFile();
      if (fileId) {
        return await this.readFile(fileId);
      }
      return null;
    } catch (e) {
      console.warn('Drive load notice:', e);
      return null;
    }
  }
};
