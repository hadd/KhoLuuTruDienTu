import { faker } from '@faker-js/faker'

export interface ScannerResult {
  files: Array<File>
}

async function createMockScanFiles(count = 1): Promise<Array<File>> {
  const files: Array<File> = []

  for (let index = 0; index < count; index += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = 1240
    canvas.height = 1754
    const context = canvas.getContext('2d')
    if (!context) continue

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#111827'
    context.font = 'bold 48px sans-serif'
    context.fillText('Mock Scan Page', 80, 120)
    context.font = '28px sans-serif'
    context.fillText(faker.lorem.sentence({ min: 8, max: 14 }), 80, 220)
    context.strokeStyle = '#d1d5db'
    context.strokeRect(60, 60, canvas.width - 120, canvas.height - 120)

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result ?? new Blob()), 'image/png')
    })

    files.push(
      new File([blob], `mock-scan-${Date.now()}-${index}.png`, {
        type: 'image/png',
      }),
    )
  }

  return files
}

function pickFilesFromInput(): Promise<Array<File>> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/jpg'
    input.multiple = true
    input.onchange = () => {
      resolve(Array.from(input.files ?? []))
    }
    input.click()
  })
}

export const mockScannerAdapter = {
  async scan(): Promise<ScannerResult> {
    const count = faker.number.int({ min: 1, max: 2 })
    const files = await createMockScanFiles(count)
    return { files }
  },

  async pickFiles(): Promise<ScannerResult> {
    const files = await pickFilesFromInput()
    return { files }
  },
}
