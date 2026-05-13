import localforage from 'localforage';
import api from './axios';

const syncQueue = localforage.createInstance({
  name: 'kicowasco',
  storeName: 'sync_queue'
});

const idMappingStore = localforage.createInstance({
    name: 'kicowasco',
    storeName: 'id_mappings'
});

// ─── Section 6.2: Conflict Resolution ────────────────────────────────────────
// When a queued POST is replayed after coming back online, the server may already
// have a record created by another session (e.g. another device submitted the same
// date). Resolution strategy:
//   1. Attempt POST. If the server returns 400/409 and the endpoint has a known
//      identity key, probe for an existing record via GET with the identity filter.
//   2. If found, escalate the POST to a PATCH against the existing record's id,
//      sending only the non-null fields from the payload (null-stripping via
//      buildSyncPayload).
//   3. If the GET probe also fails, log the conflict and remove the item from the
//      queue to avoid infinite retries (data is preserved in localforage for
//      manual review via the offline queue inspector).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip null and undefined values from a payload object before syncing.
 * Prevents overwriting existing server data with empty offline values.
 */
export const buildSyncPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;
    return Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== null && v !== undefined)
    );
};

/**
 * Returns the identity field name for a given API endpoint.
 * Used during conflict resolution to probe for an existing record.
 * Extend this map as new endpoints gain offline support.
 */
const IDENTITY_KEYS = {
    '/api/lab-records/':  'record_date',
    '/api/flow-records/': 'date',
    '/api/patrols/':      'date',
    '/api/f203a/':        'date',
    '/api/pond-logs/':    ['log_date', 'pond'],
};

/**
 * Probe the server for an existing record matching the payload's identity key(s).
 * Returns the existing record's id or null.
 */
const probeExisting = async (endpoint, payload) => {
    const keyDef = IDENTITY_KEYS[endpoint];
    if (!keyDef) return null;
    try {
        const params = {};
        const keys = Array.isArray(keyDef) ? keyDef : [keyDef];
        keys.forEach(k => { if (payload[k] !== undefined) params[k] = payload[k]; });
        const res = await api.get(endpoint, { params });
        const results = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        return results.length > 0 ? results[0].id : null;
    } catch {
        return null;
    }
};

/**
 * Merge a flow reading into an existing DailyFlowRecord by slot identity.
 * Uses PATCH on the parent record's readings rather than creating duplicates.
 */
export const syncFlowReading = async (recordId, readings) => {
    if (!recordId || !readings?.length) return;
    await api.patch(`/api/flow-records/${recordId}/`, { readings });
};

export const addToQueue = async (endpoint, payload, tempId = Date.now().toString(), parentTempId = null) => {
  let method = 'POST';
  let metadata = {};
  let queueId = tempId;
  let queueParentTempId = parentTempId;

  if (typeof tempId === 'string' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(tempId.toUpperCase()) && (parentTempId === null || typeof parentTempId === 'object')) {
    method = tempId.toUpperCase();
    queueId = Date.now().toString();
    metadata = parentTempId && typeof parentTempId === 'object' ? parentTempId : {};
    queueParentTempId = null;
  }

  const item = { 
      id: queueId, 
      endpoint, 
      payload: buildSyncPayload(payload),
      method,
      metadata,
      parentTempId: queueParentTempId,
      timestamp: new Date().toISOString() 
  };
  await syncQueue.setItem(queueId, item);
  return item;
};

export const getQueue = async () => {
  const items = [];
  await syncQueue.iterate((value) => {
    items.push(value);
  });
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
            let finalPayload = buildSyncPayload({ ...item.payload });

            // Resolve offline parent ID → real server ID
            if (item.parentTempId) {
                const realParentId = await idMappingStore.getItem(item.parentTempId);
                if (realParentId) {
                    finalPayload.incident = realParentId;
                } else {
                    console.warn(`Parent ID not yet synced for item ${item.id}. Skipping.`);
                    continue; 
                }
            }

            // Use PATCH for explicit update items (avoid PUT which overwrites all fields)
            const httpMethod = (item.method === 'PUT' ? 'PATCH' : item.method || 'POST').toLowerCase();

            let response;
            try {
                response = await api.request({
                    method: httpMethod,
                    url: item.endpoint,
                    data: finalPayload,
                });
            } catch (requestError) {
                // Section 6.2: 400/409 conflict resolution — probe and PATCH existing record
                const statusCode = requestError.response?.status;
                if ((statusCode === 400 || statusCode === 409) && httpMethod === 'post') {
                    const existingId = await probeExisting(item.endpoint, finalPayload);
                    if (existingId) {
                        response = await api.patch(`${item.endpoint}${existingId}/`, finalPayload);
                        console.info(`Conflict resolved via PATCH for ${item.endpoint} id=${existingId}`);
                    } else {
                        console.error(`Conflict for ${item.endpoint} — no existing record found. Dropping item.`);
                        await removeFromQueue(item.id);
                        continue;
                    }
                } else {
                    throw requestError;
                }
            }
            
            if (response?.data?.id) {
                await idMappingStore.setItem(item.id, response.data.id);
            }

            await removeFromQueue(item.id);

        } catch (error) {
            console.error(`Failed to sync item ${item.id}:`, error);
            if (!error.response) break;
        }
    }
};