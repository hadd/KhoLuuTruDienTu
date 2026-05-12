---
name: orchestra-decision
description: Orchestrates tasks using the 4-quadrant prompt decision matrix and an adaptive low-loop retrieval workflow (classify/understand → predict sources + quality funnel → pre-collect minimum → Pass1/Pass2 + optional ReservePass + circuit breaker). Use when the user asks to design prompts/SOPs/rules, create an AI helper/tool/API, or when a request is ambiguous and needs fast convergence without excessive back-and-forth.
---

# Orchestra Decision (Low-loop Orchestrator)

## Quick start

When a user request arrives, do **not** immediately brainstorm or implement. Run this pipeline and keep the number of retrieval/clarification loops minimal.

### Phase 1 — ClassifyState_and_Understand

Produce exactly these three lines (keep them short):

- **Goal**: one sentence deliverable
- **Constraints**: format, platform, timeline, risk, scope (bullets ok)
- **Output_shape**: what the answer must look like (e.g., API contract, plan, code changes, prompt template)

Then assign a quadrant:

- **Vung1_PhongPhieuTieu**: user is blank / needs inspiration (diverge hard)
- **Vung2_HatGiong**: user has a vague idea (diverge guided)
- **Vung3_BocLop**: user knows what they need but logic is complex (stepwise converge)
- **Vung4_KhuonDuc**: output must be exact/formatting-heavy (SOP/contract; converge hard)

### Phase 2 — PredictCollectSources (before reading anything)

Write a **source shortlist** (max 4 items). Prefer:

1. `docs/orchestra/INDEX.md`
2. `docs/orchestra/collect-before.md`
3. Any user-mentioned paths (e.g. `@src/...`)
4. Repo conventions (README/config) if relevant

Then do a **Source Quality Funnel** (fast scoring; 10–20s total):

- **Reliability (R)**: Authoritative? Up-to-date? Single source of truth? (0–2)
- **Coverage (C)**: Covers the exact scope/edge cases? (0–2)
- For each shortlisted source, write: `Source: <path> | R=<0-2> C=<0-2> | Why(≤8 words)`

Pick:

- `BestBetSource`: highest \(R + C\) for **Retrieve_Pass1**
- `BackupSource`: 1 runner-up for Pass2/ReservePass

Set `RiskMode`:

- `RiskMode=On` if any trigger is true:
  - **high_stakes** (security/money/compliance/data loss)
  - **format_exact** (contract/SOP where 1 char matters)
  - **unknown_domain**
  - **outdated_docs** / code churn/refactor
  - **conflicting_sources** (docs vs code vs README)
- Else `RiskMode=Off`

### Phase 3 — PreCollect_Minimum (minimum viable context)

Collect only what is required to decide approach:

- **Domain/task type** (idea, decision, code, ops)
- **Default policy** (e.g., tutoring vs direct solution; data retention vs deletion)
- **Hard blockers** (auth, permissions, compliance, required formats)
- **Latency/SLA** if it affects approach

**Stop condition**: if you can pick quadrant + output_shape + a safe default policy, stop collecting.

### Phase 4 — Retrieval passes (adaptive; default 2 + risk reserve)

**Budget**:

- Default: `Pass1 + (Pass2 if needed)`
- If `RiskMode=On`: allow **one** `ReservePass` (Pass3) **only if still missing signal after Pass2**

#### Retrieve_Pass1

- Read only: entry docs (INDEX + collect-before) **or** `BestBetSource`.
- Set `EnoughSignal = Yes/No`.

#### Gate_1 (EnoughSignal?)

- If `Yes`: proceed to Phase 5.
- If `No`: run **Reformulate** (do this before Pass2).

#### Reformulate (Query Expansion; 30–60s)

Output a mini-block:

- `WhatIsMissing`: 1 line (the gap)
- `QueryVariants`: 2–4 variants (keywords, symbols, filenames, paths)
- `NextMove`: pick exactly one:
  - Ask **1–2 hard-blocker questions** (only what unlocks the gap), then proceed
  - Do `Retrieve_Pass2` (one extra source/file), then re-check `EnoughSignal`

#### Retrieve_Pass2

