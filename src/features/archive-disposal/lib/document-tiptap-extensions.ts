import { TextStyleKit } from '@tiptap/extension-text-style'

export const DOCUMENT_FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Tahoma',
  'Verdana',
] as const

export const DOCUMENT_FONT_SIZES = ['10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt'] as const

export const documentTextStyleExtensions = [
  TextStyleKit.configure({
    backgroundColor: false,
    color: false,
    lineHeight: false,
  }),
]
