# Bitrix Assistant

One vertical slice is implemented:

`GET /bitrix/tasks/:id` → Bitrix24 `tasks.task.get` → normalized task data.

The same service powers the `get_task` MCP tool on `POST /mcp`.

## Setup

1. Create a Bitrix24 incoming webhook with Tasks access.
2. Copy `.env.example` to `.env` and replace `BITRIX_WEBHOOK_URL` with the webhook base URL. Do not commit `.env`.
3. Install and run:

```bash
npm install
npm run start:dev
```

4. Verify Bitrix first:

```bash
curl http://localhost:3000/bitrix/tasks/518
```

Expected shape:

```json
{
  "id": 518,
  "title": "...",
  "description": "...",
  "status": "..."
}
```

Then test `http://localhost:3000/mcp` with MCP Inspector. To connect ChatGPT, expose the service through HTTPS and add the public `/mcp` URL in ChatGPT developer mode.
