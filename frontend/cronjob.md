BẢN KẾ HOẠCH TRIỂN KHAI: NESTJS + BULLMQ + REDIS
Giai đoạn 1: Chuẩn bị hạ tầng & Cài đặt
Khởi chạy Redis: * Cần một instance Redis chạy qua Docker (hoặc dịch vụ cloud như Upstash, AWS ElastiCache).

Đảm bảo Redis đã bật tính năng Persistence (AOF hoặc RDB) để nếu server Redis bị restart cũng không mất dữ liệu hàng đợi.

Cài đặt thư viện vào NestJS:

Bash
npm install @nestjs/bullmq bullmq ioredis
Giai đoạn 2: Cấu hình Hệ thống (Module Setup)
Yêu cầu AI thiết lập BullModule tại app.module.ts:

Kết nối BullModule với Redis thông qua biến môi trường REDIS_URL hoặc REDIS_HOST, REDIS_PORT.

Tạo một module riêng: VoucherModule.

Đăng ký một Queue có tên là voucher-cron-queue bên trong VoucherModule.

Giai đoạn 3: Chiến thuật "Repeatable Jobs" (Điểm mấu chốt)
Thay vì dùng @nestjs/schedule (gây lỗi chạy trùng trên nhiều server), chúng ta sẽ dùng tính năng Repeatable Jobs của BullMQ.

Bản chất: NestJS sẽ gửi một lịch trình (VD: "Chạy lúc 00:00 mỗi đêm") vào thẳng Redis.

Quản lý phân tán: Đến đúng 00:00, Redis sẽ ném ra 1 Job duy nhất. Dù bạn có 10 server NestJS đang chạy, thằng nào rảnh vồ được job đó trước thì làm, 9 thằng còn lại sẽ ngồi chơi. Đảm bảo Job chỉ chạy 1 lần duy nhất.

Task cho AI: Viết một OnModuleInit trong VoucherService để đăng ký cronjob vào Queue khi khởi động server:

TypeScript
// AI sẽ tự viết logic chi tiết dựa trên sườn này
await this.voucherQueue.add(
  'verify-qr-vouchers-job', 
  {}, 
  { repeat: { pattern: '0 0 * * *' } } // Chạy 00:00 mỗi ngày
);
Giai đoạn 4: Xây dựng Worker (Người dọn dẹp)
Tạo file voucher.processor.ts sử dụng decorator @Processor('voucher-cron-queue'). Worker này sẽ lắng nghe và xử lý job 'verify-qr-vouchers-job'.
Luồng xử lý bên trong Worker:

Lấy dữ liệu: Gọi Prisma 6 query tìm tất cả UserVoucher có status = 'PENDING', unlockAt <= now() và sourceOrderCode != null.

Xử lý theo lô (Batch Processing): Nếu có 1000 vouchers cần duyệt, không được gọi API check vận chuyển đồng loạt 1000 lần (sẽ bị khóa IP do Rate Limit). Phải dùng vòng lặp, mỗi lần check 1 đơn, hoặc dùng Promise.allSettled với chunk size = 50.

Cập nhật Database: * Nếu API vận chuyển báo COMPLETED -> Prisma update status = 'ACTIVE'.

Nếu báo RETURNED/CANCELLED -> Prisma update status = 'REJECTED'.

Log quá trình: Sử dụng NestJS Logger để ghi lại "Đã duyệt thành công X voucher, hủy Y voucher".

Giai đoạn 5: Xử lý Lỗi & Kịch bản dự phòng (Candor & Best Practices)
Đây là phần phân biệt giữa code "chạy được" và code "sống dai". Yêu cầu AI bổ sung các config sau vào Queue:

Cơ chế Retry: Nếu gọi API check vận chuyển bị lỗi mạng (Timeout 500), tự động attempts: 3 (thử lại 3 lần), mỗi lần cách nhau backoff: 5000 (5 giây).

Dead Letter Queue (DLQ): Nếu thử lại 3 lần vẫn lỗi (do API vận chuyển sập hẳn), đẩy job này vào trạng thái Failed. Sáng hôm sau Dev vào check lại, fix lỗi và bấm nút "Retry" thủ công, không bị mất data duyệt voucher của khách.

💡 Lưu ý thực chiến bổ sung (Bonus)
Để dễ dàng quản lý mớ Queue này, bạn nên yêu cầu AI tích hợp thêm thư viện @bull-board/nestjs.
Đây là một giao diện Dashboard cực kỳ xịn sò (hiển thị trên một route riêng như domain.com/admin/queues). Bạn có thể đăng nhập vào, nhìn thấy trực quan hôm nay có bao nhiêu voucher đang chờ duyệt, bao nhiêu job bị lỗi mạng cần bấm chạy lại mà không phải mò vào tận Database.

Bạn hãy đưa bản kế hoạch này cho AI (Cursor/Windsurf), nó sẽ tự động map (nối) luồng BullMQ này vào cấu trúc Prisma 6 hiện tại một cách trơn tru!