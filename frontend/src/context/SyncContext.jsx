import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getQueue, removeFromQueue } from '../api/offlineQueue';

export const SyncContext = createContext();

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update the count of pending items
  const refreshQueueCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  // The main synchronization function
  const syncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    
    setIsSyncing(true);
    const queue = await getQueue();

    for (const item of queue) {
      try {
        // Attempt to post the saved payload to the saved endpoint
        await api.post(item.endpoint, item.payload);
        // If successful, remove it from the local queue
        await removeFromQueue(item.id);
      } catch (err) {
        console.error(`Failed to sync item ${item.id}:`, err);
        // If the server rejects it (e.g., 400 Bad Request), you might want to 
        // handle conflict resolution here or flag it for manual review.
      }
    }
    
    await refreshQueueCount();
    setIsSyncing(false);
  }, [isSyncing, refreshQueueCount]);

  // Network event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncNow(); // Auto-sync when connection is restored
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial queue on mount
    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow, refreshQueueCount]);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, syncNow, refreshQueueCount }}>
      {children}
      
      {/* Global UI Banner for Offline/Sync Status */}
      {!isOnline && (
        <div style={{ background: '#f39c12', color: 'white', textAlign: 'center', padding: '10px', position: 'fixed', bottom: 0, width: '100%', zIndex: 1000 }}>
          <i className="fas fa-wifi-slash"></i> You are offline. Changes will be saved locally.
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div style={{ background: '#3498db', color: 'white', textAlign: 'center', padding: '10px', position: 'fixed', bottom: 0, width: '100%', zIndex: 1000 }}>
          <i className="fas fa-sync fa-spin"></i> Syncing {pendingCount} pending items...
        </div>
      )}
    </SyncContext.Provider>
  );
};