# gitpaid

Turn your GitHub commits into invoice line items.

`gitpaid` is a small local web app for contractors and freelancers who bill by
the task. Point it at a date range and a set of orgs (or your personal repos),
and it produces a structured XML summary of every commit you authored. Paste
that XML into Claude or ChatGPT and ask it to draft invoice line items — the
LLM does the tedious work of grouping, paraphrasing, and pricing.

The app runs entirely on your machine. Your GitHub token never leaves your
browser and the local backend; nothing is persisted server-side.

> **Note on this file.** `CLAUDE.md` is the canonical documentation for this
> project. `README.md` is a symlink to it, so GitHub renders the same content
> on the repo homepage. Claude Code (claude.ai/code) reads this file for
> codebase guidance when working in this repository.

---

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:3004>.

Scripts:

| Command         | What it does                                             |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Start the dev server with hot reload (`tsx watch`, 3004) |
| `npm run build` | Compile TypeScript to `dist/`                            |
| `npm start`     | Run the compiled server (`node dist/server.js`)          |

The port can be overridden with `PORT=8080 npm run dev`.

No test runner or linter is configured.

---

## GitHub token setup

Before connecting, create a GitHub **classic** Personal Access Token at
<https://github.com/settings/tokens/new> with these scopes:

- `repo` — read commit data from private repos you have access to
- `read:org` — list the organizations you belong to

> **Fine-grained tokens will not work.** GitHub's REST API returns an empty
> list from `/user/orgs` for fine-grained tokens, so org selection breaks.
> Use a classic token.

The token is saved in your browser's `localStorage` for convenience. Click
**Start Over** in the UI to clear it.

---

## How it works

The app walks you through four steps:

1. **Connect to GitHub** — paste your PAT. The backend calls `/user` to
   validate it and fetches your username and org list.
2. **Select scope** — pick a date range using the 3-month calendar, then
   toggle which sources to include: your personal repos and/or any orgs you
   belong to.
3. **Select repositories** — after fetching commits, narrow the result to
   the specific repos you want included on the invoice.
4. **Copy the XML** — the app renders a structured document grouped by
   repository. Optionally toggle **Include full commit descriptions** to
   add the commit body under each subject.

Paste the result into an LLM with a prompt like:

> Draft invoice line items from this commit summary. Group related work
> into logical tasks, summarize in plain English, and suggest hourly or
> fixed-price estimates.

---

## Output format

The clipboard content is a single XML document:

```xml
<commits author="jordi735" start="2026-03-01" end="2026-03-31" total="42">
  <repository name="acme/web" commits="18">
    <commit date="2026-03-04" sha="a1b2c3d">
      <subject>Fix token refresh race condition</subject>
      <body>
      Previously two concurrent requests could each trigger a refresh
      and invalidate each other's tokens.
      </body>
    </commit>
    ...
  </repository>
  ...
</commits>
```

The `<body>` element is emitted only when **Include full commit descriptions**
is enabled and the commit actually has a body. All attribute and text
content is XML-escaped.

---

## Architecture

**Backend** — Express 5 on Node.js with ES modules and strict TypeScript:

| File                       | Responsibility                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts`            | App entry point. Serves `public/` statically and mounts the API router at `/api/github`.                                                                              |
| `src/routes/github.ts`     | Three routes — `/user`, `/orgs`, `/commits` — all gated by `requireToken` middleware that validates the PAT from the `Authorization: Bearer` header.                  |
| `src/lib/github-client.ts` | Thin wrapper around GitHub REST v3 with pagination, friendly error mapping, a 1s courtesy delay between search pages, and a 10-page / 1000-commit cap on search.      |

**Frontend** — a single `public/index.html` file using:

- **Alpine.js** for reactive state — the whole 4-step wizard is one
  `x-data` component defined inline.
- **Tailwind CSS** via CDN with a custom dark gray palette inspired by
  GitHub's UI.
- Token persisted in `localStorage`; all API calls go to the Express backend
  which proxies to GitHub.

No build step is needed for the frontend.

---

## Security & privacy

- The backend is a **stateless proxy**. It forwards your PAT to GitHub on
  each request and does not log, cache, or persist it.
- Tokens are validated against a strict pattern (`^[a-zA-Z0-9_\-]+$`) before
  being forwarded, so malformed values fail fast with a 401.
- All API routes require an `Authorization: Bearer <token>` header —
  requests without one are rejected before hitting GitHub.
- The token is stored only in your browser's `localStorage`. Anyone with
  access to your browser profile can read it.

---

## Limitations

- **1000-commit cap.** GitHub's search API returns at most 1000 results
  (10 pages × 100). If your range exceeds that, the UI shows a warning and
  `searchCommits` sets `truncated: true`. Narrow the date range for
  complete coverage.
- **Rate limits.** Authenticated search is limited to 30 requests/minute.
  The client sleeps 1s between paginated requests to stay well under that.
- **Classic tokens only.** See the token setup section above.

---

## Project conventions

The codebase follows a few strict rules worth knowing if you extend it:

- ES modules throughout (`"type": "module"` in `package.json`,
  `"module": "nodenext"` in `tsconfig.json`).
- Imports between `.ts` files use `.js` extensions — required by Node's
  native ESM resolver.
- Strict TypeScript, including `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, and `verbatimModuleSyntax`.
- Scope strings always use the form `"org:<name>"` or `"user:<name>"`.
- The backend is a stateless proxy; the PAT is never stored server-side.

---

## License

No license file is checked in. Treat the source as "all rights reserved"
unless a `LICENSE` file is added.
