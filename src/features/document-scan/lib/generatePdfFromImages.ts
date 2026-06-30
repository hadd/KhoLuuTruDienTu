import { jsPDF } from 'jspdf'

import { transformScanPageImage } from '@/features/document-scan/lib/imageTransform'
import type { ScanPageT } from '@/features/document-scan/types'
import { PAPER_SIZES } from '@/lib/utils/pdf'

const A4 = PAPER_SIZES.A4
const MARGIN_MM = 10

export async function generatePdfFromImages(
  pages: Array<ScanPageT>,
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const contentWidth = A4.width - MARGIN_MM * 2
  const contentHeight = A4.height - MARGIN_MM * 2

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    const transformed = await transformScanPageImage(
      page.imageData,
      page.rotation,
      page.scale,
    )

    const aspectRatio = transformed.height / transformed.width
    let renderWidth = contentWidth
    let renderHeight = renderWidth * aspectRatio

    if (renderHeight > contentHeight) {
      renderHeight = contentHeight
      renderWidth = renderHeight / aspectRatio
    }

    const offsetX = MARGIN_MM + (contentWidth - renderWidth) / 2
    const offsetY = MARGIN_MM + (contentHeight - renderHeight) / 2

    if (index > 0) {
      pdf.addPage()
    }

    pdf.addImage(
      transformed.dataUrl,
      'JPEG',
      offsetX,
      offsetY,
      renderWidth,
      renderHeight,
    )
  }

  return pdf.output('blob')
}
