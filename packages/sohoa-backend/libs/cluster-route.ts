/** Stable index so one client IP stays on one web process. */
export function pickProcessIndex(ip: string, count: number): number {
  if (count <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (Math.imul(hash, 31) + ip.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

export function clientIpFromRequest(
  forwardedFor: string | null,
  remoteHostname: string | null,
): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return remoteHostname || "0.0.0.0";
}
