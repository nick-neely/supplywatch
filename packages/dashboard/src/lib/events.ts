export function isCandidateSignalEvent(eventType: string): boolean {
  return eventType.includes("candidate") || eventType.includes("signal");
}
