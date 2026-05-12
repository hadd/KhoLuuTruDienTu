import type { FieldRenderer, FieldType, FieldVariant } from '../types'
import { renderBooleanField } from './BooleanField'
import { renderDateField } from './DateField'
import { renderEmailField } from './EmailField'
import { renderMultiSelectField } from './MultiSelectField'
import { renderNumberField } from './NumberField'
import { renderSelectField } from './SelectField'
import { renderTextareaField } from './TextareaField'
import { renderTextField } from './TextField'

/**
 * Field registry maps field types to their renderers
 */
const fieldRegistry: Record<FieldType, FieldRenderer> = {
  boolean: renderBooleanField,
  date: renderDateField,
  textarea: renderTextareaField,
  select: renderSelectField,
  number: renderNumberField,
  email: renderEmailField,
  text: renderTextField,
  multiselect: renderMultiSelectField,
}

/**
 * Get field renderer for a given field type and variant
 * @param type - The field type
 * @param variant - Optional variant (e.g., 'switch', 'checkbox' for boolean)
 * @returns The appropriate field renderer
 */
export function getFieldRenderer(
  type: FieldType,
  variant?: FieldVariant,
): FieldRenderer {
  const renderer = fieldRegistry[type]

  if (!renderer) {
    // Fallback to text field if type is not found
    return fieldRegistry.text
  }

  return renderer
}

/**
 * Register a custom field renderer (for extensibility)
 * @param type - The field type to register
 * @param renderer - The renderer function
 */
export function registerFieldRenderer(
  type: FieldType,
  renderer: FieldRenderer,
): void {
  fieldRegistry[type] = renderer
}
