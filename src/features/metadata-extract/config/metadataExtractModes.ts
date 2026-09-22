/**
 * Cấu hình tập trung cho các chế độ bóc tách metadata (Metadata Extract Modes).
 * Quản lý cả mã code, tên hiển thị tiếng Việt và mô tả giải thích tại một nơi duy nhất.
 */

export const METADATA_EXTRACT_MODES = [
  'old',
  'tt05',
  'pvep',
  'tuyen-quang',
] as const

export type MetadataExtractMode =
  | (typeof METADATA_EXTRACT_MODES)[number]
  | 'off'

export const DEFAULT_METADATA_EXTRACT_MODE: MetadataExtractMode = 'old'

export interface MetadataExtractModeMeta {
  value: MetadataExtractMode
  label: string
  labelKey: string
  description: string
  descriptionKey: string
}

export const METADATA_EXTRACT_MODE_CONFIG: Record<
  MetadataExtractMode,
  MetadataExtractModeMeta
> = {
  old: {
    value: 'old',
    label: 'Thi hành án',
    labelKey: 'mode.old',
    description: 'Hồ sơ sẽ được bóc tách theo mẫu metadata Thi hành án.',
    descriptionKey: 'modeHelp.old',
  },
  tt05: {
    value: 'tt05',
    label: 'Thông tư 05',
    labelKey: 'mode.tt05',
    description: 'Hồ sơ sẽ được bóc tách theo mẫu metadata Thông tư 05.',
    descriptionKey: 'modeHelp.tt05',
  },
  pvep: {
    value: 'pvep',
    label: 'PVEP',
    labelKey: 'mode.pvep',
    description: 'Hồ sơ sẽ được bóc tách theo mẫu metadata PVEP.',
    descriptionKey: 'modeHelp.pvep',
  },
  'tuyen-quang': {
    value: 'tuyen-quang',
    label: 'Tuyên Quang',
    labelKey: 'mode.tuyen-quang',
    description: 'Hồ sơ sẽ được bóc tách theo mẫu metadata Tuyên Quang.',
    descriptionKey: 'modeHelp.tuyen-quang',
  },
  off: {
    value: 'off',
    label: 'Tắt tự động',
    labelKey: 'mode.off',
    description: 'Hệ thống không tự bóc tách. Cần kích hoạt thủ công khi cần.',
    descriptionKey: 'modeHelp.off',
  },
}

export const METADATA_EXTRACT_MODE_LABELS: Record<MetadataExtractMode, string> = {
  old: 'Thi hành án',
  tt05: 'Thông tư 05',
  pvep: 'PVEP',
  'tuyen-quang': 'Tuyên Quang',
  off: 'Tắt tự động',
}

/**
 * Lấy nhãn tiếng Việt của chế độ bóc tách từ mã code.
 * Ưu tiên gọi hàm i18n t() nếu được cung cấp, tự động fallback về tiếng Việt mặc định.
 */
export function getMetadataExtractModeLabel(
  mode: string | null | undefined,
  t?: (key: string, options?: any) => string,
): string {
  if (!mode) return ''
  const meta = METADATA_EXTRACT_MODE_CONFIG[mode as MetadataExtractMode]
  if (!meta) return mode
  return t ? t(meta.labelKey, { defaultValue: meta.label }) : meta.label
}

/**
 * Lấy mô tả chi tiết của chế độ bóc tách từ mã code.
 */
export function getMetadataExtractModeDescription(
  mode: string | null | undefined,
  t?: (key: string, options?: any) => string,
): string {
  if (!mode) return ''
  const meta = METADATA_EXTRACT_MODE_CONFIG[mode as MetadataExtractMode]
  if (!meta) return ''
  return t ? t(meta.descriptionKey, { defaultValue: meta.description }) : meta.description
}

/**
 * Trả về danh sách options (mã code) cho các dropdown selector.
 * Tự động bổ sung chế độ 'off' (Tắt tự động) nếu hệ thống đang được cấu hình ở chế độ 'off'.
 */
export function getMetadataExtractModeOptions(
  currentMode?: string | null,
): MetadataExtractMode[] {
  if (currentMode === 'off') {
    return [...METADATA_EXTRACT_MODES, 'off']
  }
  return [...METADATA_EXTRACT_MODES]
}

/**
 * Trả về danh sách options đầy đủ (value + label tiếng Việt + description) cho các ô chọn trên UI.
 */
export function getMetadataExtractModeSelectOptions(
  currentMode?: string | null,
  t?: (key: string, options?: any) => string,
): Array<{ value: MetadataExtractMode; label: string; description: string }> {
  const modes = getMetadataExtractModeOptions(currentMode)
  return modes.map((mode) => ({
    value: mode,
    label: getMetadataExtractModeLabel(mode, t),
    description: getMetadataExtractModeDescription(mode, t),
  }))
}
