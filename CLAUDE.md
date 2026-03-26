# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server with hot reload (tsx watch, port 3004)
- `npm run build` — compile TypeScript (`tsc`, outputs to `dist/`)
- `npm start` — run compiled server (`node dist/server.js`)

No test runner or linter is configured.

## Architecture

gitpaid is a tool that fetches GitHub commits for a user across orgs/repos and outputs structured XML for AI-assisted invoice generation.

**Backend** — Express 5 on Node.js, ES modules, strict TypeScript:

- `src/server.ts` — entry point, serves `public/` as static files, mounts `/api/github` routes
- `src/routes/github.ts` — three endpoints (`/user`, `/orgs`, `/commits`), all gated by `requireToken` middleware that validates a GitHub PAT from the `Authorization: Bearer` header
- `src/lib/github-client.ts` — wraps GitHub REST API v3 with pagination, 1s rate-limit courtesy delay between pages, friendly error messages, and a 10-page/1000-commit cap on search results

**Frontend** — single-file SPA (`public/index.html`):

- Alpine.js for reactivity, Tailwind CSS via CDN
- 4-step wizard: authenticate → select scope/dates → filter repos → generate XML output
- Token persisted in localStorage; API calls go to the Express backend which proxies to GitHub

## Conventions

- ES modules throughout (`"type": "module"` in package.json, `"module": "nodenext"` in tsconfig)
- Very strict tsconfig: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- Imports between `.ts` files use `.js` extensions (Node.js ESM resolution)
- Token is never stored server-side; the backend is a stateless proxy
- GitHub API scope format: `"org:<name>"` or `"user:<name>"`
