# sidebarctl

```bash
node "$SIDEBAR_KIT_CLI_PATH" task list
node "$SIDEBAR_KIT_CLI_PATH" task get KIT-101
node "$SIDEBAR_KIT_CLI_PATH" task move KIT-101 in_progress
node "$SIDEBAR_KIT_CLI_PATH" task comment KIT-101 "Updated the README and verified the quickstart."
node "$SIDEBAR_KIT_CLI_PATH" task move KIT-101 in_review
```

Set `SIDEBAR_KIT_URL` only when the local service is not using its default origin, `http://127.0.0.1:43119`.
