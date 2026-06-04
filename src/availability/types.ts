export type DetectorConfidence = "low" | "medium" | "high";

export type DetectorPolarity = "candidate" | "positive" | "negative";

export interface DetectorEvidence {
  kind: string;
  message: string;
  value?: string;
}

export interface DetectorResult {
  name: string;
  matched: boolean;
  confidence: DetectorConfidence;
  polarity: DetectorPolarity;
  evidence: DetectorEvidence[];
}

export interface AvailabilityResult {
  buyable: boolean;
  confidence: DetectorConfidence;
  evidence: DetectorEvidence[];
  detectors: DetectorResult[];
  verificationBoundary: string;
}
