export function truncateStableId(stableId: string, maxLength = 56): string {
  if (stableId.length <= maxLength) {
    return stableId;
  }

  return `${stableId.slice(0, maxLength)}…`;
}
