export type BrandTheme = {
  primary: string
  primaryHover: string
  primaryActive: string
  accent: string
  muted: string
  border: string
  darkBg: string
}

export const brands: Record<string, BrandTheme> = {
  /**
   * Next Edu brand palette
   *
   * This mapping is the single source of truth for brand colors at the TS level.
   * CSS variables in `src/styles/globals.css` should stay in sync with these values.
   */
  nextEdu: {
    primary: '#007AF1',
    primaryHover: '#0066CC',
    primaryActive: '#003978',
    accent: '#E5ECFF',
    muted: '#F2F5FF',
    border: '#D9E3FF',
    darkBg: '#001E45', // or '#00102B' if you prefer a darker tone
  },
}

export const ACTIVE_BRAND_KEY = 'nextEdu'

export const activeBrand: BrandTheme = brands[ACTIVE_BRAND_KEY]
