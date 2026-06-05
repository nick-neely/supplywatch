import type { BuyableState } from "@supplywatch/state";

export function availabilityLabel(value: BuyableState): string {
  switch (value) {
    case "employee_only":
      return "Employee only";
    case "out_of_stock":
      return "Out of stock";
    case "publicly_buyable":
      return "Publicly available";
    case "unknown":
      return "Unknown";
  }
}
