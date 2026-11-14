# chat-nodejs

Phần mềm chat 1-1 thời gian thực — đồ án môn Điện toán di động. React (PWA) + Node.js/Express + Socket.io + MySQL.

## Kiến trúc

- **client/** — React (Vite) + PWA (vite-plugin-pwa), offline message queue bằng IndexedDB
- **server/** — Node.js + Express + Socket.io + MySQL (mysql2), JWT auth
- MySQL có thể chạy bằng Docker (`server/docker-compose.yml`) hoặc MySQL Server cài trực tiếp

## Chạy dự án

Xem hướng dẫn chi tiết từng bước tại [`HUONG_DAN_TRIEN_KHAI.md`](HUONG_DAN_TRIEN_KHAI.md), hoặc README riêng của [`server`](server/README.md) / [`client`](client/README.md).

Tóm tắt nhanh:

```bash
# 1. MySQL (Docker)
cd server && docker compose up -d

# 2. Backend
cp .env.example .env   # chỉnh DB_PORT=3307, DB_USER=chat_app, DB_PASSWORD=chat_app_password nếu dùng Docker
npm install && npm run dev

# 3. Frontend (ở thư mục khác)
cd client
cp .env.example .env
npm install && npm run dev -- --host
```

## Tính năng chính

- Đăng ký/đăng nhập (JWT + bcrypt)
- Chat 1-1 real-time qua Socket.io, gửi kèm hình ảnh
- Trạng thái online/offline
- Cài đặt lên màn hình chính thiết bị di động (PWA)
- Phát hiện mất mạng, lưu hàng đợi tin nhắn (IndexedDB) và tự đồng bộ lại khi có mạng
