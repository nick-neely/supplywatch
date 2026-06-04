import * as cheerio from "cheerio";
import type { DetectorResult } from "./types.js";

function textEvidence(kind: string, message: string, value?: string) {
  return value ? { kind, message, value } : { kind, message };
}

export function detectAvailabilitySignals(html: string): DetectorResult[] {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const animatedElements = $(".animate-wiggle");
  const enabledPublicPurchaseControls = $(
    "button:not(:disabled), a[href], [role='button']:not([aria-disabled='true'])",
  ).filter((_, element) => {
    const text = $(element).text().trim();
    return /\b(add to cart|buy now|purchase)\b/i.test(text);
  });
  const unavailableText = /\b(out of stock|sold out|unavailable)\b/i.exec(
    bodyText,
  );
  const disabledPurchaseControls = $(
    "button:disabled, button[aria-disabled='true'], [role='button'][aria-disabled='true']",
  ).filter((_, element) => {
    const text = $(element).text().trim();
    return /\b(add to cart|buy now|purchase|out of stock|sold out|unavailable)\b/i.test(
      text,
    );
  });
  const employeeGate =
    /\b(employee|internal|staff)\b.*\b(log in|login|account|only)\b/i.exec(
      bodyText,
    );
  const disabledSizes = $(
    "[data-size][disabled], [data-size][aria-disabled='true'], button[disabled], button[aria-disabled='true']",
  ).filter((_, element) => {
    const text = $(element).text().trim();
    return /^(xs|s|m|l|xl|xxl|\d+)$|size/i.test(text);
  });
  const enabledSizes = $(
    "[data-size]:not(:disabled):not([aria-disabled='true']), button:not(:disabled):not([aria-disabled='true'])",
  ).filter((_, element) => {
    const text = $(element).text().trim();
    return /^(xs|s|m|l|xl|xxl|\d+)$|size/i.test(text);
  });

  return [
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
  ];
}
