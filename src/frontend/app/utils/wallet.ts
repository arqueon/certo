export function walletCountdown(expiresAt: string | undefined, now: number): string {
  const difference = expiresAt ? Date.parse(expiresAt) - now : 0
  const seconds = Number.isFinite(difference) ? Math.max(0, Math.ceil(difference / 1000)) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
export function shortWalletDid(did: string): string {
  return did.length > 32 ? `${did.slice(0, 20)}…${did.slice(-8)}` : did
}