- Read only: `BackupSource` or 1 additional best candidate.
- Set `EnoughSignal = Yes/No`.

#### Gate_2 (after Pass2)

- If `Yes`: proceed to Phase 5.
- If `No` and `RiskMode=On`: do **ReservePass** (Pass3; single source/file), then re-check `EnoughSignal`.
- Else: go to **Phase 4.1 — CircuitBreaker**.

### Phase 4.1 — CircuitBreaker (human-in-the-loop; no guessing)

Use this when `EnoughSignal=No` after budget is spent, or sources conflict.

Output exactly:

- `Checked`: A, B (what you read/searched)
- `Gap`: C (what info is missing / conflicting)
- `NeedFromHuman`: 1–2 questions (only what unblocks)
- `Offer`: pick one line:
  - "Bạn cung cấp `C`, mình proceed ngay."
  - "Nếu bạn muốn, mình có thể làm **Deep Research** 1 lượt vào `X` (tốn thời gian hơn)."

### Phase 5 — Orchestrate (Diverge → Converge → Decide)

Use only as much diverge as needed:

- **Diverge**: 2–5 options (keep tight)
- **Converge**: evaluate using explicit criteria (3–7 criteria)
- **Decide**: choose 1, list risks, list next actions

### Output contract (concise-first; split if long)

Default output structure:

- **Quadrant**: which Vung and why (1–2 bullets)
- **Assumptions**: only if needed (bullets)
- **Options**: 2–5
- **Decision**: 1 recommended path + trade-offs
- **Next_actions**: concrete steps

If the answer would be long, output as:

- **Part_1**: Decision + next actions
- **Part_2**: Details (only if requested or strictly necessary)

Stop conditions (anti-loop):

- Retrieval budget: default `Pass1 + Pass2` only.
- `ReservePass`: **max 1** and only when `RiskMode=On`.
- If still `EnoughSignal=No`: use **Phase 4.1 CircuitBreaker** (no guessing).
- Any “Deep Research”: only after user consent (via CircuitBreaker offer).

## UX live text (progress events, no chain-of-thought)

If the user asks for “live text”, stream only **progress events** with **minimal context** (no detailed reasoning / no chain-of-thought).

Format (max 2 lines, mixed VN + key EN terms):

- Line 1: **Status** + **Scope** (file/folder/feature)
- Line 2: **Evidence** (what you observed / counted / detected) + optional **Next** (very short)

Allowed examples:

- "Đang đọc yêu cầu… (scope: `docs/orchestra/*`)"
  "Evidence: found 2 constraints + 1 output shape mention"
- "Đang xác định ràng buộc… (scope: `@src/auth/`)"
  "Evidence: 3 refs to `loginRedirect`; Next: summarize flow"
- "Đang chọn chiến thuật… (scope: `pricing/decision`)"
  "Evidence: 2 options viable; 1 risk → RiskMode=On"
- "Đang tạo phương án… (scope: `API contract`)"
  "Evidence: drafted 3 options; 1 blocker question queued"
- "Đang tổng hợp khuyến nghị… (scope: `plan`)"
  "Evidence: decision + trade-offs captured; Next: write next_actions"

Never reveal chain-of-thought. If asked “why”, give only a short summary rationale (1–2 bullets) without step-by-step internal reasoning.

## Examples

### Mini-example A — Feature request (cancel enrollment)

- Phase 1: `Vung2` or `Vung3` + Goal/Constraints/Output_shape
- Phase 2: shortlist + score \(R/C\) + set `RiskMode`
- Phase 4: Pass1 → if `EnoughSignal=No` then `Reformulate` → Pass2
- If still unclear: `CircuitBreaker` asks 1–2 unblock questions

### Mini-example B — AI helper API tool (with live text)

- Phase 1: `Vung3` + choose safe default policy (or ask 1 blocker)
- Output: API contract + streaming event types (2-line live text: status+scope, evidence(+optional next))
- If docs conflict: `RiskMode=On` → allow `ReservePass` else `CircuitBreaker`

## Additional resources

- If the project has them, use:
  - [docs/orchestra/INDEX.md](../../../docs/orchestra/INDEX.md)
  - [docs/orchestra/collect-before.md](../../../docs/orchestra/collect-before.md)

