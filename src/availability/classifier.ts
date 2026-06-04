import type {
  AvailabilityResult,
  DetectorConfidence,
  DetectorResult,
} from "./types.js";

const confidenceRank: Record<DetectorConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function strongestConfidence(
  detectors: DetectorResult[],
  fallback: DetectorConfidence,
): DetectorConfidence {
  return detectors.reduce<DetectorConfidence>((strongest, detector) => {
    return confidenceRank[detector.confidence] > confidenceRank[strongest]
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
  const decisiveDetectors =
    negativeDetectors.length > 0 ? negativeDetectors : positiveDetectors;

  return {
    buyable: negativeDetectors.length === 0 && positiveDetectors.length > 0,
    confidence: strongestConfidence(decisiveDetectors, "low"),
    evidence: matchedDetectors.flatMap((detector) => detector.evidence),
    detectors,
    verificationBoundary:
      "May verify public Shopify/cart intent only; must not automate checkout, submit private information, bypass authentication, or complete purchases.",
  };
}
