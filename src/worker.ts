import { loadConfig, redactConfig } from "./config/env.js";
import { openStateRepository } from "./state/database.js";

async function main(): Promise<void> {
  const config = loadConfig();

  console.log("supplywatch worker starting");
  console.log(JSON.stringify(redactConfig(config), null, 2));

  const state = openStateRepository(config.DATABASE_PATH);
  const run = state.repository.startRun(new Date().toISOString());

  try {
    console.log(
      "Persistent state initialized. Scraper and state machine are not implemented yet.",
    );
    state.repository.finishRun(run.id, {
      finishedAt: new Date().toISOString(),
      status: "completed",
      productCount: 0,
      errorMessage: null,
    });
  } catch (error) {
    state.repository.finishRun(run.id, {
      finishedAt: new Date().toISOString(),
      status: "failed",
      productCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    state.close();
  }
}

main().catch((error: unknown) => {
  console.error("supplywatch worker failed to start");
  console.error(error);
  process.exitCode = 1;
});
