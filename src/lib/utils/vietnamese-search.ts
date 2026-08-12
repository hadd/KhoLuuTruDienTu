export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function normalizeSearchText(value: string): string {
  return removeVietnameseDiacritics(value).toLowerCase().trim()
}

export function textMatchesSearchQuery(value: string, q?: string): boolean {
  const query = q?.trim()
  if (!query) return true
  return normalizeSearchText(value).includes(normalizeSearchText(query))
}

type NormalizedIndexMapT = {
  normalized: string
  indexMap: number[]
}

function buildNormalizedIndexMap(text: string): NormalizedIndexMapT {
  const indexMap: number[] = []
  let normalized = ''

  for (let i = 0; i < text.length; i++) {
    const normPiece = normalizeSearchText(text[i] ?? '')
    for (const ch of normPiece) {
      normalized += ch
      indexMap.push(i)
    }
  }

  return { normalized, indexMap }
}

export function findOriginalSpanForNormalizedMatch(
  text: string,
  normStart: number,
  normLength: number,
): { start: number; end: number } | null {
  if (normLength <= 0) return null

  const { normalized, indexMap } = buildNormalizedIndexMap(text)
  if (normStart < 0 || normStart + normLength > normalized.length) return null

  const start = indexMap[normStart]
  const endIndex = normStart + normLength - 1
  const end = (indexMap[endIndex] ?? start) + 1

  if (start == null || end == null) return null
  return { start, end }
}
