# HƯỚNG DẪN TRIỂN KHAI — Phần mềm Chat (Điện toán di động)

Hướng dẫn này đi theo đúng kiến trúc đã chốt trong báo cáo (`Bao cao do an Dien toan di dong - Phan mem chat.docx`): **React (PWA) + Node.js/Express + Socket.io + MySQL**. Làm theo thứ tự các bước — mỗi bước đều có cách kiểm tra "đã xong chưa" trước khi qua bước kế.

## 0. Yêu cầu môi trường

| Công cụ | Phiên bản | Kiểm tra bằng |
|---|---|---|
| Node.js | ≥ 18.x (LTS) | `node -v` |
| npm | đi kèm Node | `npm -v` |
| MySQL Server | 8.x | `mysql --version` |
| MySQL Workbench | mới nhất | mở app, kết nối thử tới `localhost` |
| Điện thoại thật | cùng mạng WiFi với máy tính | — |

> Nếu thiếu MySQL Server: cài qua [dev.mysql.com/downloads](https://dev.mysql.com/downloads/) hoặc `brew install mysql` (macOS). Nếu đã có **Docker Desktop**, có thể dùng Docker thay vì cài MySQL Server trực tiếp — xem mục 1b.

## 1. Tạo cơ sở dữ liệu

1. Mở **MySQL Workbench**, kết nối tới server local (`localhost`, user `root`).
2. Mở một **SQL tab** mới, dán nguyên script `CREATE TABLE` ở mục 3.2 báo cáo (5 bảng: `Users`, `Conversations`, `ConversationMembers`, `Messages`, `Attachments`) và chạy (⚡ Execute). Script này đã có sẵn tại [`server/db/schema.sql`](server/db/schema.sql).
3. Kiểm tra: ở **Navigator → Schemas**, thấy database `chat_app` với đủ 5 bảng.
4. Vẽ sơ đồ quan hệ để chụp ảnh nộp báo cáo: **Database → Reverse Engineer...** → chọn `chat_app` → Next đến cuối → Workbench tự vẽ EER Diagram. Chụp ảnh màn hình này, chèn vào mục 3.2 báo cáo (chỗ đã đánh dấu `[CHÈN ẢNH...]`).

✅ **Xong bước này khi:** mở `chat_app` thấy 5 bảng, và có ảnh EER diagram.

## 1b. Cách khác: chạy MySQL bằng Docker (không cần cài MySQL Server)

Nếu máy đã có Docker Desktop, dùng file [`server/docker-compose.yml`](server/docker-compose.yml) đã chuẩn bị sẵn — tự tạo database `chat_app` và tự chạy `schema.sql` ngay lần khởi tạo đầu tiên:

```bash
cd server
docker compose up -d
```

Container tên `dtdd-chat-mysql` (network/volume cũng có tiền tố `dtdd-chat-`, đặt cố định qua `name: dtdd-chat` trong file compose) — chạy `docker ps` sẽ thấy ngay, không lẫn với MySQL của đồ án khác trên máy (ví dụ `cinema-mysql`). Lắng nghe ở cổng host **3307** (tránh đụng cổng 3306 nếu máy đã có MySQL khác chạy sẵn). Tài khoản ứng dụng: `chat_app` / `chat_app_password`; root: `root` / `root_password`.

Kết nối **MySQL Workbench** để vẽ EER Diagram (vẫn làm bước 4 ở mục 1 như bình thường): tạo connection mới với Hostname `127.0.0.1`, Port `3307`, Username `root`, Password `root_password`.

Trong `server/.env`, đặt `DB_PORT=3307`, `DB_USER=chat_app`, `DB_PASSWORD=chat_app_password` (xem `server/.env.example`).

Dừng container: `docker compose stop`. Xoá sạch dữ liệu và tạo lại từ đầu: `docker compose down -v && docker compose up -d`.

✅ **Đã kiểm tra thực tế:** container khởi tạo thành công, đủ 5 bảng, và backend kết nối `GET /api/health` trả `{"status":"ok","db":"connected"}`.

## 2. Khởi tạo Backend (Node.js + Express + Socket.io + MySQL)

```bash
mkdir -p server && cd server
npm init -y
npm install express socket.io mysql2 bcrypt jsonwebtoken cors dotenv
npm install --save-dev nodemon
```

Cấu trúc thư mục cần tạo (đúng như mục 3.3 báo cáo):

```
server/
├── .env                      # DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PORT
├── config/db.js              # tạo pool kết nối mysql2
├── models/                   # (nếu dùng Sequelize) hoặc query trực tiếp qua mysql2
├── routes/
│   ├── auth.routes.js        # POST /api/auth/register, /api/auth/login
│   ├── conversation.routes.js
│   └── message.routes.js
├── sockets/chat.socket.js    # connection, sendMessage, newMessage, userStatus
├── middleware/auth.js        # verify JWT
└── server.js                 # khởi tạo Express + http server + Socket.io
```

File `.env` mẫu:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<mật khẩu MySQL của bạn>
DB_NAME=chat_app
JWT_SECRET=<chuỗi bí mật bất kỳ>
PORT=5000
```

Chạy thử:

```bash
npx nodemon server.js
```

✅ **Xong bước này khi:** terminal in ra "Server listening on port 5000" (hoặc tương tự) và gọi thử `curl http://localhost:5000/api/health` (nếu có route health) trả về OK, không có lỗi kết nối MySQL.

## 3. Khởi tạo Frontend (React + Vite + PWA)

```bash
npm create vite@latest client -- --template react
cd client
npm install
npm install socket.io-client axios idb
```

`idb` dùng để thao tác IndexedDB (hàng đợi tin nhắn offline) dễ hơn API gốc.

Cấu trúc thư mục cần tạo (đúng mục 3.4 báo cáo):

```
client/
├── public/
│   ├── manifest.json         # tên app, icon, display:"standalone" — bắt buộc cho PWA
│   └── icons/                # icon 192x192, 512x512
├── src/
│   ├── pages/ (Login, Register, ChatList, ChatRoom)
│   ├── services/socket.js
│   ├── services/offlineQueue.js
│   └── hooks/useNetworkStatus.js
└── service-worker.js hoặc dùng plugin vite-plugin-pwa
```

Cách nhanh nhất để có PWA đầy đủ (service worker tự sinh, không phải viết tay):

```bash
npm install -D vite-plugin-pwa
```

rồi khai báo plugin trong `vite.config.js` với `manifest: { name, short_name, start_url, display: "standalone", icons: [...] }`.

Chạy thử:

```bash
npm run dev -- --host
```

Cờ `--host` bắt buộc phải có — nếu không, Vite chỉ lắng nghe `localhost` và điện thoại trong cùng mạng LAN sẽ không truy cập được.

✅ **Xong bước này khi:** mở `http://localhost:5173` trên máy tính thấy giao diện React chạy được.

## 4. Kết nối Frontend ↔ Backend ↔ MySQL (test luồng cơ bản)

1. Đăng ký 1 tài khoản qua giao diện → kiểm tra bảng `Users` trong MySQL Workbench có bản ghi mới.
2. Đăng nhập → mở DevTools → Application → Local Storage, kiểm tra JWT token đã lưu.
3. Mở 2 trình duyệt khác nhau (hoặc 1 cửa sổ ẩn danh), đăng nhập 2 tài khoản khác nhau, gửi tin nhắn qua lại → kiểm tra bảng `Messages` có bản ghi mới theo thời gian thực.

✅ **Xong bước này khi:** 2 tài khoản chat qua lại được ngay trên trình duyệt máy tính.

## 5. Chạy thật trên điện thoại qua mạng LAN (phần "điện toán di động")

1. Tìm địa chỉ IP nội bộ của máy tính:
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig` → tìm "IPv4 Address"
2. Đảm bảo điện thoại và máy tính **cùng một mạng WiFi**.
3. Sửa URL backend trong frontend (ví dụ biến `VITE_API_URL`) từ `localhost:5000` thành `http://<IP-máy-tính>:5000`.
4. Trên điện thoại, mở trình duyệt, truy cập `http://<IP-máy-tính>:5173`.
5. Đăng nhập, thử chat — tin nhắn phải đến người nhận gần như ngay lập tức.
6. Cài app lên màn hình chính: menu trình duyệt → **"Add to Home Screen" / "Thêm vào Màn hình chính"** → mở lại từ icon vừa tạo, kiểm tra app chạy full-screen (không còn thanh địa chỉ trình duyệt).

> Nếu điện thoại không mở được trang: kiểm tra Firewall máy tính có chặn cổng 5173/5000 không (macOS: System Settings → Network → Firewall → cho phép Node/Vite).

✅ **Xong bước này khi:** có đủ 3 ảnh chụp màn hình cho báo cáo mục 3.5 — giao diện đăng nhập trên điện thoại thật, 2 máy chat qua lại, và icon app sau khi "Add to Home Screen".

## 6. Test kịch bản mất mạng → đồng bộ lại (điểm nhấn mobile)

1. Trên điện thoại, mở app, vào 1 cuộc trò chuyện.
2. Bật **Chế độ máy bay** (tắt hẳn WiFi/4G).
3. Soạn và gửi 1 tin nhắn → giao diện phải hiện trạng thái **"Đang chờ gửi"**, KHÔNG được báo lỗi/crash.
4. Tắt chế độ máy bay (có mạng lại) → tin nhắn phải tự động gửi đi trong vài giây, chuyển trạng thái **"Đã gửi"**.
5. Kiểm tra bảng `Messages` trong MySQL: tin nhắn đó phải có mặt, không bị mất.

✅ **Xong bước này khi:** có ảnh chụp 2 trạng thái (đang chờ gửi / đã gửi) cho báo cáo mục 3.5, và kết quả PASS cho kịch bản TC-05 ở mục 3.6.

## 7. Checklist trước khi nộp báo cáo

- [ ] Ảnh EER Diagram từ MySQL Workbench (mục 3.2)
- [ ] Ảnh màn hình đăng nhập trên điện thoại thật (mục 3.5)
- [ ] Ảnh 2 thiết bị chat qua lại real-time (mục 3.5)
- [ ] Ảnh icon app sau khi "Add to Home Screen" (mục 3.5)
- [ ] Ảnh trạng thái mất mạng + tự đồng bộ lại (mục 3.5)
- [ ] Cập nhật kết quả PASS/FAIL thật cho bảng kịch bản kiểm thử (mục 3.6)
- [ ] Mở file `.docx`, chuột phải vào Mục lục → **Update Field** để số trang chính xác trước khi in/nộp

## 8. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `ER_ACCESS_DENIED_ERROR` khi backend kết nối MySQL | Sai user/password trong `.env` | Kiểm tra lại `DB_USER`/`DB_PASSWORD` |
| `ECONNREFUSED` khi frontend gọi API | Backend chưa chạy, hoặc sai IP/port | Kiểm tra `nodemon server.js` còn chạy, đúng IP LAN |
| Điện thoại không vào được `http://<IP>:5173` | Firewall chặn, hoặc không cùng mạng WiFi | Tắt tạm Firewall để test, kiểm tra WiFi 2 máy |
| Socket.io không nhận tin nhắn real-time | CORS chưa cấu hình đúng origin, hoặc client kết nối sai URL | Kiểm tra `cors({origin: "*"})` tạm thời khi dev, kiểm tra URL socket client trỏ đúng backend |
| "Add to Home Screen" không hiện | Thiếu `manifest.json` hợp lệ hoặc chưa phục vụ qua HTTPS/localhost | Với LAN dùng IP (không phải localhost), một số trình duyệt di động yêu cầu HTTPS cho PWA đầy đủ — có thể dùng `ngrok` để có HTTPS tạm thời khi demo |
