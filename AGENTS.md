# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Startup Workflow

Before writing code, always complete these steps:

1. Read `feature_list.json` to find the current `in_progress` feature.
2. Read `progress.md` for the last verified state and session context.
3. Run `./init.sh` to confirm baseline verification passes.
4. Work on exactly one feature until it reaches `passing` status.

## Scope

- **One feature at a time.** Only work on the feature marked `in_progress` in `feature_list.json`. Do not start a second feature.
- **Stay in scope.** If you notice a related issue outside the active feature, note it in `progress.md` but do not fix it now.
- **State artifacts:** `feature_list.json` tracks feature status and dependencies; `progress.md` is the session progress log.

## Definition of Done

A feature is done only when:

1. All verification commands pass (`npm test`, `npm run build`, `npm run lint`).
2. Evidence (test output or screenshot path) is recorded in `feature_list.json` under `evidence`.
3. Feature `status` in `feature_list.json` is updated to `passing`.
4. `progress.md` is updated with the session outcome and the next best step.

## End of Session

Before ending a session:

1. Run `./init.sh` to confirm verification still passes.
2. Update `feature_list.json` with current status and any evidence collected.
3. Update `progress.md` — fill in **Last Updated**, **Current Objective**, and **Recommended Next Step**.
4. Fill in `session-handoff.md` with blockers, changed files, and the next recommended action.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Development server in background (logs → logs.txt)
npm run dev:daemon

# Build for production
npm run build

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Reset database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate && npx prisma migrate dev
```

> **Do not run `npm audit fix`.** Dependencies are pinned to specific versions. `audit fix` can break compatibility.

## Environment

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. If the key is absent or still `your-api-key-here`, the app uses a `MockLanguageModel` that returns canned components without calling Codex. The JWT secret (`JWT_SECRET`) defaults to `development-secret-key` if unset.

## Architecture

### Request/Data Flow

1. User types a message in `ChatInterface` → submitted via `useChat` (Vercel AI SDK) to `POST /api/chat`
2. The chat API (`src/app/api/chat/route.ts`) reconstructs a `VirtualFileSystem` from the serialized file state sent in the request body, then calls `streamText` with two tools: `str_replace_editor` and `file_manager`
3. The AI streams tool calls back to the client. `ChatContext` (`src/lib/contexts/chat-context.tsx`) intercepts each tool call via `onToolCall` and dispatches it to `FileSystemContext.handleToolCall`
4. `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) applies the mutation to the in-memory `VirtualFileSystem`, incrementing `refreshTrigger`
5. `PreviewFrame` watches `refreshTrigger`, reads all files, transpiles JSX via Babel Standalone into blob URLs, builds an `<importmap>`, and sets `iframe.srcdoc` to the generated HTML
6. On finish, the server saves `messages` and `fileSystem.serialize()` to the `Project` row in SQLite (authenticated users only)

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is an entirely in-memory tree — no files are written to disk. It is serialized as `Record<string, FileNode>` for transport (request body and DB storage) and reconstructed via `deserializeFromNodes`. The root is always `/`. The AI is instructed to use `/App.jsx` as the entry point and `@/` as the import alias for all non-library imports.

### AI Tools

| Tool | Commands | Purpose |
|------|----------|---------|
| `str_replace_editor` | `view`, `create`, `str_replace`, `insert` | Read and write files in the VFS |
| `file_manager` | `rename`, `delete` | Structural file operations |

Both tools are built server-side with a reference to the request-scoped `VirtualFileSystem` instance and registered with `streamText`. The client mirrors mutations via `handleToolCall` in `FileSystemContext`.

### Preview Pipeline

`PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) does all rendering client-side:
- Babel Standalone (`@babel/standalone`) transpiles JSX/TSX to plain JS
- CSS imports are stripped and inlined as `<style>` tags
- Third-party npm imports are mapped to `https://esm.sh/<package>`
- Each file becomes a blob URL; all paths and `@/` aliases are registered in a native `<importmap>`
- The iframe gets `sandbox="allow-scripts allow-same-origin allow-forms"` and an error boundary wraps the app

### Auth

JWT-based, stored in an `httpOnly` cookie (`auth-token`). Passwords hashed with bcrypt. Session helpers are in `src/lib/auth.ts` (marked `server-only`). The `use-auth` hook and `AuthDialog` handle client-side sign-in/sign-up flows. Anonymous users can generate components; their work is preserved in `sessionStorage` and can be saved on sign-up.

### Database

Prisma with SQLite (`prisma/dev.db`). Generated client output is `src/generated/prisma`. Two models:
- `User` — email + bcrypt password
- `Project` — `messages` (JSON string of AI message history) + `data` (JSON string of `FileNode` tree)

`userId` on `Project` is nullable to support anonymous sessions that get promoted later.

### Provider / Model

`getLanguageModel()` in `src/lib/provider.ts` returns either `anthropic("Codex-haiku-4-5")` (real) or `MockLanguageModel` (fake). The mock produces canned Counter/Form/Card components over a multi-step tool-call sequence.

The AI system prompt is in `src/lib/prompts/generation.tsx` (`generationPrompt`). It instructs the model to always start with `/App.jsx`, use `@/` for local imports, and style with Tailwind only.

### Routes

- `/` — home page; anonymous users can generate; work is tracked in `sessionStorage` via `src/lib/anon-work-tracker.ts` and can be promoted to a project on sign-up
- `/[projectId]` — loads a saved project from DB; requires authentication (redirects to `/` if not logged in or project not found)

### Node.js 25 Compatibility

`node-compat.cjs` deletes `globalThis.localStorage` and `globalThis.sessionStorage` on the server to prevent SSR crashes on Node 25+, which exposes these globals by default but without a backing store.

### Key Conventions

- All components in the generated virtual FS must be `.jsx` or `.tsx`, use `@/` for local imports, and export a default React component. `/App.jsx` is the required entry point.
- Tailwind CSS is loaded via CDN in the preview iframe (`https://cdn.tailwindcss.com`), so generated components should use Tailwind utility classes only.
- `FileSystemContext` and `ChatContext` are client-side only (`"use client"`). Server actions in `src/actions/` use `server-only` indirectly through Prisma and auth helpers.
- Tests use Vitest + jsdom + React Testing Library. Test files live in `__tests__/` subdirectories next to the code they test.

## Imported Claude Cowork project instructions
