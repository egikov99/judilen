export function rateLimitTimestamps(nowMs: number, windowMs: number) {
  return {
    currentTime: new Date(nowMs).toISOString(),
    windowBoundary: new Date(nowMs - windowMs).toISOString(),
    cleanupBoundary: new Date(nowMs - 86_400_000).toISOString()
  };
}
