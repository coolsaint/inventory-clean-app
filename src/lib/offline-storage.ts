// Offline Storage for PWA functionality
export interface PendingSubmission {
  id: string;
  projectId: number;
  rackId?: number;
  notes?: string;
  scanLines: Array<{
    lotName: string;
    scannedQty: number;
    rackId?: number;
    notes?: string;
    timestamp: number;
  }>;
  createdAt: number;
  previousSubmissionId?: number;
}

export interface CachedLotInfo {
  lotName: string;
  locationId: number;
  data: any;
  cachedAt: number;
  expiresAt: number;
}

export interface SyncOperation {
  id: string;
  type: 'create_submission' | 'update_submission' | 'get_lot_info';
  data: any;
  createdAt: number;
  retryCount: number;
}

export interface AuthData {
  apiToken: string;
  salePersonInfo: any;
  runningProject: any;
  availableRacks: any[];
  expiresAt: number;
}

class OfflineStorage {
  private dbName = 'InventoryAppDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Pending submissions store
        if (!db.objectStoreNames.contains('pendingSubmissions')) {
          const submissionStore = db.createObjectStore('pendingSubmissions', { keyPath: 'id' });
          submissionStore.createIndex('projectId', 'projectId', { unique: false });
          submissionStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Cached lot info store
        if (!db.objectStoreNames.contains('cachedLotInfo')) {
          const lotStore = db.createObjectStore('cachedLotInfo', { keyPath: 'lotName' });
          lotStore.createIndex('locationId', 'locationId', { unique: false });
          lotStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Auth data store
        if (!db.objectStoreNames.contains('authData')) {
          db.createObjectStore('authData', { keyPath: 'key' });
        }
      };
    });
  }

  // Pending Submissions
  async savePendingSubmission(submission: PendingSubmission): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingSubmissions'], 'readwrite');
      const store = transaction.objectStore('pendingSubmissions');
      const request = store.put(submission);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSubmissions(): Promise<PendingSubmission[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingSubmissions'], 'readonly');
      const store = transaction.objectStore('pendingSubmissions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePendingSubmission(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingSubmissions'], 'readwrite');
      const store = transaction.objectStore('pendingSubmissions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cached Lot Info
  async cacheLotInfo(lotInfo: CachedLotInfo): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedLotInfo'], 'readwrite');
      const store = transaction.objectStore('cachedLotInfo');
      const request = store.put(lotInfo);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedLotInfo(lotName: string): Promise<CachedLotInfo | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedLotInfo'], 'readonly');
      const store = transaction.objectStore('cachedLotInfo');
      const request = store.get(lotName);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiresAt > Date.now()) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Sync Queue
  async queueForSync(operation: SyncOperation): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.put(operation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<SyncOperation[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeSyncOperation(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Auth Data
  async saveAuthData(authData: AuthData): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['authData'], 'readwrite');
      const store = transaction.objectStore('authData');
      const request = store.put({ key: 'auth', ...authData });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAuthData(): Promise<AuthData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['authData'], 'readonly');
      const store = transaction.objectStore('authData');
      const request = store.get('auth');

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiresAt > Date.now()) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAuthData(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['authData'], 'readwrite');
      const store = transaction.objectStore('authData');
      const request = store.delete('auth');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cleanup expired data
  async cleanup(): Promise<void> {
    if (!this.db) await this.init();

    const now = Date.now();

    // Clean expired lot info
    const lotTransaction = this.db!.transaction(['cachedLotInfo'], 'readwrite');
    const lotStore = lotTransaction.objectStore('cachedLotInfo');
    const lotIndex = lotStore.index('expiresAt');
    const lotRange = IDBKeyRange.upperBound(now);
    lotIndex.openCursor(lotRange).onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Clean old sync operations (older than 7 days)
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const syncTransaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const syncStore = syncTransaction.objectStore('syncQueue');
    const syncIndex = syncStore.index('createdAt');
    const syncRange = IDBKeyRange.upperBound(weekAgo);
    syncIndex.openCursor(syncRange).onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }
}

// Create singleton instance
export const offlineStorage = new OfflineStorage();

// Initialize on app start
offlineStorage.init().catch(console.error);

// Cleanup expired data periodically
setInterval(() => {
  offlineStorage.cleanup().catch(console.error);
}, 60 * 60 * 1000); // Every hour

// Sync Service for handling offline data synchronization
export class SyncService {
  private isProcessing = false;

  async processPendingSubmissions(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;

    this.isProcessing = true;

    try {
      const pendingSubmissions = await offlineStorage.getPendingSubmissions();

      for (const submission of pendingSubmissions) {
        try {
          const { apiClient } = await import('./api');

          const scanLines = submission.scanLines.map(line => ({
            lot_name: line.lotName,
            scanned_qty: line.scannedQty,
            notes: line.notes
          }));

          const response = await apiClient.createSubmission({
            api_token: '', // Will be added by interceptor
            project_id: submission.projectId,
            rack_id: submission.rackId,
            notes: submission.notes,
            scan_lines: scanLines
          });

          if (response.success) {
            await offlineStorage.deletePendingSubmission(submission.id);
            console.log(`Successfully synced submission ${submission.id}`);
          } else {
            console.error(`Failed to sync submission ${submission.id}:`, response.error);
          }
        } catch (error) {
          console.error(`Error syncing submission ${submission.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing pending submissions:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async startAutoSync(): Promise<void> {
    // Process pending submissions when coming online
    window.addEventListener('online', () => {
      setTimeout(() => this.processPendingSubmissions(), 1000);
    });

    // Process pending submissions periodically if online
    setInterval(() => {
      if (navigator.onLine) {
        this.processPendingSubmissions();
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Initial sync if online
    if (navigator.onLine) {
      setTimeout(() => this.processPendingSubmissions(), 2000);
    }
  }
}

// Create singleton sync service
export const syncService = new SyncService();
