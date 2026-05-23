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
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      rawMessage = data.error // Lấy được: "User with email long1610@gmail.com already exists"
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

  // ==================== THÊM PHẦN 2: MAPPING CÁC LỖI TĨNH KHÁC ====================
  // Map common error messages to translation keys
  const errorTranslations: Record<string, string> = {
    'School ID is required': i18n.t('errors.schoolIdRequired', {
      ns: 'common',
    }),
    // Bạn có thể thêm các lỗi tĩnh khác từ BE vào đây nếu muốn dịch ở FE:
    // 'Tên lỗi tiếng anh từ BE': i18n.t('key.trong.file.json', { ns: 'namespace' }),
  }

  // Check if we have a translation for this error message
  if (errorTranslations[rawMessage]) {
    return errorTranslations[rawMessage]
  }

  // Return original message if no translation found
  return rawMessage
}