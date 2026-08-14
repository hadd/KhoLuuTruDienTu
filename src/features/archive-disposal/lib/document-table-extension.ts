import { Table, TableRow, TableView } from '@tiptap/extension-table'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

export const DEFAULT_TABLE_BORDER_COLOR = '#9ca3af'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    documentTable: {
      setTableBorderColor: (color: string) => ReturnType
      setTableBorderVisible: (visible: boolean) => ReturnType
      toggleTableBorder: () => ReturnType
    }
  }
}

function applyTableChrome(table: HTMLTableElement, node: ProseMirrorNode) {
  const color =
    typeof node.attrs.borderColor === 'string' && node.attrs.borderColor
      ? node.attrs.borderColor
      : DEFAULT_TABLE_BORDER_COLOR
  const visible = node.attrs.borderVisible !== false && node.attrs.borderless !== true
  table.style.setProperty('--table-border-color', color)
  table.setAttribute('data-border-color', color)
  table.setAttribute('data-border-visible', visible ? 'true' : 'false')
  if (node.attrs.borderless) table.setAttribute('data-borderless', 'true')
  else table.removeAttribute('data-borderless')
}

class DocumentTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth)
    applyTableChrome(this.table, node)
  }

  update(node: ProseMirrorNode) {
    const ok = super.update(node)
    if (ok) applyTableChrome(this.table, node)
    return ok
  }
}

const rowResizeKey = new PluginKey('documentTableRowResize')

function tableRowResizePlugin() {
  return new Plugin({
    key: rowResizeKey,
    props: {
      handleDOMEvents: {
        mousedown(view: EditorView, event: Event) {
          if (!view.editable) return false
          const mouseEvent = event as MouseEvent
          if (mouseEvent.button !== 0) return false
          const target = mouseEvent.target
          if (!(target instanceof HTMLElement)) return false
          const cell = target.closest('td, th')
          if (!(cell instanceof HTMLElement)) return false
          if (!cell.closest('.document-page-a4-body')) return false

          const rect = cell.getBoundingClientRect()
          if (rect.right - mouseEvent.clientX <= 8) return false
          if (rect.bottom - mouseEvent.clientY > 8) return false

          const pos = view.posAtDOM(cell, 0)
          const $pos = view.state.doc.resolve(pos)
          let rowDepth = -1
          for (let depth = $pos.depth; depth > 0; depth--) {
            if ($pos.node(depth).type.name === 'tableRow') {
              rowDepth = depth
              break
            }
          }
          if (rowDepth < 0) return false

          const rowPos = $pos.before(rowDepth)
          const rowEl = cell.parentElement
          const startY = mouseEvent.clientY
          const startHeight =
            rowEl?.getBoundingClientRect().height ??
            (typeof $pos.node(rowDepth).attrs.height === 'number'
              ? $pos.node(rowDepth).attrs.height
              : 28)

          mouseEvent.preventDefault()
          document.body.classList.add('document-row-resizing')

          const onMove = (moveEvent: MouseEvent) => {
            const next = Math.max(24, Math.round(startHeight + (moveEvent.clientY - startY)))
            const current = view.state.doc.nodeAt(rowPos)
            if (!current || current.type.name !== 'tableRow') return
            if (current.attrs.height === next) return
            view.dispatch(
              view.state.tr.setNodeMarkup(rowPos, undefined, {
                ...current.attrs,
                height: next,
              }),
            )
          }

          const onUp = () => {
            document.body.classList.remove('document-row-resizing')
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
          return true
        },
      },
    },
  })
}

export const DocumentTable = Table.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      resizable: true,
      lastColumnResizable: true,
      handleWidth: 6,
      cellMinWidth: 40,
      View: DocumentTableView,
    }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      borderless: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-borderless') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.borderless) return {}
          return { 'data-borderless': 'true' }
        },
      },
      borderVisible: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-border-visible') !== 'false',
        renderHTML: (attributes) => ({
          'data-border-visible': attributes.borderVisible === false ? 'false' : 'true',
        }),
      },
      borderColor: {
        default: DEFAULT_TABLE_BORDER_COLOR,
        parseHTML: (element) =>
          element.getAttribute('data-border-color') || DEFAULT_TABLE_BORDER_COLOR,
        renderHTML: (attributes) => ({
          'data-border-color': attributes.borderColor || DEFAULT_TABLE_BORDER_COLOR,
        }),
      },
    }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setTableBorderColor:
        (color: string) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            borderColor: color,
            borderVisible: true,
            borderless: false,
          }),
      setTableBorderVisible:
        (visible: boolean) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            borderVisible: visible,
            borderless: !visible,
          }),
      toggleTableBorder:
        () =>
        ({ editor, commands }) => {
          const attrs = editor.getAttributes('table')
          const visible = attrs.borderVisible !== false && attrs.borderless !== true
          return commands.updateAttributes(this.name, {
            borderVisible: !visible,
            borderless: visible,
          })
        },
    }
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), tableRowResizePlugin()]
  },
})

export const DocumentTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-height') || element.style.height
          if (!raw) return null
          const parsed = Number.parseInt(raw, 10)
          return Number.isFinite(parsed) ? parsed : null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {}
          return {
            'data-height': String(attributes.height),
            style: `height: ${attributes.height}px`,
          }
        },
      },
    }
  },
})
