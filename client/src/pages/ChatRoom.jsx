import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { enqueueMessage, getQueuedMessages } from '../services/offlineQueue';

function addOrReplace(list, message, clientId) {
    const idx = clientId
        ? list.findIndex((m) => m.clientId === clientId)
        : list.findIndex((m) => m.messageId === message.messageId);

    if (idx !== -1) {
        const updated = [...list];
        updated[idx] = { ...message, clientId };
        return updated;
    }
    if (list.some((m) => m.messageId && m.messageId === message.messageId)) {
        return list;
    }
    return [...list, { ...message, clientId }];
}

export default function ChatRoom() {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isOnline = useNetworkStatus();
    const [otherUser, setOtherUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        async function load() {
            const [{ data: history }, { data: conversations }] = await Promise.all([
                api.get(`/messages/${conversationId}`),
                api.get('/conversations'),
            ]);
            setMessages(history);
            const conv = conversations.find((c) => String(c.conversationId) === String(conversationId));
            setOtherUser(conv?.otherUser || null);

            const queued = await getQueuedMessages();
            const mine = queued.filter((q) => String(q.conversationId) === String(conversationId));
            setMessages((prev) => {
                let next = prev;
                mine.forEach((q) => {
                    next = addOrReplace(next, { ...q, status: 'pending' }, q.clientId);
                });
                return next;
            });
        }
        load();
    }, [conversationId]);

    useEffect(() => {
        const socket = getSocket();
        socket?.emit('joinConversation', conversationId);

        const onNewMessage = (message) => {
            if (String(message.conversationId) !== String(conversationId)) return;
            setMessages((prev) => addOrReplace(prev, message));
        };
        socket?.on('newMessage', onNewMessage);
        return () => socket?.off('newMessage', onNewMessage);
    }, [conversationId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        // Việc gửi lại hàng đợi khi có mạng do offlineSync xử lý ở tầng socket (toàn cục,
        // không phụ thuộc phòng chat nào đang mở) — ở đây chỉ cập nhật UI khi nhận kết quả.
        const onSent = (e) => {
            const { clientId, message } = e.detail;
            if (String(message.conversationId) !== String(conversationId)) return;
            setMessages((prev) => addOrReplace(prev, message, clientId));
        };
        window.addEventListener('offline-message-sent', onSent);
        return () => window.removeEventListener('offline-message-sent', onSent);
    }, [conversationId]);

    async function handleSend(e) {
        e.preventDefault();
        const content = draft.trim();
        if (!content) return;
        setDraft('');

        const clientId = crypto.randomUUID();
        const payload = { conversationId, content, messageType: 'text', clientId };
        const socket = getSocket();

        setMessages((prev) =>
            addOrReplace(prev, { ...payload, senderId: user.userId, status: 'pending', sentAt: new Date().toISOString(), attachments: [] }, clientId)
        );

        if (isOnline && socket?.connected) {
            socket.emit('sendMessage', payload, (res) => {
                if (res?.message) {
                    setMessages((prev) => addOrReplace(prev, res.message, clientId));
                }
            });
        } else {
            await enqueueMessage(payload);
        }
    }

    async function handleImageSelect(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        const { data: message } = await api.post(`/messages/${conversationId}/image`, formData);
        setMessages((prev) => addOrReplace(prev, message));
    }

    return (
        <div className="screen">
            <header className="app-header">
                <button className="link-btn" onClick={() => navigate('/')}>←</button>
                <span>{otherUser?.fullName || '...'}</span>
                <span className={`status-dot ${otherUser?.status === 'online' ? 'online' : 'offline'}`} />
            </header>

            {!isOnline && (
                <div className="offline-banner">Không có kết nối mạng — tin nhắn sẽ được gửi khi có mạng trở lại</div>
            )}

            <div className="message-list">
                {messages.map((m) => (
                    <div
                        key={m.messageId || m.clientId}
                        className={`message-bubble ${m.senderId === user.userId ? 'mine' : 'theirs'}`}
                    >
                        {m.content && <p>{m.content}</p>}
                        {m.attachments?.map((a) => (
                            <img key={a.fileUrl} src={`${API_URL}${a.fileUrl}`} alt="attachment" className="message-image" />
                        ))}
                        {m.status === 'pending' && <span className="pending-label">⏳ Đang chờ gửi...</span>}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <form className="composer" onSubmit={handleSend}>
                <input
                    type="text"
                    placeholder="Nhập tin nhắn"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                />
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                />
                <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()}>📷</button>
                <button type="submit">Gửi</button>
            </form>
        </div>
    );
}
