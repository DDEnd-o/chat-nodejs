# Chat App — Client (React + Vite + PWA)

Frontend của đồ án "Phần mềm chat trực tuyến" — xem chi tiết chạy toàn bộ dự án tại [`../HUONG_DAN_TRIEN_KHAI.md`](../HUONG_DAN_TRIEN_KHAI.md).

## Chạy

```bash
npm install
cp .env.example .env   # chỉnh VITE_API_URL nếu backend không chạy ở localhost:5000
npm run dev -- --host  # --host để điện thoại trong mạng LAN truy cập được
```

## Cấu trúc

```
src/
├── context/AuthContext.jsx   # JWT + user hiện tại, kết nối socket khi đăng nhập
├── services/api.js           # axios instance, tự gắn Authorization header
├── services/socket.js        # socket.io-client
├── services/offlineQueue.js  # hàng đợi tin nhắn offline trong IndexedDB (idb)
├── hooks/useNetworkStatus.js # theo dõi navigator.onLine + socket.connected
└── pages/
    ├── Login.jsx / Register.jsx
    ├── ChatList.jsx          # danh sách người dùng + cuộc trò chuyện (FR-03)
    └── ChatRoom.jsx          # chat 1-1 real-time + gửi ảnh + offline queue
```

PWA (manifest + service worker) được cấu hình qua `vite-plugin-pwa` trong `vite.config.js`.
