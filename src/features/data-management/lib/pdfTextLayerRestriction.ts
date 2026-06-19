import type { RenderRect } from '@/features/data-management/lib/bboxCoords'

const TEXT_LAYER_SELECTOR = '.react-pdf__Page__textContent'
const TEXT_SPAN_SELECTOR = 'span[role="presentation"]'
const ALLOWED_SPAN_ATTR = 'data-bbox-copy-allowed'

interface AxisRect {
  left: number
  top: number
  right: number
  bottom: number
}

function renderRectToAxis(rect: RenderRect): AxisRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  }
}

function rectsIntersect(a: AxisRect, b: AxisRect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  )
}

function spanRelativeRect(span: Element, host: HTMLElement): AxisRect {
  const hostRect = host.getBoundingClientRect()
  const spanRect = span.getBoundingClientRect()

  return {
    left: spanRect.left - hostRect.left,
    top: spanRect.top - hostRect.top,
    right: spanRect.right - hostRect.left,
    bottom: spanRect.bottom - hostRect.top,
  }
}

function spanIntersectsRevealRects(
  span: Element,
  host: HTMLElement,
  revealRects: Array<RenderRect>,
): boolean {
  if (revealRects.length === 0) return false

  const relative = spanRelativeRect(span, host)
  const revealAxisRects = revealRects.map(renderRectToAxis)

  return revealAxisRects.some((rect) => rectsIntersect(relative, rect))
}

function setSpanCopyAllowed(span: HTMLElement, allowed: boolean): void {
  if (allowed) {
    span.style.userSelect = 'text'
    span.style.pointerEvents = 'auto'
    span.setAttribute(ALLOWED_SPAN_ATTR, 'true')
    return
  }

  span.style.userSelect = 'none'
  span.style.pointerEvents = 'none'
  span.removeAttribute(ALLOWED_SPAN_ATTR)
}

function getTextLayerSpans(host: HTMLElement): Array<HTMLElement> {
  const textLayer = host.querySelector(TEXT_LAYER_SELECTOR)
  if (!textLayer) return []

  return Array.from(textLayer.querySelectorAll<HTMLElement>(TEXT_SPAN_SELECTOR))
}

export function restrictTextLayerToRects(
  host: HTMLElement,
  revealRects: Array<RenderRect>,
): void {
  const spans = getTextLayerSpans(host)

  spans.forEach((span) => {
    const allowed = spanIntersectsRevealRects(span, host, revealRects)
    setSpanCopyAllowed(span, allowed)
  })
}

export function resetTextLayerCopyRestriction(host: HTMLElement): void {
  getTextLayerSpans(host).forEach((span) => {
    span.style.userSelect = ''
    span.style.pointerEvents = ''
    span.removeAttribute(ALLOWED_SPAN_ATTR)
  })
}

function getAllowedSpans(container: HTMLElement): Array<HTMLElement> {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      `${TEXT_LAYER_SELECTOR} span[${ALLOWED_SPAN_ATTR}="true"]`,
    ),
  )
}

function extractTextFromSpanSelection(
  span: HTMLElement,
  range: Range,
): string {
  if (!range.intersectsNode(span)) return ''

  const spanRange = document.createRange()
  spanRange.selectNodeContents(span)

  const intersection = range.cloneRange()

  if (
    range.compareBoundaryPoints(Range.START_TO_START, spanRange) < 0
  ) {
    intersection.setStart(spanRange.startContainer, spanRange.startOffset)
  }

  if (range.compareBoundaryPoints(Range.END_TO_END, spanRange) > 0) {
    intersection.setEnd(spanRange.endContainer, spanRange.endOffset)
  }

  return intersection.toString()
}

export function extractCopyTextWithinRects(
  selection: Selection | null,
  container: HTMLElement,
): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }

  if (!container.contains(selection.anchorNode)) {
    return null
  }

  const raw = selection.toString()
  if (!raw) return null

  const range = selection.getRangeAt(0)
  const filtered = getAllowedSpans(container)
    .map((span) => extractTextFromSpanSelection(span, range))
    .join('')

  if (filtered === raw) {
    return null
  }

  return filtered
}
