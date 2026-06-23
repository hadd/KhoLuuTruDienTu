import type { RenderRect } from '@/features/data-management/lib/bboxCoords'

const PAGE_SELECTOR = '.react-pdf__Page'
const TEXT_LAYER_SELECTOR = '.react-pdf__Page__textContent'
const TEXT_NODE_SELECTOR = '[role="presentation"]'
const TEXT_CLIP_SVG_ATTR = 'data-pdf-text-clip-svg'
const COPY_RECT_TOLERANCE_PX = 6

interface AxisRect {
  left: number
  top: number
  right: number
  bottom: number
}

function renderRectToAxis(rect: RenderRect): AxisRect {
  return {
    left: rect.left - COPY_RECT_TOLERANCE_PX,
    top: rect.top - COPY_RECT_TOLERANCE_PX,
    right: rect.left + rect.width + COPY_RECT_TOLERANCE_PX,
    bottom: rect.top + rect.height + COPY_RECT_TOLERANCE_PX,
  }
}

function rectsIntersect(a: AxisRect, b: AxisRect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  )
}

function elementRelativeRect(element: Element, page: HTMLElement): AxisRect {
  const pageRect = page.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()

  return {
    left: elementRect.left - pageRect.left,
    top: elementRect.top - pageRect.top,
    right: elementRect.right - pageRect.left,
    bottom: elementRect.bottom - pageRect.top,
  }
}

function getPageElement(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>(PAGE_SELECTOR)
}

function getTextLayerElement(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>(TEXT_LAYER_SELECTOR)
}

function getTextLayerNodes(host: HTMLElement): Array<HTMLElement> {
  const textLayer = getTextLayerElement(host)
  if (!textLayer) return []

  return Array.from(textLayer.querySelectorAll<HTMLElement>(TEXT_NODE_SELECTOR))
}

function getTextClipId(host: HTMLElement): string {
  const pageNumber =
    getPageElement(host)?.getAttribute('data-page-number') ?? '0'
  return `pdf-text-clip-${pageNumber}`
}

function ensureTextClipSvg(
  host: HTMLElement,
  clipId: string,
  revealRects: Array<RenderRect>,
): void {
  let svg = host.querySelector<SVGSVGElement>(`svg[${TEXT_CLIP_SVG_ATTR}]`)

  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute(TEXT_CLIP_SVG_ATTR, 'true')
    svg.setAttribute('class', 'pointer-events-none absolute h-0 w-0')
    svg.setAttribute('aria-hidden', 'true')
    host.appendChild(svg)
  }

  const rectsMarkup = revealRects
    .map(
      (rect) =>
        `<rect x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" />`,
    )
    .join('')

  svg.innerHTML = `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${rectsMarkup}</clipPath></defs>`
}

function removeTextClipSvg(host: HTMLElement): void {
  host.querySelector(`svg[${TEXT_CLIP_SVG_ATTR}]`)?.remove()
}

function nodeIntersectsRevealRects(
  node: Element,
  page: HTMLElement,
  revealRects: Array<RenderRect>,
): boolean {
  if (revealRects.length === 0) return false

  const relative = elementRelativeRect(node, page)
  const revealAxisRects = revealRects.map(renderRectToAxis)

  return revealAxisRects.some((rect) => rectsIntersect(relative, rect))
}

export function restrictTextLayerToRects(
  host: HTMLElement,
  revealRects: Array<RenderRect>,
): void {
  const page = getPageElement(host)
  const textLayer = getTextLayerElement(host)
  if (!page || !textLayer) return

  if (revealRects.length === 0) {
    textLayer.style.clipPath = ''
    textLayer.style.pointerEvents = 'none'
    textLayer.style.userSelect = 'none'
    removeTextClipSvg(host)
    return
  }

  const clipId = getTextClipId(host)
  ensureTextClipSvg(host, clipId, revealRects)

  textLayer.style.clipPath = `url(#${clipId})`
  textLayer.style.pointerEvents = 'auto'
  textLayer.style.userSelect = 'text'
}

export function resetTextLayerCopyRestriction(host: HTMLElement): void {
  const textLayer = getTextLayerElement(host)
  if (textLayer) {
    textLayer.style.clipPath = ''
    textLayer.style.pointerEvents = ''
    textLayer.style.userSelect = ''
  }

  removeTextClipSvg(host)

  getTextLayerNodes(host).forEach((node) => {
    node.style.userSelect = ''
    node.style.pointerEvents = ''
  })
}

function extractTextFromNodeSelection(
  node: HTMLElement,
  range: Range,
): string {
  if (!range.intersectsNode(node)) return ''

  const nodeRange = document.createRange()
  nodeRange.selectNodeContents(node)

  const intersection = range.cloneRange()

  if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) < 0) {
    intersection.setStart(nodeRange.startContainer, nodeRange.startOffset)
  }

  if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) > 0) {
    intersection.setEnd(nodeRange.endContainer, nodeRange.endOffset)
  }

  return intersection.toString()
}

function getAllTextLayerNodes(container: HTMLElement): Array<HTMLElement> {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      `${TEXT_LAYER_SELECTOR} ${TEXT_NODE_SELECTOR}`,
    ),
  )
}

export function extractCopyTextWithinRects(
  selection: Selection | null,
  container: HTMLElement,
  revealRectsByPage: Map<number, Array<RenderRect>>,
): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }

  if (!container.contains(selection.anchorNode)) {
    return null
  }

  const raw = selection.toString()
  if (!raw) return null

  if (revealRectsByPage.size === 0) {
    return ''
  }

  const range = selection.getRangeAt(0)
  const filtered = getAllTextLayerNodes(container)
    .filter((node) => {
      const page = node.closest<HTMLElement>(PAGE_SELECTOR)
      if (!page) return false

      const pageNumber = Number.parseInt(
        page.getAttribute('data-page-number') ?? '',
        10,
      )
      if (!Number.isFinite(pageNumber)) return false

      const revealRects = revealRectsByPage.get(pageNumber) ?? []
      return nodeIntersectsRevealRects(node, page, revealRects)
    })
    .map((node) => extractTextFromNodeSelection(node, range))
    .join('')

  if (!filtered) {
    return ''
  }

  if (filtered === raw) {
    return null
  }

  return filtered
}
