// ISOLATED COMPILE SHIM ONLY. Does not validate actual Vitest APIs.
declare module 'vitest' {
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: (value: unknown) => any;
  export const vi: { fn<T extends (...args: any[]) => any>(handler: T): T & { mock: { calls: Parameters<T>[] } } };
}