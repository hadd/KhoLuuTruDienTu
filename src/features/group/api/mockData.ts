import type { Group, Member, DocumentStatus, UserDocument } from '../types';

// Các mảng dữ liệu mẫu để trộn ngẫu nhiên
const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
const middleNames = ['Văn', 'Thị', 'Minh', 'Hữu', 'Thanh', 'Đức', 'Xuân', 'Thu', 'Hải', 'Ngọc'];
const lastNames = ['An', 'Bình', 'Cường', 'Dương', 'Hà', 'Khoa', 'Linh', 'Nhung', 'Phúc', 'Trang'];

const documentStatuses: Array<DocumentStatus> = ['Biên tập', 'Chờ duyệt', 'Duyệt', 'Hoàn thành'];
const documentTitles = ['Hồ sơ thiết kế', 'Báo cáo tiến độ', 'Biên bản nghiệm thu', 'Tài liệu hướng dẫn', 'Yêu cầu kỹ thuật', 'Hợp đồng dự án'];

// Hàm tiện ích lấy số ngẫu nhiên (bao gồm cả min và max)
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Hàm hỗ trợ sinh dữ liệu thành viên tự động
const generateMembers = (groupId: string, count: number): Array<Member> => {
  const members: Array<Member> = [];
  
  // Sinh số lượng quản lý ngẫu nhiên từ 1 đến 3 cho mỗi nhóm
  const managerCount = getRandomInt(1, 3);
  
  for (let i = 0; i < count; i++) {
    // 1. Trộn tên ngẫu nhiên
    const firstName = firstNames[i % firstNames.length];
    const middleName = middleNames[(i + 2) % middleNames.length];
    const lastName = lastNames[(i + 4) % lastNames.length];
    const fullName = `${firstName} ${middleName} ${lastName}`;
    
    // Ngày tham gia
    const day = (i % 28) + 1;
    const formattedDay = day < 10 ? `0${day}` : `${day}`;

    // 2. Sinh ngẫu nhiên từ 8 đến 12 hồ sơ/tài liệu cho mỗi thành viên
    const docCount = getRandomInt(8, 12); 
    const userDocs: Array<UserDocument> = [];
    
    for (let j = 0; j < docCount; j++) {
      const status = documentStatuses[getRandomInt(0, documentStatuses.length - 1)];
      const titlePrefix = documentTitles[getRandomInt(0, documentTitles.length - 1)];
      
      // Random ngày cập nhật
      const docDay = getRandomInt(1, 28);
      const formattedDocDay = docDay < 10 ? `0${docDay}` : `${docDay}`;

      userDocs.push({
        id: `doc_${groupId}_${i}_${j}`,
        title: `${titlePrefix} - Phần ${j + 1}`,
        status: status,
        updatedAt: `2025-03-${formattedDocDay}`,
      });
    }

    // Xác định vai trò: Người đầu tiên là 'leader', 1-3 người tiếp theo là 'manager', còn lại là 'member'
    let userRole = 'member';
    if (i === 0) {
      userRole = 'leader';
    } else if (i <= managerCount) {
      userRole = 'manager'; 
    }

    // 3. Đưa vào mảng members
    members.push({
      id: `m${groupId}_${i + 1}`,
      name: fullName,
      email: `user${groupId}_${i + 1}@example.com`,
      role: userRole, 
      joinedAt: `2025-02-${formattedDay}`,
      documents: userDocs, // Gắn danh sách 8-12 hồ sơ vào cá nhân
    });
  }
  
  return members;
};

// Tạo data cho các nhóm với số lượng từ 15 - 48 người
export const mockMembers: Record<string, Array<Member>> = {
  '1': generateMembers('1', 15), 
  '2': generateMembers('2', 32), 
  '3': generateMembers('3', 48), 
};

export const mockGroups: Array<Group> = [
  {
    id: '1',
    name: 'Nhóm A dự án A',
    description: 'Nhóm leader và quản lý hệ thống', 
    memberCount: mockMembers['1'].length,
    members: mockMembers['1'],
    createdAt: '2025-01-01',
  },
  {
    id: '2',
    name: 'Nhóm B dự án b',
    description: 'Nhóm kiểm duyệt nội dung',
    memberCount: mockMembers['2'].length,
    members: mockMembers['2'],
    createdAt: '2025-02-01',
  },
  {
    id: '3',
    name: 'Nhóm c dự án FSi',
    description: 'Nhóm người dùng chung',
    memberCount: mockMembers['3'].length,
    members: mockMembers['3'],
    createdAt: '2025-02-15',
  },
];