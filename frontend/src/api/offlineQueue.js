import localforage from 'localforage';
import api from './axios'; // Import your axios instance

const syncQueue = localforage.createInstance({
  name: 'kicowasco',
  storeName: 'sync_queue'
});

// We need a store to remember Temp ID -> Real ID mappings
const idMappingStore = localforage.createInstance({
    name: 'kicowasco',
    storeName: 'id_mappings'
});

export const addToQueue = async (endpoint, payload, tempId = Date.now().toString(), parentTempId = null) => {
  const item = { 
      id: tempId, 
      endpoint, 
      payload, 
      parentTempId, // Keep track if this relies on a parent created offline
      timestamp: new Date().toISOString() 
  };
  await syncQueue.setItem(tempId, item);
  return item;
};

export const getQueue = async () => {
  const items = [];
  await syncQueue.iterate((value) => {
    items.push(value);
  });
  // Sort by oldest first to maintain submission order
  return items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

export const removeFromQueue = async (id) => {
  await syncQueue.removeItem(id);
};

export const clearQueue = async () => {
  await syncQueue.clear();
};

export const processQueue = async () => {
    const items = await getQueue();
    
    for (const item of items) {
        try {
            let finalPayload = { ...item.payload };

            // If this item depends on a parent created offline, swap the temp ID for the real one
            if (item.parentTempId) {
                const realParentId = await idMappingStore.getItem(item.parentTempId);
                if (realParentId) {
                    finalPayload.incident = realParentId; // or whatever the foreign key field is
                } else {
                    console.warn(`Parent ID not yet synced for item ${item.id}. Skipping for now.`);
                    continue; 
                }
            }

            const response = await api.post(item.endpoint, finalPayload);
            
            // If the backend returns the new Real ID, save it in our mapping store
            if (response.data && response.data.id) {
                await idMappingStore.setItem(item.id, response.data.id);
            }

            // Success! Remove from queue
            await removeFromQueue(item.id);

        } catch (error) {
            console.error(`Failed to sync item ${item.id}:`, error);
            // Break the loop if we hit a network error to preserve sequential order
            if (!error.response) break; 
        }
    }
};