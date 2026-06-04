import * as cheerio from "cheerio";
import type { DetectorEvidence, DetectorResult } from "./types.js";

const PUBLIC_PURCHASE_CONTROL_SELECTOR =
  "button:not(:disabled), a[href], [role='button']:not([aria-disabled='true'])";
const DISABLED_PURCHASE_CONTROL_SELECTOR =
  "button:disabled, button[aria-disabled='true'], [role='button'][aria-disabled='true']";
const DISABLED_SIZE_SELECTOR =
  "[data-size][disabled], [data-size][aria-disabled='true'], button[disabled], button[aria-disabled='true']";
const ENABLED_SIZE_SELECTOR =
  "[data-size]:not(:disabled):not([aria-disabled='true']), button:not(:disabled):not([aria-disabled='true'])";

const PUBLIC_PURCHASE_CONTROL_TEXT = /\b(add to cart|buy now|purchase)\b/i;
const DISABLED_PURCHASE_CONTROL_TEXT =
  /\b(add to cart|buy now|purchase|out of stock|sold out|unavailable)\b/i;
const SIZE_TEXT = /^(xs|s|m|l|xl|xxl|\d+)$/i;
const UNAVAILABLE_TEXT = /\b(out of stock|sold out|unavailable)\b/i;
const EMPLOYEE_GATE_TEXT =
  /\b(employee|internal|staff)\b.*\b(log in|login|account|only)\b/i;

function textEvidence(
  kind: string,
  message: string,
  value?: string,
): DetectorEvidence {
  return value ? { kind, message, value } : { kind, message };
}

function detector(
  result: Omit<DetectorResult, "evidence"> & {
    evidence?: DetectorEvidence[];
  },
): DetectorResult {
  return {
    ...result,
    evidence: result.evidence ?? [],
  };
}

export function detectAvailabilitySignals(html: string): DetectorResult[] {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const animatedElements = $(".animate-wiggle");
  const enabledPublicPurchaseControls = $(
    PUBLIC_PURCHASE_CONTROL_SELECTOR,
  ).filter((_, element) => {
    const text = $(element).text().trim();
    return PUBLIC_PURCHASE_CONTROL_TEXT.test(text);
  });
  const unavailableText = UNAVAILABLE_TEXT.exec(bodyText);
  const disabledPurchaseControls = $(DISABLED_PURCHASE_CONTROL_SELECTOR).filter(
    (_, element) => {
      const text = $(element).text().trim();
      return DISABLED_PURCHASE_CONTROL_TEXT.test(text);
    },
  );
  const employeeGate = EMPLOYEE_GATE_TEXT.exec(bodyText);
  const disabledSizes = $(DISABLED_SIZE_SELECTOR).filter((_, element) => {
    const text = $(element).text().trim();
    return SIZE_TEXT.test(text);
  });
  const enabledSizes = $(ENABLED_SIZE_SELECTOR).filter((_, element) => {
    const text = $(element).text().trim();
    return SIZE_TEXT.test(text);
  });

  return [
    detector({
      name: "animate-wiggle",
      matched: animatedElements.length > 0,
      confidence: "low",
      polarity: "candidate",
      evidence:
        animatedElements.length > 0
          ? [
              textEvidence(
                "candidate-signal",
                "Card animation observed; detail state must still confirm availability.",
                "animate-wiggle",
              ),
            ]
          : [],
    }),
    detector({
      name: "unavailable-text",
      matched: unavailableText !== null,
      confidence: "high",
      polarity: "negative",
      evidence:
        unavailableText !== null
          ? [
              textEvidence(
                "unavailable-copy",
                "Product detail state contains unavailable inventory language.",
                unavailableText[0],
              ),
            ]
          : [],
    }),
    detector({
      name: "disabled-purchase-control",
      matched: disabledPurchaseControls.length > 0,
      confidence: "high",
      polarity: "negative",
      evidence:
        disabledPurchaseControls.length > 0
          ? [
              textEvidence(
                "disabled-purchase-control",
                "Purchase control is disabled on the product detail state.",
                disabledPurchaseControls.first().text().trim(),
              ),
            ]
          : [],
    }),
    detector({
      name: "employee-gated",
      matched: employeeGate !== null,
      confidence: "high",
      polarity: "negative",
      evidence:
        employeeGate !== null
          ? [
              textEvidence(
                "access-gate",
                "Product detail state requires an employee or internal account.",
                employeeGate[0],
              ),
            ]
          : [],
    }),
    detector({
      name: "disabled-size",
      matched: disabledSizes.length > 0,
      confidence: "high",
      polarity: "negative",
      evidence:
        disabledSizes.length > 0
          ? [
              textEvidence(
                "disabled-size",
                "Size or variant option is present but disabled.",
                disabledSizes.first().text().trim(),
              ),
            ]
          : [],
    }),
    detector({
      name: "enabled-size",
      matched: enabledSizes.length > 0,
      confidence: "medium",
      polarity: "positive",
      evidence:
        enabledSizes.length > 0
          ? [
              textEvidence(
                "enabled-size",
                "Size or variant option is enabled on the product detail state.",
                enabledSizes.first().text().trim(),
              ),
            ]
          : [],
    }),
    detector({
      name: "enabled-public-purchase-control",
      matched: enabledPublicPurchaseControls.length > 0,
      confidence: "high",
      polarity: "positive",
      evidence:
        enabledPublicPurchaseControls.length > 0
          ? [
              textEvidence(
                "purchase-control",
                "Enabled public purchase control is visible on the product detail state.",
                enabledPublicPurchaseControls.first().text().trim(),
              ),
            ]
          : [],
    }),
  ];
}
