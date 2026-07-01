type CryptoWithOptionalRandomUuid = {
  randomUUID?: () => string
}

function fallbackRandomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function createRandomUuid(): string {
  const cryptoApi = (globalThis as { crypto?: CryptoWithOptionalRandomUuid })
    .crypto
  return cryptoApi?.randomUUID?.() ?? fallbackRandomUuid()
}

export function createClientId(prefix = 'id'): string {
  return `${prefix}-${createRandomUuid()}`
}
