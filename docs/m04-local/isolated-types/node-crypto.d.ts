// Offline typecheck only. In full Brovexa workspace @types/node provides this.
declare module 'node:crypto' {
  export interface LocalHash { update(data: string | Uint8Array): LocalHash; digest(encoding: 'hex'): string }
  export function createHash(algorithm: string): LocalHash;
}