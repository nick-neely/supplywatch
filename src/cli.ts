import { loadConfig, redactConfig } from "./config/env.js";
import {
  type CaptureProductStateFixtureOptions,
  captureProductStateFixture,
} from "./fixtures/capture.js";

interface CliDependencies {
  capture: (options: CaptureProductStateFixtureOptions) => Promise<{
    directory: string;
  }>;
  log: (message: string) => void;
}

const defaultDependencies: CliDependencies = {
  capture: captureProductStateFixture,
  log: console.log,
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
  dependencies.log(
    "Foundation layer is ready. Scraper and state machine are not implemented yet.",
  );
}

export async function runCli(
  args: string[],
  dependencies: CliDependencies = defaultDependencies,
): Promise<void> {
  const [command, ...commandArgs] = args;

  if (command === "capture-fixture") {
    await runCaptureFixture(commandArgs, dependencies);
    return;
  }

  await runWorker(dependencies);
}
