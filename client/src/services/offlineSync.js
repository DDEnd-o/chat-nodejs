import { getQueuedMessages, removeQueuedMessage } from './offlineQueue';

let activeSocket = null;
let flushing = false;

// Gắn vào socket hiện tại: mỗi khi có kết nối lại (mạng trở lại), gửi lại toàn bộ
// hàng đợi offline (FR-09) — không phụ thuộc màn hình chat nào đang mở.
export function startOfflineSync(socket) {
    if (activeSocket === socket) return;
    activeSocket = socket;
    socket.on('connect', flushAll);
}

async function flushAll() {
    if (flushing || !activeSocket) return;
    flushing = true;
    try {
        const queued = await getQueuedMessages();
        for (const item of queued) {
            await new Promise((resolve) => {
                activeSocket.emit('sendMessage', item, async (res) => {
                    if (res?.message) {
                        await removeQueuedMessage(item.clientId);
                        window.dispatchEvent(
                            new CustomEvent('offline-message-sent', {
                                detail: { clientId: item.clientId, message: res.message },
                            })
                        );
                    }
                    resolve();
                });
            });
        }
    } finally {
        flushing = false;
    }
}
