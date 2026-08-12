---
name: sidebar-tasks
description: Process Codex Sidebar Kit demo tasks and keep their status, comments, and native Codex conversation attribution in sync through sidebarctl.
---

# Sidebar Tasks

Use `node "$SIDEBAR_KIT_CLI_PATH"` for every demo task read or write. Consume its JSON output and use the exact task ID supplied by the user or prompt. Do not substitute another task system.

## Workflow

1. Confirm `SIDEBAR_KIT_CLI_PATH` and `SIDEBAR_KIT_URL` are present. If either is missing, stop and report that Codex Sidebar Kit must launch this Codex window.
2. Run `node "$SIDEBAR_KIT_CLI_PATH" task get TASK_ID` before inspecting or changing project files.
3. If the task is `todo`, claim it with `node "$SIDEBAR_KIT_CLI_PATH" task move TASK_ID in_progress` before starting work.
4. Perform only the requested work in the workspace selected by the user.
5. Verify the direct operation path requested by the task.
6. Add a concise result with `node "$SIDEBAR_KIT_CLI_PATH" task comment TASK_ID "RESULT"`.
7. Move the task to review with `node "$SIDEBAR_KIT_CLI_PATH" task move TASK_ID in_review`.
8. Do not move a task to `done`; that remains a user decision.

The CLI automatically attaches `CODEX_THREAD_ID` to successful writes when Codex provides it. If the command is unavailable or the local Sidebar Kit service is not running, stop and report the missing setup instead of inventing state.

Read [references/cli.md](references/cli.md) only when command syntax is needed.
