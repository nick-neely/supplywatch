import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

describe("runCli", () => {
  it("exposes a capture-fixture command", async () => {
    const capture = vi.fn().mockResolvedValue({
      directory: "fixtures/product-states/sizeless/public-drop-tee",
      htmlPath: "fixtures/product-states/sizeless/public-drop-tee/detail.html",
      metadataPath:
        "fixtures/product-states/sizeless/public-drop-tee/metadata.json",
    });
    const log = vi.fn();

    await runCli(
      [
        "capture-fixture",
        "--url",
        "https://supplyco.openai.com/products/public-drop-tee",
        "--state",
        "sizeless",
        "--name",
        "public-drop-tee",
        "--output",
        "fixtures",
      ],
      { capture, log },
    );

    expect(capture).toHaveBeenCalledWith({
      url: "https://supplyco.openai.com/products/public-drop-tee",
      state: "sizeless",
      name: "public-drop-tee",
      outputDir: "fixtures",
    });
    expect(log).toHaveBeenCalledWith(
      "captured fixture: fixtures/product-states/sizeless/public-drop-tee",
    );
  });
});
