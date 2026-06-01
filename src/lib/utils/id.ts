type CryptoWithOptionalRandomUuid = {
  randomUUID?: () => string
}

export function createClientId(prefix = 'id'): string {
  const cryptoApi = (globalThis as { crypto?: CryptoWithOptionalRandomUuid })
    .crypto
  const randomUuid = cryptoApi?.randomUUID?.()
  if (randomUuid) {
    return `${prefix}-${randomUuid}`
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}
