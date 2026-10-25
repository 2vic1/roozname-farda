# AGENTS.md — orientation for AI coding assistants

This project is the **Telegram Serverless port** of the war-risk dashboard
(the original web app lives in `/home/z/my-project` and MUST NOT be modified by
work done here).

## Runtime rules (from core.telegram.org/bots/serverless)
- Backend = plain JS modules under `tgcloud/` — **no npm packages** in backend code.
- Imports: `import { db, api, EndpointError } from 'sdk'`, operators from `'sdk/db'`
  (`eq, ne, gt, gte, lt, lte, like, inArray, count, sum, avg, min, max, asc, desc, sql`).
- DB DSL: `table(name, { col: text()/integer()/real()/boolean()/json() })`,
  modifiers `.primaryKey({autoIncrement}) .notNull() .unique() .default()`,
  timestamps via `integer('x', { mode: 'timestamp' }).default(sql\`(unixepoch())\`)`.
- Endpoints (`endpoints/*.js`): `export default async function (input, ctx)`;
  `ctx.initData.user` is verified by the platform. Throw `EndpointError` to refuse.
- Handlers (`handlers/*.js`): react to Telegram updates (`message`, `callback_query`, …).
- No Buffer — use Uint8Array. No Node APIs. Global `fetch` for outbound HTTP.
- Front-end (phase 2) = static build (Vite) configured in `tgcloud.jsonc` → served at
  `https://app<app_id>.tgcloud.ai/`, calls endpoints via `Telegram.WebApp.Serverless.call`.

## Safety rules
- Never touch anything outside this `telegram-app/` folder.
- Never hardcode API keys — they live in the `setting` table (set via `/setkey`).
- Deploy: `npx tgcloud login` → `npx tgcloud push` → `npx tgcloud migrate` (needs user token).
