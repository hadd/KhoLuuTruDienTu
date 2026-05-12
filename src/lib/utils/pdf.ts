import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * Paper size dimensions in millimeters
 */
export const PAPER_SIZES = {
  A4: {
    width: 210,
    height: 297,
  },
  // Easy to extend with more sizes:
  // Letter: { width: 216, height: 279 },
  // Legal: { width: 216, height: 356 },
} as const

export type PaperSize = keyof typeof PAPER_SIZES

export interface GeneratePDFOptions {
  filename: string
  paperSize?: PaperSize
  margin?: number // Margin in mm
  quality?: number // Image quality (0-1)
}

/**
 * Generates a PDF from an HTML element using html2canvas and jsPDF
 * @param element - The HTML element to convert to PDF
 * @param options - PDF generation options
 * @returns Promise that resolves when PDF download starts
 */
export async function generatePDFFromElement(
  element: HTMLElement,
  options: GeneratePDFOptions,
): Promise<void> {
  const { filename, paperSize = 'A4', margin = 10, quality = 0.98 } = options

  const paperDimensions = PAPER_SIZES[paperSize]
  const contentWidth = paperDimensions.width - margin * 2
  const contentHeight = paperDimensions.height - margin * 2

  // Capture the element as canvas
  const canvas = await html2canvas(element, {
    scale: 2, // Higher quality
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  // Calculate dimensions
  const imgWidth = contentWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  // Create PDF
  const pdf = new jsPDF({
    orientation: imgHeight > paperDimensions.height ? 'portrait' : 'portrait',
    unit: 'mm',
    format: [paperDimensions.width, paperDimensions.height],
  })

  // Add image to PDF
  const imgData = canvas.toDataURL('image/png', quality)
  let heightLeft = imgHeight
  let position = margin

  // Add first page
  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
  heightLeft -= contentHeight

  // Add additional pages if content is taller than one page
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
    heightLeft -= contentHeight
  }

  // Save PDF
  pdf.save(filename)
}
