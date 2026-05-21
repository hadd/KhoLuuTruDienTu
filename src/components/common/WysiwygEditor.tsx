// import '@/styles/tiptap.css'

// import type { Editor, JSONContent } from '@tiptap/core'
// import { Mark } from '@tiptap/core'
// import Highlight from '@tiptap/extension-highlight'
// import HorizontalRule from '@tiptap/extension-horizontal-rule'
// import Image from '@tiptap/extension-image'
// import { TaskItem, TaskList } from '@tiptap/extension-list'
// import Mathematics, { migrateMathStrings } from '@tiptap/extension-mathematics'
// import Subscript from '@tiptap/extension-subscript'
// import Superscript from '@tiptap/extension-superscript'
// import { TableKit } from '@tiptap/extension-table'
// import TextAlign from '@tiptap/extension-text-align'
// import { Color, TextStyle } from '@tiptap/extension-text-style'
// import Typography from '@tiptap/extension-typography'
// import { Placeholder } from '@tiptap/extensions'
// import { EditorContent, useEditor } from '@tiptap/react'
// import StarterKit from '@tiptap/starter-kit'
// import {
//   AlignCenter,
//   AlignJustify,
//   AlignLeft,
//   AlignRight,
//   Bold,
//   Calculator,
//   ImagePlus,
//   Italic,
//   List,
//   ListOrdered,
//   Underline,
// } from 'lucide-react'
// import { useEffect, useRef, useState } from 'react'
// import { useTranslation } from 'react-i18next'
// import { toast } from 'sonner'

// import { Button } from '@/components/ui/button'
// import { MathBubbleMenu } from '@/features/question-studio/components/left-panel/question-editor/MathBubbleMenu'
// import { MathFormulaModal } from '@/features/question-studio/components/left-panel/question-editor/MathFormulaModal'
// import { uploadPublicAsset } from '@/features/school-management/api/publicAssetClient'
// import { cn } from '@/lib/utils/cn'
// import { buildMixedMathInsertContent } from '@/lib/utils/tiptap-mixed-math-insert'

// const UnderlineExtension = Mark.create({
//   name: 'underline',
//   parseHTML() {
//     return [
//       { tag: 'u' },
//       {
//         style: 'text-decoration',
//         getAttrs: (value) => value === 'underline' && null,
//       },
//     ]
//   },
//   renderHTML() {
//     return ['u', 0]
//   },
//   addCommands() {
//     return {
//       setUnderline:
//         () =>
//         ({ commands }: { commands: { setMark: (n: string) => unknown } }) =>
//           commands.setMark(this.name),
//       toggleUnderline:
//         () =>
//         ({ commands }: { commands: { toggleMark: (n: string) => unknown } }) =>
//           commands.toggleMark(this.name),
//       unsetUnderline:
//         () =>
//         ({ commands }: { commands: { unsetMark: (n: string) => unknown } }) =>
//           commands.unsetMark(this.name),
//     }
//   },
// })

// export interface WysiwygEditorProps {
//   /** Initial content (HTML string or TipTap JSON) */
//   content?: string | JSONContent
//   /** Callback when content changes (HTML string) */
//   onContentChange?: (html: string) => void
//   /** Placeholder text */
//   placeholder?: string
//   /** Additional CSS classes */
//   className?: string
//   /** Whether the editor is editable */
//   editable?: boolean
//   /** School ID for image paste upload (when set, paste image is enabled) */
//   schoolId?: string
// }

// /**
//  * Base WYSIWYG TipTap editor with optional image paste (when schoolId is set).
//  * Use for rich text content, feedback, and similar use cases.
//  */
// export function WysiwygEditor({
//   content,
//   onContentChange,
//   placeholder,
//   className,
//   editable = true,
//   schoolId,
// }: WysiwygEditorProps) {
//   const { t } = useTranslation('common')
//   const editorRef = useRef<Editor | null>(null)
//   const imageInputRef = useRef<HTMLInputElement>(null)
//   const [mathModalOpen, setMathModalOpen] = useState(false)
//   const [mathModalContext, setMathModalContext] = useState<{
//     editor: Editor
//     insertAt: number
//   } | null>(null)

