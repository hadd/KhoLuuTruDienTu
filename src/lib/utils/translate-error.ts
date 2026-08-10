// import { isAxiosError } from 'axios'
// import i18n from 'i18next'

// /**
//  * Translates common error messages that may come from loaders or API calls.
//  * If the error message matches a known pattern, returns the translated version.
//  * Otherwise, returns the original message.
//  */
// export function translateError(error: unknown): string {
//   if (isAxiosError(error) && error.response?.data) {
//     const data = error.response.data
//     // Handle the specific backend error structure
//     if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
//       return data.error
//     }
//   }

//   if (!(error instanceof Error)) {
//     return i18n.t('errors.defaultDescription', { ns: 'common' })
//   }

//   const message = error.message

//   // Map common error messages to translation keys
//   const errorTranslations: Record<string, string> = {
//     'School ID is required': i18n.t('errors.schoolIdRequired', {
//       ns: 'common',
//     }),
//   }

//   // Check if we have a translation for this error message
//   if (errorTranslations[message]) {
//     return errorTranslations[message]
//   }

//   // Return original message if no translation found
//   return message
// }

import { isAxiosError } from 'axios'
import i18n from 'i18next'

const DATA_CONFIG_NS = 'data-config'

function tDataConfigApi(
  key: string,
  params?: Record<string, string>,
): string {
  return i18n.t(`errors.api.${key}`, { ns: DATA_CONFIG_NS, ...params })
}

function translateDataConfigApiPart(message: string): string | null {
  const staticErrors: Record<string, string> = {
    'Metadata template not found': tDataConfigApi('templateNotFound'),
    'Template is used by an active permission config': tDataConfigApi(
      'templateInUse',
    ),
    'Cannot deactivate template because it is currently used by a group via permission config':
      tDataConfigApi('templateCannotDeactivate'),
    'Dossier has no OCR metadata': tDataConfigApi('dossierNoOcrMetadata'),
    'Invalid OCR metadata format': tDataConfigApi('invalidOcrMetadataFormat'),
    'OCR metadata has no fields to catalog': tDataConfigApi(
      'ocrMetadataNoFields',
    ),
    'Metadata permission config not found': tDataConfigApi(
      'permissionConfigNotFound',
    ),
    'Cannot change slots while config is bound to a group': i18n.t(
      'documentAssignment.errors.cannotChangeSlotsWhileBoundToGroup',
      { ns: DATA_CONFIG_NS },
    ),
    'Config is bound to a group': tDataConfigApi('configBoundToGroup'),
    'Permission config is not ready': tDataConfigApi('permissionConfigNotReady'),
    'Group not found': tDataConfigApi('groupNotFound'),
    'Group has no metadata permission config': tDataConfigApi(
      'groupNoPermissionConfig',
    ),
    'Metadata export preset not found': tDataConfigApi('exportPresetNotFound'),
    'Export requires presetId or columns': tDataConfigApi(
      'exportRequiresPresetOrColumns',
    ),
    'Invalid export columns JSON': tDataConfigApi('invalidExportColumnsJson'),
    'Export columns must not be empty': i18n.t(
      'metadataExport.validation.noColumns',
      { ns: DATA_CONFIG_NS },
    ),
    'Column header must not be empty': i18n.t(
      'metadataExport.validation.missingHeaderInline',
      { ns: DATA_CONFIG_NS },
    ),
  }

  if (staticErrors[message]) {
    return staticErrors[message]
  }

  const dynamicPatterns: Array<{
    regex: RegExp
    translate: (match: RegExpMatchArray) => string
  }> = [
    {
      regex: /^Invalid patterns:\s*(.+)$/i,
      translate: (match) =>
        tDataConfigApi('invalidPatterns', { detail: match[1].trim() }),
    },
    {
      regex: /^Uncovered keys:\s*(.+)$/i,
      translate: (match) =>
        tDataConfigApi('uncoveredKeys', { detail: match[1].trim() }),
    },
    {
      regex: /^Overlapping keys:\s*(.+)$/i,
      translate: (match) =>
        tDataConfigApi('overlappingKeys', { detail: match[1].trim() }),
    },
    {
      regex: /^Editors assigned to multiple slots:\s*(.+)$/i,
      translate: (match) =>
        tDataConfigApi('editorsAssignedToMultipleSlots', {
          detail: match[1].trim(),
        }),
    },
    {
      regex: /^Slots without editors:\s*(.+)$/i,
      translate: (match) =>
        i18n.t('permissionAssignments.errors.slotsWithoutEditors', {
          ns: 'group',
          detail: match[1].trim(),
        }),
    },
    {
      regex: /^Not an active editor in group:\s*(.+)$/i,
      translate: (match) =>
        tDataConfigApi('notActiveEditorInGroup', { detail: match[1].trim() }),
    },
    {
      regex: /^Every active editor must be assigned a slot:\s*(.+)$/i,
      translate: (match) =>
        i18n.t('permissionAssignments.errors.editorMustBeAssignedSlot', {
          ns: 'group',
          detail: match[1].trim(),
        }),
    },
    {
      regex: /^Editor (.+) has no permission slot assigned$/i,
      translate: (match) =>
        tDataConfigApi('editorNoPermissionSlot', { editorId: match[1].trim() }),
    },
    {
      regex: /^Invalid permission slot for editor (.+): (.+)$/i,
      translate: (match) =>
        tDataConfigApi('invalidPermissionSlotForEditor', {
          editorId: match[1].trim(),
          slotCode: match[2].trim(),
        }),
    },
    {
      regex: /^Duplicate column header:\s*(.+)$/i,
      translate: () =>
        i18n.t('metadataExport.validation.duplicateHeaderInline', {
          ns: DATA_CONFIG_NS,
        }),
    },
    {
      regex: /^Column "(.+)" must include at least one field$/i,
      translate: () =>
        i18n.t('metadataExport.validation.missingFieldsInline', {
          ns: DATA_CONFIG_NS,
        }),
    },
    {
      regex: /^Column "(.+)" has invalid field keys$/i,
      translate: (match) =>
        tDataConfigApi('columnInvalidFieldKeys', { header: match[1].trim() }),
    },
  ]

  for (const { regex, translate } of dynamicPatterns) {
    const match = message.match(regex)
    if (match) {
      return translate(match)
    }
  }

  return null
}

