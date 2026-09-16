import { getAccessToken } from '../lib/firebase';

const DRIVE_FILE_NAME = 'fitpocket_data.json';
const DRIVE_FOLDER_NAME = 'FitPocketData';

export const DriveStorageService = {
  async findFile(): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

    const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  async createFile(content: string): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

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

    const data = await res.json();
    return data.id || null;
  },

  async updateFile(fileId: string, content: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) return;

    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: content,
    });
  },

  async readFile(fileId: string): Promise<string | null> {
    const token = await getAccessToken();
    if (!token) return null;

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;
    return await res.text();
  },

  async saveAllData(jsonContent: string): Promise<void> {
    try {
      let fileId = await this.findFile();
      if (fileId) {
        await this.updateFile(fileId, jsonContent);
      } else {
        await this.createFile(jsonContent);
      }
    } catch (e) {
      console.error('Failed to save to Drive:', e);
    }
  },

  async loadAllData(): Promise<string | null> {
    try {
      const fileId = await this.findFile();
      if (fileId) {
        return await this.readFile(fileId);
      }
      return null;
    } catch (e) {
      console.error('Failed to load from Drive:', e);
      return null;
    }
  }
};
