# What differs from the hosted source (v5)

Identical to hosted v5: app/workspace.tsx (3 wording edits), app/lifecycle-panel.tsx, app/globals.css, app/api/*, lib/model.ts, lib/lifecycle.ts (1 report sentence),
lib/execution-model.ts, lib/document-analysis.ts, lib/ai-document-analysis.ts, components/, drizzle/ migrations, scripts/test-lifecycle.mjs.

Replaced for local use:
- app/chatgpt-auth.ts: one fixed local user instead of ChatGPT sign-in.
- lib/db.ts + local/sqlite.ts: Node's built-in SQLite instead of Cloudflare D1 (same SQL migrations).
- local/storage.ts + local/env.ts: files on disk instead of R2; settings from .env instead of hosted secrets.
- app/layout.tsx + app/page.tsx -> index.html + src/main.tsx (plain Vite).

Added:
- server/index.ts: local web server (127.0.0.1 only, Host and Origin checks).
- server/agent.ts: direct connection to the Autonomous QA Execution Agent (port of qa_avatar_bridge.py).
- app/execution-panel.tsx: adds Check connection / Load scenarios / Run now on top of the hosted file-handoff flow.
