import type { MetadataSchemaGroupT } from '@/features/group/types'
import type { DataTreeNodeT } from '@/features/data-management/types'

import type { DocumentTypeTemplateT } from '@/features/data-config/types'

interface MockAssignmentLevelT {
  id: string
  name: string
}

interface MockDocumentAssignmentConfigT {
  templateId: string
  levels: Array<MockAssignmentLevelT>
  fieldKeysByLevelId: Record<string, Array<string>>
}

interface MockDataConfigStateT {
  templates: Array<DocumentTypeTemplateT>
  assignmentsByTemplateId: Record<string, MockDocumentAssignmentConfigT>
  mockDossierTree: DataTreeNodeT
}

const MOCK_SCHEMA_GROUPS_A: Array<MetadataSchemaGroupT> = [
  {
    groupCode: 'ban_an',
    groupName: 'Bản án',
    isDynamic: false,
    fields: [
      { key: 'ban_an.so_ho_so', name: 'so_ho_so', display: 'Số hồ sơ' },
      { key: 'ban_an.ngay_ban_an', name: 'ngay_ban_an', display: 'Ngày bản án' },
      { key: 'ban_an.toa_an', name: 'toa_an', display: 'Tòa án' },
    ],
  },
  {
    groupCode: 'bi_can',
    groupName: 'Bị can',
    isDynamic: true,
    fields: [
      { key: 'bi_can.ho_ten', name: 'ho_ten', display: 'Họ và tên' },
      { key: 'bi_can.ngay_sinh', name: 'ngay_sinh', display: 'Ngày sinh' },
      { key: 'bi_can.dia_chi', name: 'dia_chi', display: 'Địa chỉ' },
    ],
  },
]

const MOCK_SCHEMA_GROUPS_B: Array<MetadataSchemaGroupT> = [
  {
    groupCode: 'ho_so',
    groupName: 'Hồ sơ',
    isDynamic: false,
    fields: [
      { key: 'ho_so.ma_ho_so', name: 'ma_ho_so', display: 'Mã hồ sơ' },
      { key: 'ho_so.loai_ho_so', name: 'loai_ho_so', display: 'Loại hồ sơ' },
    ],
  },
  {
    groupCode: 'tai_lieu',
    groupName: 'Tài liệu',
    isDynamic: false,
    fields: [
      { key: 'tai_lieu.ten_tai_lieu', name: 'ten_tai_lieu', display: 'Tên tài liệu' },
      { key: 'tai_lieu.so_trang', name: 'so_trang', display: 'Số trang' },
      { key: 'tai_lieu.ngay_lap', name: 'ngay_lap', display: 'Ngày lập' },
    ],
  },
]

const MOCK_SCHEMA_GROUPS_C: Array<MetadataSchemaGroupT> = [
  {
    groupCode: 'quyet_dinh',
    groupName: 'Quyết định',
    isDynamic: false,
    fields: [
      { key: 'quyet_dinh.so_quyet_dinh', name: 'so_quyet_dinh', display: 'Số quyết định' },
      { key: 'quyet_dinh.ngay_quyet_dinh', name: 'ngay_quyet_dinh', display: 'Ngày quyết định' },
    ],
  },
]

export const SEED_TEMPLATES: Array<DocumentTypeTemplateT> = [
  {
    id: 'template-1',
    name: 'Template 1',
    groups: MOCK_SCHEMA_GROUPS_A,
  },
  {
    id: 'template-2',
    name: 'Template 2',
    groups: MOCK_SCHEMA_GROUPS_B,
  },
  {
    id: 'template-3',
    name: 'Template 3',
    groups: MOCK_SCHEMA_GROUPS_C,
  },
]

export const MOCK_DOSSIER_TREE: DataTreeNodeT = {
  id: 'root',
  name: 'Dữ liệu',
  type: 'folder',
  parentId: null,
  children: [
    {
      id: 'folder-1',
      name: 'Hồ sơ hình sự',
      type: 'folder',
      parentId: 'root',
      sizeBytes: 0,
      uploadedAt: '',
      uploadedBy: '',
      children: [
        {
          id: 'record-1',
          name: 'HS-2024-001',
          type: 'record',
          parentId: 'folder-1',
          dossierId: 'dossier-1',
          sizeBytes: 0,
          uploadedAt: '',
          uploadedBy: '',
          children: [
            {
              id: 'doc-1',
              name: 'ban_an.pdf',
              type: 'document',
              parentId: 'record-1',
              sizeBytes: 1024,
              uploadedAt: '',
              uploadedBy: '',
              children: [],
            },
          ],
        },
        {
          id: 'record-2',
          name: 'HS-2024-002',
          type: 'record',
          parentId: 'folder-1',
          dossierId: 'dossier-2',
          sizeBytes: 0,
          uploadedAt: '',
          uploadedBy: '',
          children: [],
        },
      ],
    },
    {
      id: 'folder-2',
      name: 'Hồ sơ dân sự',
      type: 'folder',
      parentId: 'root',
      sizeBytes: 0,
      uploadedAt: '',
      uploadedBy: '',
      children: [
        {
          id: 'record-3',
          name: 'HS-2024-003',
          type: 'record',
          parentId: 'folder-2',
          dossierId: 'dossier-3',
          sizeBytes: 0,
          uploadedAt: '',
          uploadedBy: '',
          children: [],
        },
      ],
    },
  ],
  sizeBytes: 0,
  uploadedAt: '',
  uploadedBy: '',
}

const SEED_ASSIGNMENTS: Record<string, MockDocumentAssignmentConfigT> = {
  'template-1': {
    templateId: 'template-1',
    levels: [
      { id: 'level-1', name: 'Cấp 1' },
      { id: 'level-2', name: 'Cấp 2' },
    ],
    fieldKeysByLevelId: {
      'level-1': ['ban_an.so_ho_so', 'ban_an.ngay_ban_an'],
      'level-2': ['bi_can.ho_ten'],
    },
  },
  'template-2': {
    templateId: 'template-2',
    levels: [{ id: 'level-1', name: 'Cấp nhập liệu' }],
    fieldKeysByLevelId: {
      'level-1': ['ho_so.ma_ho_so'],
    },
  },
  'template-3': {
    templateId: 'template-3',
    levels: [],
    fieldKeysByLevelId: {},
  },
}

export function createInitialDataConfigState(): MockDataConfigStateT {
  return {
    templates: [...SEED_TEMPLATES],
    assignmentsByTemplateId: { ...SEED_ASSIGNMENTS },
    mockDossierTree: MOCK_DOSSIER_TREE,
  }
}

export function createMockSchemaFromSeed(): Array<MetadataSchemaGroupT> {
  return structuredClone(MOCK_SCHEMA_GROUPS_A)
}
