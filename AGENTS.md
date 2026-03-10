# AGENTS.md

## Project
This repository is SplitMate.

- backend: Django + DRF
- frontend: React + Vite
- database: Postgres
- local development: Docker Compose

## General rules
- Prefer minimal diffs.
- Do not make broad architectural changes unless explicitly requested.
- Preserve existing UI structure unless there is a clear reason to change it.
- Follow existing naming conventions and file organization.
- Before editing, inspect related files and explain the plan briefly.
- After editing, summarize changed files and what was changed.
- If something is uncertain, label it clearly as a hypothesis.
- Do not claim to have tested something unless it was actually run.

## Backend rules
- Respect existing API response shapes unless explicitly asked to change them.
- Avoid destructive schema changes unless explicitly requested.
- Keep validation and business rules centralized where possible.
- If migrations are needed, state that clearly.

## Frontend rules
- Prefer natural Japanese UI wording where the screen is for Japanese users.
- Keep visual changes small and intentional.
- Reuse existing components and patterns before adding new ones.
- Avoid unnecessary state or abstraction.

## Handoff rules
At the end of each task, prepare a handoff summary in Japanese using `docs/codex-handoff-prompt.md`.
If `docs/codex-handoff.md` exists, update it.