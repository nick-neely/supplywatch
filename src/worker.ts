import { loadConfig, redactConfig } from "./config/env.js";

async function main(): Promise<void> {
  const config = loadConfig();

  console.log("supplywatch worker starting");
  console.log(JSON.stringify(redactConfig(config), null, 2));
  console.log(
    "Foundation layer is ready. Scraper and state machine are not implemented yet.",
  );
}

main().catch((error: unknown) => {
  console.error("supplywatch worker failed to start");
  console.error(error);
  process.exitCode = 1;
});
