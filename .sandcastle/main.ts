// Parallel Planner with Review, tuned for this repo.
//
// This keeps Sandcastle's newer structured-output planner while carrying over
// the useful local workflow additions from ~/dev/freelance:
// - host-side GitHub issue listing, avoiding sandbox shell timeouts
// - Codex CLI subscription auth from host ~/.codex instead of OPENAI_KEY
// - read-only skill mounts for local agent skills
// - bounded parallelism and opt-in node_modules copying
// - pnpm installs from the committed lockfile

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProvider, SandboxProvider } from "@ai-hero/sandcastle";
import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { z } from "zod";

type CodexEffort = "low" | "medium" | "high" | "xhigh";

const CODEX_EFFORTS = new Set<CodexEffort>(["low", "medium", "high", "xhigh"]);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CODEX_MODEL = "gpt-5.5";
const DEFAULT_CODEX_REASONING_EFFORT = "medium" satisfies CodexEffort;

const CODEX_MODEL = process.env.SANDCASTLE_CODEX_MODEL ?? DEFAULT_CODEX_MODEL;
const CODEX_REASONING_EFFORT = readCodexEffortEnv(
  "SANDCASTLE_CODEX_REASONING_EFFORT",
  DEFAULT_CODEX_REASONING_EFFORT,
);

// Maximum number of plan->execute->merge cycles before stopping.
const MAX_ITERATIONS = readPositiveIntegerEnv("SANDCASTLE_MAX_ITERATIONS", 10);

// Sandcastle registers process cleanup handlers per live sandbox. Raise Node's
// listener warning limit enough for normal parallel issue batches.
const MAX_PARALLEL_ISSUES = readPositiveIntegerEnv(
  "SANDCASTLE_MAX_PARALLEL_ISSUES",
  5,
);
const PROCESS_SIGNAL_LISTENER_LIMIT = readPositiveIntegerEnv(
  "SANDCASTLE_PROCESS_MAX_LISTENERS",
  Math.max(64, MAX_PARALLEL_ISSUES * 8),
);

process.setMaxListeners(
  Math.max(process.getMaxListeners(), PROCESS_SIGNAL_LISTENER_LIMIT),
);

// Copying node_modules into every worktree is only a startup optimization. Keep
// it opt-in because large repos can spend more time copying than installing.
const COPY_NODE_MODULES_TO_WORKTREE =
  process.env.SANDCASTLE_COPY_NODE_MODULES === "1";
const COPY_TO_WORKTREE_TIMEOUT_MS = readPositiveIntegerEnv(
  "SANDCASTLE_COPY_TO_WORKTREE_TIMEOUT_MS",
  10 * 60_000,
);
const copyToWorktree = COPY_NODE_MODULES_TO_WORKTREE ? ["node_modules"] : [];

const plannedIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  branch: z.string(),
  implementationModel: z.string().optional(),
  implementationModelReason: z.string().optional(),
});

// The planner emits JSON inside <plan> tags. Output.object extracts and
// validates it against this Zod schema before Phase 2 starts.
const planSchema = z.object({
  issues: z.array(plannedIssueSchema).max(MAX_PARALLEL_ISSUES),
});

type PlannedIssue = z.infer<typeof plannedIssueSchema>;

const CODEX_AUTH_HOOK =
  "rm -rf /home/agent/.codex && mkdir -p /home/agent/.codex && " +
  "for item in auth.json config.toml AGENTS.md rules; do " +
  'if [ -e "/home/agent/.codex-host/$item" ]; then cp -R "/home/agent/.codex-host/$item" /home/agent/.codex/; fi; done && ' +
  "chmod -R u+rwX /home/agent/.codex";

const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: CODEX_AUTH_HOOK },
      {
        command: "[ -d node_modules ] || pnpm install --frozen-lockfile",
        timeoutMs: 300_000,
      },
    ],
  },
};

function agent(): AgentProvider {
  return sandcastle.codex(CODEX_MODEL, {
    ...(CODEX_REASONING_EFFORT ? { effort: CODEX_REASONING_EFFORT } : {}),
  });
}

function skillMounts(): Array<{
  hostPath: string;
  sandboxPath: string;
  readonly: true;
}> {
  const mounts: Array<{
    hostPath: string;
    sandboxPath: string;
    readonly: true;
  }> = [];
  const hostHome = homedir();
  const claudeDir = join(hostHome, ".claude/skills");
  const agentsDir = join(hostHome, ".agents/skills");
  const hasClaude = existsSync(claudeDir);
  const hasAgents = existsSync(agentsDir);

  if (hasClaude) {
    mounts.push({
      hostPath: claudeDir,
      sandboxPath: "/home/agent/.claude/skills",
      readonly: true,
    });
  }

  if (hasAgents) {
    mounts.push({
      hostPath: agentsDir,
      sandboxPath: "/home/agent/.agents/skills",
      readonly: true,
    });
  }

  if (hasClaude && !hasAgents) {
    mounts.push({
      hostPath: claudeDir,
      sandboxPath: "/home/agent/.agents/skills",
      readonly: true,
    });
  }

  if (hasAgents && !hasClaude) {
    mounts.push({
      hostPath: agentsDir,
      sandboxPath: "/home/agent/.claude/skills",
      readonly: true,
    });
  }

  return mounts;
}

