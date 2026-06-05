export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "none";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}
