import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ProductStateFixture {
  state: string;
  html: string;
}

export async function loadProductStateFixture(
  state: string,
): Promise<ProductStateFixture> {
  const html = await readFile(
    join(
      process.cwd(),
      "tests",
      "fixtures",
      "product-states",
      state,
      "detail.html",
    ),
    "utf8",
  );

  return { state, html };
}