function sandboxProvider(): SandboxProvider {
  return docker({
    mounts: [
      {
        hostPath: join(homedir(), ".codex"),
        sandboxPath: "/home/agent/.codex-host",
        readonly: true,
      },
      ...skillMounts(),
    ],
  });
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(
      `${name} must be a positive integer, got ${JSON.stringify(value)}.`,
    );
  }

  return parsed;
}

function readCodexEffortEnv(name: string, fallback: CodexEffort): CodexEffort {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  if (!CODEX_EFFORTS.has(value as CodexEffort)) {
    throw new Error(
      `${name} must be one of ${Array.from(CODEX_EFFORTS).join(", ")}, got ${JSON.stringify(value)}.`,
    );
  }

  return value as CodexEffort;
}

async function allSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];

      if (item === undefined) {
        results[index] = {
          status: "rejected",
          reason: new Error(`Missing item at index ${index}.`),
        };
        continue;
      }

      try {
        results[index] = {
          status: "fulfilled",
          value: await task(item, index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () =>
      worker(),
    ),
  );

  return results;
}

function fetchReadyForAgentIssuesJson(): string {
  try {
    return execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--state",
        "open",
        "--label",
        "ready-for-agent",
        "--json",
        "number,title,body,labels",
      ],
      { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 },
    ).trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      "Sandcastle planner could not list GitHub issues via `gh` on the host. " +
        "Install the GitHub CLI, run `gh auth login`, and run Sandcastle from the repo root.\n" +
        message,
    );
  }
}

function needsCarefulMerge(branches: string[]): boolean {
  if (branches.length === 0) {
    return false;
  }

  const probeDir = mkdtempSync(join(tmpdir(), "sandcastle-merge-probe-"));
  const probeEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "Sandcastle Merge Probe",
    GIT_AUTHOR_EMAIL:
      process.env.GIT_AUTHOR_EMAIL ?? "sandcastle-merge-probe@example.invalid",
    GIT_COMMITTER_NAME:
      process.env.GIT_COMMITTER_NAME ?? "Sandcastle Merge Probe",
    GIT_COMMITTER_EMAIL:
      process.env.GIT_COMMITTER_EMAIL ??
      "sandcastle-merge-probe@example.invalid",
  };

  try {
    execFileSync("git", ["worktree", "add", "--detach", probeDir, "HEAD"], {
      stdio: "pipe",
    });

    for (const branch of branches) {
      try {
        execFileSync("git", ["merge", "--no-edit", branch], {
          cwd: probeDir,
          env: probeEnv,
          stdio: "pipe",
        });
      } catch {
        console.log(
          `Merge preflight found conflicts while checking ${branch}; continuing with ${CODEX_MODEL}.`,
        );
        return true;
      }
    }

    return false;
  } catch {
    console.log(
      `Merge preflight could not complete cleanly; continuing with ${CODEX_MODEL}.`,
    );
    return true;
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", probeDir], {
        stdio: "pipe",
      });
    } catch {
      rmSync(probeDir, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  const issuesJson = fetchReadyForAgentIssuesJson();
  const plan = await sandcastle.run({
    hooks,
    sandbox: sandboxProvider(),
    name: "planner",
    maxIterations: 1,
    agent: agent(),
    promptFile: "./.sandcastle/plan-prompt.md",
    promptArgs: {
      ISSUES_JSON: issuesJson,
      MAX_PARALLEL_ISSUES: String(MAX_PARALLEL_ISSUES),
      IMPLEMENTATION_MODEL: CODEX_MODEL,
      PLAN_OUTPUT_EXAMPLE: `{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "sandcastle/issue-42-fix-auth-bug", "implementationModel": "${CODEX_MODEL}", "implementationModelReason": "Codex single-model mode for this run."}]}`,
    },
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const issues = plan.output.issues;

  if (issues.length === 0) {
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  const parallelIssueCount = Math.min(issues.length, MAX_PARALLEL_ISSUES);

  console.log(
    `Planning complete. ${issues.length} issue(s) ready; running ${parallelIssueCount} in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} -> ${issue.branch}`);
  }

  const settled = await allSettledWithConcurrency(
    issues,
    MAX_PARALLEL_ISSUES,
    async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: sandboxProvider(),
        hooks,
        copyToWorktree,
        timeouts: {
          copyToWorktreeMs: COPY_TO_WORKTREE_TIMEOUT_MS,
        },
      });

      try {
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: agent(),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
            IMPLEMENTATION_MODEL: issue.implementationModel ?? CODEX_MODEL,
            IMPLEMENTATION_MODEL_REASON:
              issue.implementationModelReason ??
              "Codex single-model mode for this run.",
          },
        });

        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: agent(),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
            },
          });

          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    },
  );

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      const issue = issues[i];
      console.error(
        issue
          ? `  x ${issue.id} (${issue.branch}) failed: ${outcome.reason}`
          : `  x issue at index ${i} failed: ${outcome.reason}`,
      );
    }
  }

  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i] }))
    .filter(
      (
        entry,
      ): entry is {
        outcome: PromiseFulfilledResult<sandcastle.SandboxRunResult>;
        issue: PlannedIssue;
      } =>
        entry.issue !== undefined &&
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  needsCarefulMerge(completedBranches);

  await sandcastle.run({
    hooks,
    sandbox: sandboxProvider(),
    name: "merger",
    maxIterations: 1,
    agent: agent(),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCHES: completedBranches.map((branch) => `- ${branch}`).join("\n"),
      ISSUES: completedIssues
        .map((issue) => `- ${issue.id}: ${issue.title}`)
        .join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