//   const editor = useEditor({
//     immediatelyRender: false,
//     editable,
//     extensions: [
//       StarterKit.configure({
//         horizontalRule: false,
//         dropcursor: { width: 2 },
//         link: { openOnClick: false },
//       }),
//       HorizontalRule,
//       Image.configure({
//         allowBase64: false,
//       }),
//       TextAlign.configure({
//         types: ['heading', 'paragraph'],
//         defaultAlignment: 'left',
//       }),
//       UnderlineExtension,
//       Placeholder.configure({
//         placeholder: placeholder ?? '',
//         emptyNodeClass: 'is-empty',
//       }),
//       TableKit.configure({
//         table: { resizable: true, cellMinWidth: 120 },
//       }),
//       TextStyle,
//       Color,
//       Highlight.configure({ multicolor: true }),
//       Mathematics.configure({
//         katexOptions: {
//           displayMode: false,
//           throwOnError: false,
//           strict: false,
//         },
//       }),
//       Subscript,
//       Superscript,
//       Typography,
//       TaskList,
//       TaskItem.configure({ nested: true }),
//     ],
//     onCreate: ({ editor: editorInstance }) => {
//       migrateMathStrings(editorInstance)
//     },
//     content:
//       content ??
//       ({
//         type: 'doc',
//         content: [{ type: 'paragraph' }],
//       } as JSONContent),
//     onUpdate: ({ editor: editorInstance }) => {
//       onContentChange?.(editorInstance.getHTML())
//     },
//     editorProps: {
//       handlePaste: (_view, event: ClipboardEvent): boolean => {
//         if (!editable || !schoolId) return false
//         const items = event.clipboardData?.items
//         if (!items) return false
//         let imageItem: DataTransferItem | null = null
//         for (const item of items) {
//           if (item.type.startsWith('image/')) {
//             imageItem = item
//             break
//           }
//         }
//         if (!imageItem) return false
//         event.preventDefault()
//         const currentEditor = editorRef.current
//         if (!currentEditor) return false
//         void uploadPublicAsset(schoolId, event.clipboardData, {
//           compress: true,
//           metadata: { source: 'wysiwyg-editor-paste' },
//         })
//           .then((result) => {
//             currentEditor
//               .chain()
//               .focus()
//               .setImage({ src: result.publicUrl })
//               .run()
//           })
//           .catch((err) => {
//             console.error('Failed to upload pasted image:', err)
//             toast.error(
//               err instanceof Error ? err.message : 'Failed to upload image.',
//             )
//           })
//         return true
//       },
//     },
//   })

//   useEffect(() => {
//     if (editor) editorRef.current = editor
//   }, [editor])

//   useEffect(() => {
//     if (!editor) return
//     if (typeof content === 'string') {
//       const currentHtml = editor.getHTML()
//       if (currentHtml !== content) editor.commands.setContent(content)
//     } else if (content) {
//       const currentStr = JSON.stringify(editor.getJSON())
//       const newStr = JSON.stringify(content)
//       if (currentStr !== newStr) editor.commands.setContent(content)
//     }
//   }, [editor, content])

//   useEffect(() => {
//     if (!editor) return
//     editor.setEditable(editable)
//   }, [editor, editable])

//   if (!editor) {
//     return (
//       <div className="flex items-center justify-center py-2">
//         <span className="text-sm text-muted-foreground">Loading...</span>
//       </div>
//     )
//   }

//   const handleImageFileSelect = async (
//     e: React.ChangeEvent<HTMLInputElement>,
//   ) => {
//     const file = e.target.files?.[0]
//     e.target.value = ''
//     if (!file || !schoolId || !editorRef.current) return
//     if (!file.type.startsWith('image/')) {
//       toast.error(t('errors.invalidValue', { defaultValue: 'Invalid value' }))
//       return
//     }
//     try {
//       const result = await uploadPublicAsset(schoolId, file, {
//         compress: true,
//         metadata: { source: 'wysiwyg-editor-upload' },
//       })
//       editorRef.current
//         .chain()
//         .focus()
//         .setImage({ src: result.publicUrl })
//         .run()
//     } catch (err) {
//       toast.error(
//         err instanceof Error
//           ? err.message
//           : t('errors.default', { defaultValue: 'An error occurred' }),
//       )
//     }
//   }

//   const handleMathConfirm = (latex: string) => {
//     if (!mathModalContext) return
//     const trimmed = latex.trim()
//     if (!trimmed) return
//     const content = buildMixedMathInsertContent(trimmed)
//     mathModalContext.editor
//       .chain()
//       .focus()
//       .insertContentAt(mathModalContext.insertAt, content)
//       .run()
//     setMathModalOpen(false)
//     setMathModalContext(null)
//   }

