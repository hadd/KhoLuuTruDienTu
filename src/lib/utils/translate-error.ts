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
      email: extractedEmail
    })
  }

  const editorMustBeAssignedSlotRegex =
    /^Every active editor must be assigned a slot:\s*(.+)$/i
  const editorMustBeAssignedSlotMatch = rawMessage.match(editorMustBeAssignedSlotRegex)

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

  // ==================== THÊM PHẦN 2: MAPPING CÁC LỖI TĨNH KHÁC ====================
  // Map common error messages to translation keys
  const errorTranslations: Record<string, string> = {
    'School ID is required': i18n.t('errors.schoolIdRequired', {
      ns: 'common',
    }),
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
  }

  // Check if we have a translation for this error message
  if (errorTranslations[rawMessage]) {
    return errorTranslations[rawMessage]
  }

  // Return original message if no translation found
  return rawMessage
}