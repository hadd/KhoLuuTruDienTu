# <tên-nhánh-chính> :
backend : backend_Nodejs
frontend: feature/front-end

# Bước 1: Commit code lên nhánh của mình
```bash
git add .
git commit -m "Hoàn thành tính năng X"
```

# Bước 2: Chuyển sang nhánh chính và lấy code về
```bash
git checkout  <tên-nhánh-chính>
git pull origin <tên-nhánh-chính>
```

# Bước 3: Quay lại nhánh của bạn và gộp code mới từ nhánh chính và xử lí xung đột(nếu có)
```bash
git checkout <tên-nhánh-của-bạn>
git merge <tên-nhánh-chính>
```

# Sau khi sửa xong, lưu file lại và chạy lệnh:
```bash
git add .
git commit -m "fix: Giải quyết conflict sau khi merge từ main"
```

# Bước 4: Đẩy code và merge vào nhánh chính:
```bash
git checkout <tên-nhánh-chính>
git merge <tên-nhánh-của-bạn>
git push origin <tên-nhánh-chính>
```

# Bước 5: Đồng bộ trên nhánh mình để tiếp tục code 
```bash
git checkout <ten-nhanh-cua-ban>
git merge main
```

# Lưu ý : Khi đang code mà muốn kéo code mới về code tiếp
# 1. Lưu lại đoạn code dở thành một commit tạm
```bash
git add .
git commit -m "wip: dang code do tinh nang X"
```
# 2. Kéo code mới nhất từ main trên server về và gộp luôn vào nhánh của bạn
```bash
git pull origin main
```