//   return (
//     <div
//       className={cn(
//         'tiptap-editor-container simple-editor flex flex-col flex-1 min-h-0',
//         className,
//       )}
//       data-mode="write"
//       data-variant="block"
//     >
//       {editable && mathModalContext && (
//         <MathFormulaModal
//           open={mathModalOpen}
//           onOpenChange={(open) => {
//             setMathModalOpen(open)
//             if (!open) setMathModalContext(null)
//           }}
//           schoolId={schoolId}
//           context={mathModalContext}
//           onConfirm={handleMathConfirm}
//         />
//       )}
//       <input
//         ref={imageInputRef}
//         type="file"
//         accept="image/*"
//         className="hidden"
//         aria-hidden
//         onChange={handleImageFileSelect}
//       />
//       <WysiwygEditorToolbar
//         editor={editor}
//         editable={editable}
//         schoolId={schoolId}
//         insertFormulaTitle={t('editor.insertFormula')}
//         insertImageTitle={t('editor.insertImage')}
//         onInsertFormula={() => {
//           const { from } = editor.state.selection
//           setMathModalContext({ editor, insertAt: from })
//           setMathModalOpen(true)
//         }}
//         onInsertImageClick={() => imageInputRef.current?.click()}
//       />
//       <div className="flex-1 min-h-0 overflow-y-auto">
//         <EditorContent editor={editor} />
//       </div>
//       {editable && <MathBubbleMenu editor={editor} />}
//     </div>
//   )
// }

// interface WysiwygEditorToolbarProps {
//   editor: Editor
//   editable?: boolean
//   schoolId?: string
//   insertFormulaTitle?: string
//   insertImageTitle?: string
//   onInsertFormula?: () => void
//   onInsertImageClick?: () => void
// }

// function WysiwygEditorToolbar({
//   editor,
//   editable = true,
//   schoolId,
//   insertFormulaTitle,
//   insertImageTitle,
//   onInsertFormula,
//   onInsertImageClick,
// }: WysiwygEditorToolbarProps) {
//   return (
//     <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50 flex-wrap shrink-0">
//       <Button
//         type="button"
//         variant={editor.isActive('bold') ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().toggleBold().run()}
//         title="Bold (Ctrl+B)"
//       >
//         <Bold className="h-4 w-4" />
//       </Button>
//       <Button
//         type="button"
//         variant={editor.isActive('italic') ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().toggleItalic().run()}
//         title="Italic (Ctrl+I)"
//       >
//         <Italic className="h-4 w-4" />
//       </Button>
//       <Button
//         type="button"
//         variant={editor.isActive('underline') ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().toggleUnderline().run()}
//         title="Underline (Ctrl+U)"
//       >
//         <Underline className="h-4 w-4" />
//       </Button>
//       <div className="h-6 w-px bg-border mx-1" />
//       <Button
//         type="button"
//         variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().setTextAlign('left').run()}
//         title="Align left"
//       >
//         <AlignLeft className="h-4 w-4" />
//       </Button>
//       <Button
//         type="button"
//         variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().setTextAlign('center').run()}
//         title="Align center"
//       >
//         <AlignCenter className="h-4 w-4" />
//       </Button>
//       <Button
//         type="button"
//         variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().setTextAlign('right').run()}
//         title="Align right"
//       >
//         <AlignRight className="h-4 w-4" />
//       </Button>
//       <Button
//         type="button"
//         variant={
//           editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'
//         }
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().setTextAlign('justify').run()}
//         title="Justify"
//       >
//         <AlignJustify className="h-4 w-4" />
//       </Button>
//       {onInsertImageClick && editable && schoolId && (
//         <>
//           <div className="h-6 w-px bg-border mx-1" />
//           <Button
//             type="button"
//             variant="ghost"
//             size="icon"
//             className="h-8 w-8"
//             onClick={onInsertImageClick}
//             title={insertImageTitle}
//           >
//             <ImagePlus className="h-4 w-4" />
//           </Button>
//         </>
//       )}
//       {onInsertFormula && editable && (
//         <>
//           <div className="h-6 w-px bg-border mx-1" />
//           <Button
//             type="button"
//             variant="ghost"
//             size="icon"
//             className="h-8 w-8"
//             onClick={onInsertFormula}
//             title={insertFormulaTitle}
//           >
//             <Calculator className="h-4 w-4" />
//           </Button>
//         </>
//       )}
//       <div className="h-6 w-px bg-border mx-1" />
//       <Button
//         type="button"
//         variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().toggleBulletList().run()}
//         title="Bullet list"
//       >
//         <List className="h-4 w-4" />
//       </Button>
//       <Button
//         type="button"
//         variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
//         size="icon"
//         className="h-8 w-8"
//         onClick={() => editor.chain().focus().toggleOrderedList().run()}
//         title="Ordered list"
//       >
//         <ListOrdered className="h-4 w-4" />
//       </Button>
//     </div>
//   )
// }
