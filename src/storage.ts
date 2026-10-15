import { CustomAudioClip, SaveData } from './types';

const SAVE_KEY = 'commuter_rage_save_v1';
const DB_NAME = 'CommuterRageAudioDB';
const STORE_NAME = 'custom_swears';

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        highScore: parsed.highScore ?? 0,
        coffeeBeans: parsed.coffeeBeans ?? 0,
        totalSwearsLifetime: parsed.totalSwearsLifetime ?? 0,
        unlockedSkins: Array.isArray(parsed.unlockedSkins) ? parsed.unlockedSkins : ['default_dave'],
        selectedSkin: parsed.selectedSkin ?? 'default_dave',
        censorMode: parsed.censorMode ?? 'uncensored',
      };
    }
  } catch (e) {
    console.warn('Failed to load save data:', e);
  }
  return {
    highScore: 0,
    coffeeBeans: 0,
    totalSwearsLifetime: 0,
    unlockedSkins: ['default_dave'],
    selectedSkin: 'default_dave',
    censorMode: 'uncensored',
  };
}

export function writeSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to write save data:', e);
  }
}

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStoredAudioClips(): Promise<CustomAudioClip[]> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result || [];
        const clips: CustomAudioClip[] = rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          label: row.label || row.name.replace(/\.[^/.]+$/, '').toUpperCase(),
          blob: row.blob,
          url: URL.createObjectURL(row.blob),
          enabled: row.enabled !== false,
          createdAt: row.createdAt || Date.now(),
        }));
        clips.sort((a, b) => b.createdAt - a.createdAt);
        resolve(clips);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB load error:', e);
    return [];
  }
}

export async function saveAudioClipToDB(clip: Omit<CustomAudioClip, 'url'>): Promise<CustomAudioClip> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id: clip.id,
      name: clip.name,
      label: clip.label,
      blob: clip.blob,
      enabled: clip.enabled,
      createdAt: clip.createdAt,
    });
    tx.oncomplete = () => {
      resolve({
        ...clip,
        url: URL.createObjectURL(clip.blob),
      });
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAudioClipFromDB(id: string): Promise<void> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
