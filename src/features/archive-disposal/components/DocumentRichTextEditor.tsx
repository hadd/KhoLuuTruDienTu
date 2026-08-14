import '@/styles/tiptap.css'

import type { Editor, JSONContent } from '@tiptap/core'
import { Mark } from '@tiptap/core'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  EyeOff,
  Italic,
  List,
  ListOrdered,
  Table2,
  Underline,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DOCUMENT_FONT_FAMILIES,
  DOCUMENT_FONT_SIZES,
  documentTextStyleExtensions,
} from '@/features/archive-disposal/lib/document-tiptap-extensions'
import {
  DEFAULT_TABLE_BORDER_COLOR,
  DocumentTable,
  DocumentTableRow,
} from '@/features/archive-disposal/lib/document-table-extension'
import { cn } from '@/lib/utils/cn'

const UnderlineExtension = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration', getAttrs: (value) => value === 'underline' && null }]
  },
  renderHTML() {
    return ['u', 0]
  },
  addCommands() {
    return {
      setUnderline:
        () =>
        ({ commands }: { commands: { setMark: (n: string) => unknown } }) =>
          commands.setMark(this.name),
      toggleUnderline:
        () =>
        ({ commands }: { commands: { toggleMark: (n: string) => unknown } }) =>
          commands.toggleMark(this.name),
      unsetUnderline:
        () =>
        ({ commands }: { commands: { unsetMark: (n: string) => unknown } }) =>
          commands.unsetMark(this.name),
    }
  },
})

export type DocumentRichTextEditorProps = {
  content?: JSONContent
  onContentChange?: (content: JSONContent) => void
  placeholder?: string
  className?: string
  editable?: boolean
}

export function DocumentRichTextEditor({
  content,
  onContentChange,
  placeholder,
  className,
  editable = true,
}: DocumentRichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      BulletList,
      OrderedList,
      ListItem,
      TableKit.configure({
        table: false,
        tableRow: false,
      }),
      DocumentTable.configure({
        resizable: true,
        lastColumnResizable: true,
      }),
      DocumentTableRow,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'left',
      }),
      ...documentTextStyleExtensions,
      UnderlineExtension,
      Placeholder.configure({
        placeholder: placeholder ?? '',
        emptyNodeClass: 'is-empty',
      }),
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      onContentChange?.(ed.getJSON())
    },
  })

  useEffect(() => {
    if (!editor || !content) return
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(content)
    if (current !== next) editor.commands.setContent(content)
  }, [editor, content])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  if (!editor) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {editable ? <DocumentRichTextToolbar editor={editor} /> : null}
      <div className="document-a4-workspace flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <div className="document-a4-canvas">
          <div className="document-page-a4">
            <EditorContent editor={editor} className="document-page-a4-body" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DocumentRichTextToolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation('archive-disposal')
  const [tableDialogOpen, setTableDialogOpen] = useState(false)
  const [tableRows, setTableRows] = useState('3')
  const [tableCols, setTableCols] = useState('3')
  const [tableHeaderRow, setTableHeaderRow] = useState(false)
  const [, setToolbarRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setToolbarRevision((value) => value + 1)
    editor.on('selectionUpdate', refresh)
    editor.on('transaction', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('transaction', refresh)
    }
  }, [editor])

  const textStyle = editor.getAttributes('textStyle') as {
    fontFamily?: string | null
    fontSize?: string | null
  }
  const currentFont = textStyle.fontFamily ?? 'default'
  const currentSize = textStyle.fontSize ?? 'default'

  const clampTableDim = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return 1
    return Math.min(20, Math.max(1, parsed))
  }

  const handleInsertTable = () => {
    const rows = clampTableDim(tableRows)
    const cols = clampTableDim(tableCols)
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: tableHeaderRow }).run()
    setTableDialogOpen(false)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-2 shrink-0">
        <Select
          value={currentFont}
          onValueChange={(value) => {
            if (value === 'default') {
              editor.chain().focus().unsetFontFamily().run()
              return
            }
            editor.chain().focus().setFontFamily(value).run()
          }}
        >
          <SelectTrigger className="h-8 w-[168px]" title={t('documentEditor.fontFamily')}>
            <SelectValue placeholder={t('documentEditor.fontFamily')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('documentEditor.fontDefault')}</SelectItem>
            {DOCUMENT_FONT_FAMILIES.map((font) => (
              <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentSize}
          onValueChange={(value) => {
            if (value === 'default') {
              editor.chain().focus().unsetFontSize().run()
              return
            }
            editor.chain().focus().setFontSize(value).run()
          }}
        >
          <SelectTrigger className="h-8 w-[88px]" title={t('documentEditor.fontSize')}>
            <SelectValue placeholder={t('documentEditor.fontSize')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('documentEditor.fontDefault')}</SelectItem>
            {DOCUMENT_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify className="size-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton title={t('documentEditor.insertTable')} onClick={() => setTableDialogOpen(true)}>
          <Table2 className="size-4" />
        </ToolbarButton>
        {editor.isActive('table') ? <TableBorderControls editor={editor} /> : null}
      </div>

      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('documentEditor.insertTableTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="table-rows">{t('documentEditor.tableRows')}</Label>
                <Input
                  id="table-rows"
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(event) => setTableRows(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-cols">{t('documentEditor.tableCols')}</Label>
                <Input
                  id="table-cols"
                  type="number"
                  min={1}
                  max={20}
                  value={tableCols}
                  onChange={(event) => setTableCols(event.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tableHeaderRow}
                onChange={(event) => setTableHeaderRow(event.target.checked)}
              />
              {t('documentEditor.tableHeaderRow')}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTableDialogOpen(false)}>
              {t('documentEditor.cancel')}
            </Button>
            <Button type="button" onClick={handleInsertTable}>
              {t('documentEditor.insertTableConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TableBorderControls({ editor }: { editor: Editor }) {
  const { t } = useTranslation('archive-disposal')
  const attrs = editor.getAttributes('table') as {
    borderColor?: string | null
    borderVisible?: boolean
    borderless?: boolean
  }
  const visible = attrs.borderVisible !== false && attrs.borderless !== true
  const color = attrs.borderColor || DEFAULT_TABLE_BORDER_COLOR

  return (
    <div className="ml-1 flex items-center gap-1 rounded-md border border-border bg-background px-1 py-0.5">
      <ToolbarButton
        title={visible ? t('documentEditor.tableBorderHide') : t('documentEditor.tableBorderShow')}
        active={!visible}
        onClick={() => editor.chain().focus().toggleTableBorder().run()}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </ToolbarButton>
      <label
        className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
        title={t('documentEditor.tableBorderColor')}
      >
        <input
          type="color"
          className="size-5 cursor-pointer rounded border border-border bg-transparent p-0"
          value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : DEFAULT_TABLE_BORDER_COLOR}
          onChange={(event) => editor.chain().focus().setTableBorderColor(event.target.value).run()}
        />
      </label>
      <span className="hidden max-w-[220px] truncate pr-1 text-xs text-muted-foreground sm:inline">
        {t('documentEditor.tableResizeHint')}
      </span>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="size-8"
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
