import localforage from 'localforage';

// Initialize a dedicated store for our offline submissions
const syncQueue = localforage.createInstance({
  name: 'kicowasco',
  storeName: 'sync_queue'
});

export const addToQueue = async (endpoint, payload) => {
  const id = Date.now().toString(); // Generate a unique local ID
  const item = { id, endpoint, payload, timestamp: new Date().toISOString() };
  await syncQueue.setItem(id, item);
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