# ISSUES

Here are the open issues in the repo, fetched from the host `gh` CLI:

<issues-json>

{{ISSUES_JSON}}

</issues-json>

The list above has already been filtered to issues ready for work.

# TASK

Analyze the open issues and build a dependency graph. Your goal is to select the largest safe parallel batch, up to {{MAX_PARALLEL_ISSUES}} issues.

For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B's explicit "Blocked by" section lists A
- B requires code or infrastructure that A introduces
- B's requirements depend on a decision or API shape that A will establish

Do **not** mark B blocked by A only because:

- B and A share a completed parent issue
- B mentions A as a consumer, follow-up, verification target, or related issue
- B and A may touch nearby files but can be implemented through existing interfaces
- B and A could produce manageable merge conflicts

Shared files are a reason to serialize only when the two issues are expected to rewrite the same function, schema, migration, or public contract in incompatible ways.

An issue is **unblocked** if it has zero hard blocking dependencies on other open issues. Prefer including all unblocked issues in the plan, up to {{MAX_PARALLEL_ISSUES}}. If more than {{MAX_PARALLEL_ISSUES}} issues are unblocked, choose the {{MAX_PARALLEL_ISSUES}} least coupled issues.

For each unblocked issue, assign a branch name using the format `sandcastle/issue-{id}-{slug}`.

For each unblocked issue, set `implementationModel` to `{{IMPLEMENTATION_MODEL}}` and include a short `implementationModelReason`.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{{PLAN_OUTPUT_EXAMPLE}}
</plan>

Include only unblocked issues. If every issue is blocked, include the single highest-priority candidate (the one with the fewest or weakest dependencies).

Always emit the `<plan>` tags, even when there is nothing to do. If there are no issues to work on at all, output `<plan>{"issues": []}</plan>` so the run can exit cleanly.
