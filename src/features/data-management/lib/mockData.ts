import type { DataTreeNodeT } from '@/features/data-management/types'

const DEMO_PDF = '/mock-data-preview.pdf'

const now = new Date().toISOString()

export const MOCK_DATA_ROOT_ID = 'dm-root'

export function createSeedDataTree(): DataTreeNodeT {
  return {
    id: MOCK_DATA_ROOT_ID,
    name: 'root',
    type: 'record',
    parentId: null,
    sizeBytes: 0,
    uploadedAt: now,
    uploadedBy: 'Admin Demo',
    children: [
      {
        id: 'dm-record-a',
        name: 'Hồ sơ A',
        type: 'record',
        parentId: MOCK_DATA_ROOT_ID,
        sizeBytes: 245_760,
        uploadedAt: now,
        uploadedBy: 'Admin Demo',
        children: [
          {
            id: 'dm-doc-a1',
            name: 'Báo cáo.pdf',
            type: 'document',
            parentId: 'dm-record-a',
            children: [],
            sizeBytes: 132_000,
            uploadedAt: now,
            uploadedBy: 'Admin Demo',
            mimeType: 'application/pdf',
            fileUrl: DEMO_PDF,
          },
          {
            id: 'dm-doc-a2',
            name: 'Phụ lục.pdf',
            type: 'document',
            parentId: 'dm-record-a',
            children: [],
            sizeBytes: 113_760,
            uploadedAt: now,
            uploadedBy: 'Admin Demo',
            mimeType: 'application/pdf',
            fileUrl: DEMO_PDF,
          },
        ],
      },
      {
        id: 'dm-record-b',
        name: 'Hồ sơ B',
        type: 'record',
        parentId: MOCK_DATA_ROOT_ID,
        sizeBytes: 88_000,
        uploadedAt: now,
        uploadedBy: 'Admin Demo',
        children: [
          {
            id: 'dm-record-b-inner',
            name: 'Thư mục con',
            type: 'record',
            parentId: 'dm-record-b',
            sizeBytes: 88_000,
            uploadedAt: now,
            uploadedBy: 'Admin Demo',
            children: [
              {
                id: 'dm-doc-b1',
                name: 'Tài liệu nội bộ.pdf',
                type: 'document',
                parentId: 'dm-record-b-inner',
                children: [],
                sizeBytes: 88_000,
                uploadedAt: now,
                uploadedBy: 'Admin Demo',
                mimeType: 'application/pdf',
                fileUrl: DEMO_PDF,
              },
            ],
          },
        ],
      },
      {
        id: 'dm-folder-1',
        name: 'Thư mục',
        type: 'folder',
        parentId: MOCK_DATA_ROOT_ID,
        sizeBytes: 0,
        uploadedAt: now,
        uploadedBy: 'Admin Demo',
        children: [],
      },
    ],
  }
}
