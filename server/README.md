# Chat App — Server (Express + Socket.io + MySQL)

Backend của đồ án "Phần mềm chat trực tuyến" — xem chi tiết chạy toàn bộ dự án tại [`../HUONG_DAN_TRIEN_KHAI.md`](../HUONG_DAN_TRIEN_KHAI.md).

## Chạy MySQL

**Cách 1 — Docker (khuyến nghị nếu đã có Docker Desktop):**

```bash
docker compose up -d   # tạo container "dtdd-chat-mysql", tự chạy db/schema.sql lần đầu
```

Container, network, volume đều có tiền tố cố định `dtdd-chat-` (đặt qua `name: dtdd-chat` trong `docker-compose.yml`) để không lẫn với MySQL của các đồ án khác trên máy (`docker ps` sẽ thấy rõ `dtdd-chat-mysql` riêng biệt). Map ra cổng host **3307** (không phải 3306 mặc định) để tránh đụng cổng với MySQL khác đang chạy sẵn. Tài khoản ứng dụng: `chat_app` / `chat_app_password`, đã có sẵn quyền trên database `chat_app`. Muốn xoá sạch và tạo lại từ đầu: `docker compose down -v && docker compose up -d`.

Workbench vẫn kết nối được bình thường để vẽ EER Diagram (mục 3.2): Hostname `127.0.0.1`, Port `3307`, Username `root`, Password `root_password`.

**Cách 2 — MySQL Server cài trực tiếp:** chạy `db/schema.sql` trong MySQL Workbench hoặc `mysql -u root -p < db/schema.sql`, dùng cổng 3306 mặc định.

## Chạy server

```bash
npm install
cp .env.example .env   # nếu dùng Docker: DB_PORT=3307, DB_USER=chat_app, DB_PASSWORD=chat_app_password
npm run dev             # nodemon, tự reload
```

Kiểm tra: `curl http://localhost:5000/api/health` → `{"status":"ok","db":"connected"}`.

## API

| Loại | Tên | Mô tả |
|---|---|---|
| REST | `POST /api/auth/register` | Tạo tài khoản (FR-01) |
| REST | `POST /api/auth/login` | Đăng nhập, trả JWT (FR-02) |
| REST | `GET /api/users` | Danh sách người dùng khác (FR-03) |
| REST | `GET /api/conversations` | Danh sách cuộc trò chuyện của tôi (FR-03) |
| REST | `POST /api/conversations` | Lấy/tạo cuộc trò chuyện 1-1 với `otherUserId` |
| REST | `GET /api/messages/:conversationId` | Lịch sử tin nhắn (FR-06) |
| REST | `POST /api/messages/:conversationId/image` | Gửi tin nhắn kèm ảnh (FR-05) |
| Socket | `sendMessage` → ack | Client gửi tin nhắn mới (FR-04, FR-09) |
| Socket | `newMessage` | Server phát tin nhắn tới các thành viên khác trong phòng |
| Socket | `joinConversation` | Client join phòng ngay sau khi tạo cuộc trò chuyện mới |
| Socket | `userStatus` | Phát trạng thái online/offline (FR-07) |

Socket.io xác thực bằng JWT qua `socket.handshake.auth.token`. Mỗi user được join vào room `conversation:<id>` cho từng cuộc trò chuyện mà họ là thành viên.
