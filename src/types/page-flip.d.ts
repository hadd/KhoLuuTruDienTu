declare module 'page-flip/dist/js/page-flip.module.js' {
  export type PageFlipCorner = 'top' | 'bottom'

  export interface PageFlipSettings {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    drawShadow?: boolean
    flippingTime?: number
    usePortrait?: boolean
    startZIndex?: number
    startPage?: number
    autoSize?: boolean
    maxShadowOpacity?: number
    showCover?: boolean
    mobileScrollSupport?: boolean
    swipeDistance?: number
    clickEventForward?: boolean
    useMouseEvents?: boolean
    showPageCorners?: boolean
    disableFlipByClick?: boolean
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<PageFlipSettings>)
    destroy(): void
    update(): void
    loadFromImages(imagesHref: Array<string>): void
    updateFromImages(imagesHref: Array<string>): void
    flipNext(corner?: PageFlipCorner): void
    flipPrev(corner?: PageFlipCorner): void
    turnToPage(pageNum: number): void
    getPageCount(): number
    getCurrentPageIndex(): number
    on(
      eventName: string,
      callback: (event: { data: unknown; object: PageFlip }) => void,
    ): this
    off(eventName: string): void
  }
}
