import { openDB } from 'idb';

const DB_NAME = 'chat-offline-db';
const STORE_NAME = 'pendingMessages';

function getDb() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME, { keyPath: 'clientId' });
        },
    });
}

// Lưu tin nhắn vào hàng đợi khi mất mạng (FR-09)
export async function enqueueMessage(message) {
    const db = await getDb();
    await db.put(STORE_NAME, message);
}

export async function getQueuedMessages() {
    const db = await getDb();
    return db.getAll(STORE_NAME);
}

export async function removeQueuedMessage(clientId) {
    const db = await getDb();
    await db.delete(STORE_NAME, clientId);
}
