import { loadConfig, redactConfig } from "./config/env.js";
import {
  type CaptureProductStateFixtureOptions,
  captureProductStateFixture,
} from "./fixtures/capture.js";
import {
  type OpenStateRepository,
  openStateRepository,
} from "./state/database.js";

interface CliDependencies {
  capture: (options: CaptureProductStateFixtureOptions) => Promise<{
    directory: string;
  }>;
  log: (message: string) => void;
  openStateRepository: (databasePath: string) => OpenStateRepository;
}

const defaultDependencies: CliDependencies = {
  capture: captureProductStateFixture,
  log: console.log,
  openStateRepository,
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireOption(args: string[], name: string): string {
  const value = readOption(args, name);

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function runCaptureFixture(
  args: string[],
  dependencies: CliDependencies,
): Promise<void> {
  const fixture = await dependencies.capture({
    url: requireOption(args, "--url"),
    state: requireOption(args, "--state"),
    name: requireOption(args, "--name"),
    outputDir: readOption(args, "--output") ?? "fixtures",
  });

  dependencies.log(`captured fixture: ${fixture.directory}`);
}

async function runWorker(dependencies: CliDependencies): Promise<void> {
  const config = loadConfig();

  dependencies.log("supplywatch worker starting");
  dependencies.log(JSON.stringify(redactConfig(config), null, 2));

  const state = dependencies.openStateRepository(config.DATABASE_PATH);
  const run = state.repository.startRun(new Date().toISOString());

  try {
    dependencies.log(
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

export async function runCli(
  args: string[],
  dependencyOverrides: Partial<CliDependencies> = {},
): Promise<void> {
  const dependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  };
  const [command, ...commandArgs] = args;

  if (command === "capture-fixture") {
    await runCaptureFixture(commandArgs, dependencies);
    return;
  }

  await runWorker(dependencies);
}
