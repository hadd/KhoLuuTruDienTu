import type { RenderRect } from '@/features/data-management/lib/bboxCoords'

const PAGE_SELECTOR = '.react-pdf__Page'
const TEXT_LAYER_SELECTOR = '.react-pdf__Page__textContent'
const TEXT_SPAN_SELECTOR = 'span[role="presentation"]'
const TEXT_SPAN_FALLBACK_SELECTOR = 'span:not(.endOfContent)'
const ALLOWED_SPAN_ATTR = 'data-bbox-copy-allowed'
const BBOX_INTERSECTION_TOLERANCE_PX = 3

interface AxisRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ExtractCopyTextOptions {
  pageHost?: HTMLElement | null
  revealRects?: Array<RenderRect>
}

function renderRectToAxis(rect: RenderRect): AxisRect {
  return {
    left: rect.left - COPY_RECT_TOLERANCE_PX,
    top: rect.top - COPY_RECT_TOLERANCE_PX,
    right: rect.left + rect.width + COPY_RECT_TOLERANCE_PX,
    bottom: rect.top + rect.height + COPY_RECT_TOLERANCE_PX,
  }
}

function expandAxisRect(rect: AxisRect, padding: number): AxisRect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  }
}

function expandRenderRect(rect: RenderRect, padding: number): AxisRect {
  return expandAxisRect(renderRectToAxis(rect), padding)
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

function selectionRelativeRect(range: Range, host: HTMLElement): AxisRect | null {
  const hostRect = host.getBoundingClientRect()
  const selectionRect = range.getBoundingClientRect()

  if (selectionRect.width === 0 && selectionRect.height === 0) {
    return null
  }

  return {
    left: selectionRect.left - hostRect.left,
    top: selectionRect.top - hostRect.top,
    right: selectionRect.right - hostRect.left,
    bottom: selectionRect.bottom - hostRect.top,
  }
}

function spanIntersectsRevealRects(
  span: Element,
  host: HTMLElement,
  revealRects: Array<RenderRect>,
  tolerance = BBOX_INTERSECTION_TOLERANCE_PX,
): boolean {
  if (revealRects.length === 0) return false

  const relative = spanRelativeRect(span, host)
  const revealAxisRects = revealRects.map((rect) =>
    expandRenderRect(rect, tolerance),
  )

  return revealAxisRects.some((rect) => rectsIntersect(relative, rect))
}

function selectionIntersectsRevealRects(
  range: Range,
  host: HTMLElement,
  revealRects: Array<RenderRect>,
): boolean {
  if (revealRects.length === 0) return false

  const relative = selectionRelativeRect(range, host)
  if (!relative) return false

  const revealAxisRects = revealRects.map((rect) =>
    expandRenderRect(rect, BBOX_INTERSECTION_TOLERANCE_PX),
  )

function getTextLayerNodes(host: HTMLElement): Array<HTMLElement> {
  const textLayer = getTextLayerElement(host)
  if (!textLayer) return []

  return Array.from(textLayer.querySelectorAll<HTMLElement>(TEXT_NODE_SELECTOR))
}

function selectionFullyInsideRevealRects(
  range: Range,
  host: HTMLElement,
  revealRects: Array<RenderRect>,
): boolean {
  const relative = selectionRelativeRect(range, host)
  if (!relative) return false

  return revealRects.some((rect) => {
    const expanded = expandRenderRect(rect, BBOX_INTERSECTION_TOLERANCE_PX)
    return (
      expanded.left <= relative.left &&
      expanded.top <= relative.top &&
      expanded.right >= relative.right &&
      expanded.bottom >= relative.bottom
    )
  })
}

function setSpanCopyAllowed(span: HTMLElement, allowed: boolean): void {
  if (allowed) {
    span.style.userSelect = 'text'
    span.style.pointerEvents = 'auto'
    span.style.zIndex = '30'
    span.setAttribute(ALLOWED_SPAN_ATTR, 'true')
    return
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

  const withRole = Array.from(
    textLayer.querySelectorAll<HTMLElement>(TEXT_SPAN_SELECTOR),
  )
  if (withRole.length > 0) return withRole

  return Array.from(
    textLayer.querySelectorAll<HTMLElement>(TEXT_SPAN_FALLBACK_SELECTOR),
  )
}

export function restrictTextLayerToRects(
  host: HTMLElement,
  revealRects: Array<RenderRect>,
): void {
  const page = getPageElement(host)
  const textLayer = getTextLayerElement(host)
  if (!page || !textLayer) return

  textLayer.style.pointerEvents = ''
  const spans = getTextLayerSpans(host)

  spans.forEach((span) => {
    const allowed =
      revealRects.length > 0 &&
      spanIntersectsRevealRects(span, host, revealRects)
    setSpanCopyAllowed(span, allowed)
  })
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

  if (range.compareBoundaryPoints(Range.START_TO_START, spanRange) < 0) {
    intersection.setStart(spanRange.startContainer, spanRange.startOffset)
  }

  if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) > 0) {
    intersection.setEnd(nodeRange.endContainer, nodeRange.endOffset)
  }

  return intersection.toString()
}

function extractTextFromIntersectingSpans(
  spans: Array<HTMLElement>,
  range: Range,
): string {
  return spans
    .map((span) => extractTextFromSpanSelection(span, range))
    .join('')
}

export function extractCopyTextWithinRects(
  selection: Selection | null,
  container: HTMLElement,
  options?: ExtractCopyTextOptions,
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
  const filtered = extractTextFromIntersectingSpans(
    getAllowedSpans(container),
    range,
  )

  if (!filtered) {
    return ''
  }

  if (filtered === raw) {
    return null
  }

  if (filtered) {
    return filtered
  }

  const { pageHost, revealRects = [] } = options ?? {}
  if (!pageHost || revealRects.length === 0) {
    return ''
  }

  if (!selectionIntersectsRevealRects(range, pageHost, revealRects)) {
    return ''
  }

  const fallbackFiltered = extractTextFromIntersectingSpans(
    getTextLayerSpans(pageHost).filter((span) =>
      spanIntersectsRevealRects(span, pageHost, revealRects),
    ),
    range,
  )

  if (fallbackFiltered) {
    return fallbackFiltered
  }

  if (selectionFullyInsideRevealRects(range, pageHost, revealRects)) {
    return raw
  }

  return ''
}
