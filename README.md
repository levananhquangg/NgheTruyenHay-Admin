# Nghe Truyện Hay · Admin Panel

Trang quản trị web tiếng Việt cho catalog truyện: quản lý nội dung, cấu trúc chương/tập, thể loại/nhãn, gói Plus, sale, voucher, cộng đồng, phân tích và doanh thu hiển thị. Giao diện desktop/tablet, chạy được trên Windows.

**Bản đang chạy:** https://levananhquangg.github.io/NgheTruyenHay-Admin/

## Chạy trên Windows

1. Cài Node.js LTS nếu PC chưa có.
2. Tạo file `.env` bằng cách sao chép `.env.example`.
3. Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` lấy từ Supabase **Connect** hoặc **Settings → API Keys**.
4. Mở PowerShell tại thư mục này rồi chạy:

   ```powershell
   npm install
   npm run dev
   ```

5. Mở địa chỉ local mà Vite in ra (thường là `http://localhost:5173`).

Không đặt secret/service_role key vào `.env`: biến bắt đầu bằng `VITE_` được đóng gói vào trang và người khác có thể xem. Quyền ghi được bảo vệ bởi Supabase Auth và RLS; chỉ user trong `public.story_admins` mới quản trị được.

## Chức năng

- Đăng nhập email/mật khẩu; kiểm tra quyền admin.
- Dashboard tổng quan kho truyện, doanh thu hiển thị và hàng đợi kiểm duyệt.
- Tạo/sửa/xóa truyện; lưu nháp, xuất bản, ẩn, hẹn giờ phát hành.
- Nhãn **Mới**, **Hot**, **Full**, truyện nổi bật và thứ tự catalog.
- Upload bìa JPG/PNG/WebP, văn bản TXT/MD và audio MP3/M4A/AAC/WAV/AIFF.
- Upload file lớn bằng TUS resumable upload, có tiến độ và retry.
- Dán/upload văn bản và **tách chương thông minh**; nhận diện `Quyển/Tập/Phần`, chương, chương có tiêu đề.
- Sửa/xóa chương, xem số chương, số quyển/tập và tổng từ trước khi lưu.
- Gán truyện vào một hoặc nhiều gói Plus; truyện không gán gói là miễn phí.
- Quản lý thể loại/nhãn và gán nhãn cho truyện.
- Quản lý gói: giá hiển thị, quyền lợi, entitlements, product ID App Store, gói nổi bật, bật/tạm dừng.
- Quản lý sale theo thời gian và voucher `percent`/`fixed`/`trial`, giới hạn gói, thời gian, lượt dùng, offer code App Store.
- Kiểm duyệt đánh giá/bình luận; xem phân tích, top truyện và doanh thu.
- Audit log cho thao tác nội dung quan trọng.

Giá, sale, voucher trong admin **chỉ là cấu hình hiển thị**. Thanh toán, giảm giá thật, hoàn tiền và gia hạn do App Store quyết định; admin không tạo giao dịch và không được báo doanh thu giả.

## Đưa lên hosting

Repo deploy là `https://github.com/levananhquangg/NgheTruyenHay-Admin` và GitHub Pages phục vụ nhánh `main`.

```powershell
npm run build
# Vite xóa .nojekyll, phải tạo lại trước khi commit dist
New-Item -ItemType File -Path .\dist\.nojekyll -Force
cd .\dist
git add -A
git commit -m "Deploy admin"
git push origin main
```

Không commit `node_modules`, `.env` hoặc file build cũ. Trang chỉ dùng publishable key.

## Kết nối app iOS

App dùng cùng project URL và publishable key trong `Resources/SupabaseConfig.plist`. Sau khi build/cài bản đã cấu hình, truyện mới, chương mới, gói, sale và voucher từ admin sẽ đồng bộ mà không cần cài lại app.

- Truyện hẹn giờ vẫn hiện thẻ và đếm ngược; app ẩn nội dung đến `scheduled_at`.
- Truyện gán gói Plus sẽ mở khóa khi StoreKit xác nhận entitlement tương ứng.
- Voucher nội bộ chỉ xác thực quyền lợi; muốn giảm giá thật phải tạo offer code trong App Store Connect và gắn mã đó vào voucher.

Xem schema, RPC và quy trình migration trong `../NgheTruyenHay-iOS/supabase/README.md`.