function translateDataConfigApiError(message: string): string | null {
  if (message.includes('. ')) {
    const parts = message.split('. ')
    const translatedParts = parts.map((part) => {
      const translated = translateDataConfigApiPart(part.trim())
      return translated ?? part.trim()
    })

    if (translatedParts.some((part, index) => part !== parts[index]?.trim())) {
      return translatedParts.join('. ')
    }
  }

  return translateDataConfigApiPart(message)
}

/**
 * Translates common error messages that may come from loaders or API calls.
 * If the error message matches a known pattern, returns the translated version.
 * Otherwise, returns the original message.
 */
export function translateError(error: unknown): string {
  let rawMessage = ''

  // 1. Trích xuất chuỗi thông báo lỗi gốc (raw message)
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data
    if (data && typeof data === 'object') {
      if ('error' in data && typeof data.error === 'string') {
        rawMessage = data.error
      } else if ('message' in data && typeof data.message === 'string') {
        rawMessage = data.message
      } else if ('detail' in data && typeof data.detail === 'string') {
        rawMessage = data.detail
      } else {
        rawMessage = error.message
      }
    } else {
      rawMessage = error.message
    }
  } else if (error instanceof Error) {
    rawMessage = error.message
  } else if (typeof error === 'string') {
    rawMessage = error
  }

  // Nếu không lấy được message nào hợp lệ, trả về lỗi mặc định
  if (!rawMessage) {
    return i18n.t('errors.defaultDescription', { ns: 'common' })
  }

  // ==================== THÊM PHẦN 1: XỬ LÝ LỖI ĐỘNG (REGEX) ====================
  // Bắt cấu trúc câu chứa email động từ backend (Không phân biệt hoa thường /i)
  const emailExistsRegex = /^User with email (.+@.+\..+) already exists$/i
  const emailMatch = rawMessage.match(emailExistsRegex)

  if (emailMatch) {
    const extractedEmail = emailMatch[1] // Bóc tách lấy chuỗi "long1610@gmail.com"

    // Gọi i18n dịch và truyền email vào làm tham số biến động
    return i18n.t('errors.emailAlreadyExists' as any, {
      ns: 'user', // Tên file user.json của bạn
      email: extractedEmail,
    })
  }

  const editorMustBeAssignedSlotRegex =
    /^Every active editor must be assigned a slot:\s*(.+)$/i
  const editorMustBeAssignedSlotMatch = rawMessage.match(
    editorMustBeAssignedSlotRegex,
  )

  if (editorMustBeAssignedSlotMatch) {
    return i18n.t('permissionAssignments.errors.editorMustBeAssignedSlot', {
      ns: 'group',
      detail: editorMustBeAssignedSlotMatch[1].trim(),
    })
  }

  const slotsWithoutEditorsRegex = /^Slots without editors:\s*(.+)$/i
  const slotsWithoutEditorsMatch = rawMessage.match(slotsWithoutEditorsRegex)

  if (slotsWithoutEditorsMatch) {
    return i18n.t('permissionAssignments.errors.slotsWithoutEditors', {
      ns: 'group',
      detail: slotsWithoutEditorsMatch[1].trim(),
    })
  }

  const mixedFolderRegex =
    /^Invalid structure: a folder cannot contain both PDF files and subfolders with PDFs(?: \(([^)]+)\))?$/i
  const mixedFolderMatch = rawMessage.match(mixedFolderRegex)

  if (mixedFolderMatch) {
    const folderPath = mixedFolderMatch[1]?.trim() ?? ''
    if (!folderPath || folderPath === 'raw') {
      return i18n.t('promote.errors.mixedFolderDestination', { ns: 'scan-intake' })
    }
    return i18n.t('organize.mixedFolder', {
      ns: 'scan-intake',
      folder: folderPath,
    })
  }

  const schemaLengthRegex =
    /Expected string length(?: to be)? greater or equal to (\d+)/i
  const schemaLengthMatch = rawMessage.match(schemaLengthRegex)
  if (schemaLengthMatch) {
    return i18n.t('errors.schemaMinLength', {
      ns: 'common',
      min: schemaLengthMatch[1],
    })
  }

  const schemaArrayLengthRegex =
    /Expected array length(?: to be)? greater or equal to (\d+)/i
  const schemaArrayLengthMatch = rawMessage.match(schemaArrayLengthRegex)
  if (schemaArrayLengthMatch) {
    return i18n.t('errors.schemaMinItems', {
      ns: 'common',
      min: schemaArrayLengthMatch[1],
    })
  }

  if (/Column header must not be empty/i.test(rawMessage)) {
    return i18n.t('metadataExport.validation.missingHeaderInline', {
      ns: 'data-config',
    })
  }

  const exportFileLimitRegex =
    /Export vượt quá giới hạn (\d+) file \(hiện có (\d+) file\)/i
  const exportFileLimitMatch = rawMessage.match(exportFileLimitRegex)
  if (exportFileLimitMatch) {
    return i18n.t('export.fileLimitExceeded', {
      ns: 'archive-warehouse',
      limit: exportFileLimitMatch[1],
      count: exportFileLimitMatch[2],
    })
  }

  if (/must include at least one field/i.test(rawMessage)) {
    return i18n.t('metadataExport.validation.missingFieldsInline', {
      ns: 'data-config',
    })
  }

  if (/Duplicate column header/i.test(rawMessage)) {
    return i18n.t('metadataExport.validation.duplicateHeaderInline', {
      ns: 'data-config',
    })
  }

  if (/Export columns must not be empty/i.test(rawMessage)) {
    return i18n.t('metadataExport.validation.noColumns', { ns: 'data-config' })
  }

  const dataConfigApiError = translateDataConfigApiError(rawMessage)
  if (dataConfigApiError) {
    return dataConfigApiError
  }

  // ==================== THÊM PHẦN 2: MAPPING CÁC LỖI TĨNH KHÁC ====================
  // Map common error messages to translation keys
  const errorTranslations: Record<string, string> = {
    'Hồ sơ đã có trong danh mục': i18n.t(
      'disposal.catalogDuplicateAlreadyInCatalog',
      { ns: 'archive-disposal' },
    ),
    'Hồ sơ hoặc tài liệu thuộc danh sách hết hạn/trùng lặp — chỉ được xử lý hủy theo quy trình Hội đồng xét hủy':
      i18n.t('disposal.candidateWarehouseLockHint', { ns: 'archive-warehouse' }),
    'Dossier already has an active MAKER assignment': i18n.t(
      'actionDialog.assignEditor.errors.alreadyHasMaker',
      { ns: 'data-management' },
    ),
    'Dossier not found': i18n.t('errors.dossierNotFound', {
      ns: 'data-management',
    }),
    'No assigned dossier found': i18n.t('errors.noAssignedDossier', {
      ns: 'data-management',
    }),
    'Only group leader can view group dashboard statistics': i18n.t(
      'errors.groupLeaderOnly',
      { ns: 'qc-dashboard' },
    ),
    'Cannot change slots while config is bound to a group': i18n.t(
      'documentAssignment.errors.cannotChangeSlotsWhileBoundToGroup',
      { ns: 'data-config' },
    ),
    'Only administrators can change the project manager': i18n.t(
      'errors.onlyAdminCanChangeProjectManager',
      { ns: 'project-manager' },
    ),
    'Assigned user must have the project manager role': i18n.t(
      'errors.assignedUserMustHaveProjectRead',
      { ns: 'project-manager' },
    ),
    'Project manager user is inactive': i18n.t(
      'errors.projectManagerUserInactive',
      { ns: 'project-manager' },
    ),
    "Property 'managerId' should be uuid": i18n.t(
      'errors.managerIdMustBeUuid',
      { ns: 'project-manager' },
    ),
  }

  // Check if we have a translation for this error message
  if (errorTranslations[rawMessage]) {
    return errorTranslations[rawMessage]
  }

  // Return original message if no translation found
  return rawMessage
}
