import type {
  AvailabilityResult,
  DetectorConfidence,
  DetectorResult,
} from "./types.js";

const CONFIDENCE_RANK: Record<DetectorConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function strongestConfidence(
  detectors: DetectorResult[],
  fallback: DetectorConfidence,
): DetectorConfidence {
  return detectors.reduce<DetectorConfidence>((strongest, detector) => {
    return CONFIDENCE_RANK[detector.confidence] > CONFIDENCE_RANK[strongest]
      ? detector.confidence
      : strongest;
  }, fallback);
}

export function classifyAvailability(
  detectors: DetectorResult[],
): AvailabilityResult {
  const matchedDetectors = detectors.filter((detector) => detector.matched);
  const negativeDetectors = matchedDetectors.filter(
    (detector) => detector.polarity === "negative",
  );
  const positiveDetectors = matchedDetectors.filter(
    (detector) => detector.polarity === "positive",
  );
  const hasPublicPurchaseControl = positiveDetectors.some(
    (detector) => detector.name === "enabled-public-purchase-control",
  );
  const decisiveDetectors =
    negativeDetectors.length > 0 ? negativeDetectors : positiveDetectors;

  return {
    buyable: negativeDetectors.length === 0 && hasPublicPurchaseControl,
    confidence: strongestConfidence(decisiveDetectors, "low"),
    evidence: matchedDetectors.flatMap((detector) => detector.evidence),
    detectors,
    verificationBoundary:
      "May verify public Shopify/cart intent only; must not automate checkout, submit private information, bypass authentication, or complete purchases.",
  };
}
