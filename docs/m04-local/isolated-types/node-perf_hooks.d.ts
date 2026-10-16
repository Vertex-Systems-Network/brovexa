// Isolated offline typings only; native workspace provides @types/node.
declare module 'node:perf_hooks' {
  export const performance: { now(): number };
}