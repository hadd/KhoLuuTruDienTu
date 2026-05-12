---
name: commit-code
description: Analyze working tree changes, generate a clear conventional commit message, then run git add and git commit. Use when the user asks to commit code, run commit, save changes with a commit, or write a commit with a clear description.
---

# Commit Code with Clear Message

## Quick Workflow

0. **Review first (mandatory)**  
   Before committing, run the review workflow. Use the checklist and report format from the review-code skill.
   - Gather changes: `git status`, `git diff`, `git diff --staged`.
   - Identify changed files and categorize them.
   - Run the four review categories (project rules, logic/bugs, performance, security) and report findings with severity (CRITICAL / WARNING / INFO) and verdict (PASS / CONDITIONAL PASS / FAIL).
   - **If verdict is FAIL**: Do not proceed. Output the review report and state that commit is blocked until critical issues are fixed. Do not run `git add` or `git commit`.
   - **If verdict is PASS or CONDITIONAL PASS**: Optionally show a one-line summary (e.g. "Review: PASS" or "Review: CONDITIONAL PASS (N warnings)"), then continue with steps 1–3 below.

1. **Gather state**: Run `git status` and `git diff` (and `git diff --staged` if needed) to see changed files and content. (Can reuse output from step 0.)
2. **Generate message**: From the diff, write one commit message in conventional commit format:
   - **Issue prefix (when URL present)**: If the user’s message or context contains a Jira/issue URL (e.g. `atlassian.net`, `jira`, `selectedIssue=...`), extract the issue key from the URL and prefix the commit message with it.
     - **Extract**: Look for query param `selectedIssue=<KEY>` (e.g. `selectedIssue=SCRUM-220` → `SCRUM-220`) or path `/browse/<KEY>` or similar. Issue key format: `PROJECT-NUMBER` (e.g. `SCRUM-220`, `PROJ-123`).
     - **Prefix**: Use `KEY type(scope): subject` (e.g. `SCRUM-220 feat(auth): add login form`). One space between key and the rest of the message.
   - **Format**: `type(scope): subject` (scope optional); or `KEY type(scope): subject` when issue key was extracted.
   - **Types**: Use only `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Do not invent other types.
   - **Subject**: Start with an imperative verb (present tense), no period at end, ~50 chars. Describe what the change does (e.g. "add validation"), not what was done ("added validation").
3. **Run commit**:
   - Run `git add <files>` or `git add -A` if the user agrees to stage everything.
   - Run `git commit -m "<message>"` with the generated message.

## Message Rules

- One-line subject is enough for most commits; add a body only when explaining why or breaking changes.
- **Issue prefix**: If the user provides a Jira/issue URL in their message or context, extract the issue key (e.g. `SCRUM-220`) from the URL and prefix the commit message with it. Do not add issue numbers from thin air—only when a URL (or explicit key) is present.
- If changes span multiple types, pick the most important (feat > fix > refactor > chore) or use `chore` for mixed small changes.

## Examples

- `feat(auth): add login form with email and password`
- `fix(students): correct date formatting in list`
- `refactor(api): use apiClient for course endpoints`
- `docs: update README with setup steps`
- `style: fix indentation in StudentForm`
- `chore: update dependencies in package.json`
- With Jira URL (e.g. `...?selectedIssue=SCRUM-220`): `SCRUM-220 feat(auth): add login form with email and password`

## Safety

- Only run commit when the user has clearly asked to commit or has agreed to the message and staged files.
- Do not run commit when the review verdict is FAIL (any CRITICAL finding); block until the user fixes critical issues.
- If the diff includes sensitive paths (e.g. env, secrets), warn the user before adding or committing.
- Do not force push or rewrite history; only run git add and git commit.
