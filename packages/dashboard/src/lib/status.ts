export function statusClass(value: string): string {
  const normalized = value.toLowerCase().replaceAll(" ", "_");

  if (
    normalized === "publicly_available" ||
    normalized === "publicly_buyable" ||
    normalized === "completed" ||
    normalized === "sent"
  ) {
    return "sw-status--public";
  }
  if (
    normalized === "employee_only" ||
    normalized === "running" ||
    normalized === "pending" ||
    normalized.includes("candidate")
  ) {
    return "sw-status--employee";
  }
  if (
    normalized === "out_of_stock" ||
    normalized === "retired" ||
    normalized === "failed" ||
    normalized.includes("error")
  ) {
    return "sw-status--out";
  }
  if (normalized === "unknown" || normalized === "none") {
    return "sw-status--unknown";
  }

  return "sw-status--neutral";
}

export function statusVariant(
  value: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "failed") {
    return "destructive";
  }
  if (value === "publicly_buyable" || value === "Publicly available") {
    return "default";
  }
  if (value === "unknown" || value === "none") {
    return "outline";
  }
  return "secondary";
}
