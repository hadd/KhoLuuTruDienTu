import { jwtDecode } from 'jwt-decode'

type TokenPayload = {
  exp?: number
}

export const getTokenExpiry = (token: string): number | null => {
  try {
    const decoded = jwtDecode<TokenPayload>(token)
    if (!decoded.exp) {
      return null
    }
    return decoded.exp * 1000
  } catch {
    return null
  }
}

export const isTokenExpired = (token: string, bufferSeconds = 30): boolean => {
  const expiry = getTokenExpiry(token)
  if (!expiry) {
    return true
  }
  return expiry - bufferSeconds * 1000 <= Date.now()
}
