import { getAccessToken } from '../lib/firebase';

const DRIVE_FILE_NAME = 'fitpocket_data.json';

const clearExpiredToken = () => {
  localStorage.removeItem('fitpocket_google_access_token');
};

export const DriveStorageService = {
  async findFile(): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

    try {
      const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        clearExpiredToken();
        console.warn('Google Drive token expired or ungranted.');
        return null;
      }

      if (!res.ok) return null;
      const data = await res.json();
      return data.files && data.files.length > 0 ? data.files[0].id : null;
    } catch (e) {
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
      return data.id || null;
    } catch (e) {
      console.warn('Google Drive createFile network notice:', e);
      return null;
    }
  },

  async updateFile(fileId: string, content: string): Promise<boolean> {
    const token = await getAccessToken();
    if (!token) return false;

    try {
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
