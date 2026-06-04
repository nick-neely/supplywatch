import { runCli } from "./cli.js";

async function main(): Promise<void> {
  await runCli(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error("supplywatch worker failed to start");
  console.error(error);
  process.exitCode = 1;
});
