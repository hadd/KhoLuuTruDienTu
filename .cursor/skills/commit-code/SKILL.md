---
name: commit-code
description: Analyzes working tree changes, generates a clear conventional commit message, then runs git add and git commit. Project skill for AI-Edu; applies workspace conventions. Use when the user asks to commit code, run commit, save changes with a commit, or write a commit with a clear description.
---

# Commit Code with Clear Message (AI-Edu)

## Workflow

1. **Gather state**: Run `git status`, `git diff`, and `git diff --staged` to see changed files and content.
2. **Generate message**: From the diff, write one commit message in conventional format (see Message format below). If the user or project prefers review first, suggest using the review-code skill when available.
3. **Stage and commit**: Run `git add <files>` or `git add -A` if the user agrees to stage everything, then `git commit -m "<message>"` with the generated message. Only run commit when the user has clearly agreed.

## Message format

- **Format**: `type(scope): subject` (scope optional).
- **Types**: Use only `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Do not invent other types.
- **Subject**: Start with an imperative verb (present tense), no period at end, ~50 characters. Describe what the change does (e.g. "add validation"), not what was done ("added validation").
- **Scope (optional)**: When useful, use a scope that matches the repo structure — e.g. `backend`, `shared`, `docs`, `auth`, `tests`, or module name (`classroom`, `practice`, etc.) when changes are scoped to one module.

## Examples (AI-Edu)

- `feat(backend): add classroom school router`
- `fix(shared): correct base-crud filter type`
- `docs: update code-style guide`
- `test(practice): add integration tests for evaluation`
- `refactor(auth): use shared client for endpoints`
- `chore: update dependencies in package.json`

## Safety

- Only run commit when the user has clearly asked to commit or has agreed to the message and staged files.
- If the diff includes sensitive paths (e.g. .env, secrets, credentials), warn the user before adding or committing.
- Do not force push or rewrite history; only run `git add` and `git commit`.
