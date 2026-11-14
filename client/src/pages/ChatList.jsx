import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function ChatList() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const isOnline = useNetworkStatus();
    const [users, setUsers] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [usersRes, conversationsRes] = await Promise.all([
                api.get('/users'),
                api.get('/conversations'),
            ]);
            setUsers(usersRes.data);
            setConversations(conversationsRes.data);
            setLoading(false);
        }
        load();
    }, []);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onStatus = ({ userId, status }) => {
            setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, status } : u)));
            setConversations((prev) =>
                prev.map((c) => (c.otherUser.userId === userId ? { ...c, otherUser: { ...c.otherUser, status } } : c))
            );
        };
        const onNewMessage = (message) => {
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.conversationId === message.conversationId);
                if (idx === -1) return prev;
                const updated = [...prev];
                updated[idx] = {
                    ...updated[idx],
                    lastMessage: { content: message.content, messageType: message.messageType, sentAt: message.sentAt },
                };
                return updated;
            });
        };

        const onOfflineSent = (e) => onNewMessage(e.detail.message);

        socket.on('userStatus', onStatus);
        socket.on('newMessage', onNewMessage);
        window.addEventListener('offline-message-sent', onOfflineSent);
        return () => {
            socket.off('userStatus', onStatus);
            socket.off('newMessage', onNewMessage);
            window.removeEventListener('offline-message-sent', onOfflineSent);
        };
    }, []);

    async function openChat(otherUserId) {
        const existing = conversations.find((c) => c.otherUser.userId === otherUserId);
        if (existing) {
            navigate(`/chat/${existing.conversationId}`);
            return;
        }
        const { data } = await api.post('/conversations', { otherUserId });
        getSocket()?.emit('joinConversation', data.conversationId);
        navigate(`/chat/${data.conversationId}`);
    }

    function conversationFor(userId) {
        return conversations.find((c) => c.otherUser.userId === userId);
    }

    function previewText(conv) {
        if (!conv?.lastMessage) return 'Bắt đầu trò chuyện...';
        return conv.lastMessage.messageType === 'image' ? '📷 Hình ảnh' : conv.lastMessage.content;
    }

    return (
        <div className="screen">
            <header className="app-header">
                <span>☰ Chat của tôi</span>
                <div className="header-right">
                    <span className="me-name">{user?.fullName}</span>
                    <button className="link-btn" onClick={logout}>Đăng xuất</button>
                </div>
            </header>

            {!isOnline && (
                <div className="offline-banner">Không có kết nối mạng — tin nhắn sẽ được gửi khi có mạng trở lại</div>
            )}

            {loading ? (
                <p className="empty-state">Đang tải...</p>
            ) : users.length === 0 ? (
                <p className="empty-state">Chưa có người dùng khác để trò chuyện</p>
            ) : (
                <ul className="conversation-list">
                    {users.map((u) => {
                        const conv = conversationFor(u.userId);
                        return (
                            <li key={u.userId} className="conversation-item" onClick={() => openChat(u.userId)}>
                                <span className={`status-dot ${u.status === 'online' ? 'online' : 'offline'}`} />
                                <div className="conversation-info">
                                    <span className="conversation-name">{u.fullName}</span>
                                    <span className="conversation-preview">{previewText(conv)}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
