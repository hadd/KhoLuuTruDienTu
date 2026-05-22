# 1. Dùng Deno siêu nhẹ
FROM denoland/deno:alpine

# 2. Set thư mục làm việc chung
WORKDIR /app

# 3. Bê các file dùng chung từ ngoài root vào trước
# Lưu ý: Vì context giờ là root (sohoa-be) nên Docker sẽ copy rất mượt
COPY deno.lock ./
COPY deno.jsonc ./
COPY shared/ ./shared/

# 4. Bê toàn bộ code backend vào đúng vị trí của nó
COPY packages/sohoa-backend/ ./packages/sohoa-backend/

# 5. Chuyển hướng làm việc vào thẳng backend
WORKDIR /app/packages/sohoa-backend

# 6. Mở cổng
EXPOSE 8000

# 7. Khởi chạy (Giống y hệt lệnh Đạt nổ máy thủ công)
CMD ["deno", "task", "dev"]